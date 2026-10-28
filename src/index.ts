import { ForgeClient, ForgeExtension } from "@tryforge/forgescript"
import { readFileSync } from "node:fs"
import path from "node:path"
import { description, version } from "../package.json"
import { IEmbedded, cook, problemsInFile } from "./functions/embedded"
import { loadedFunctions } from "./functions/loaded"
import { scanScript } from "./functions/script"
import { lineStarts } from "./functions/text"
import { IFileReport, Linter, Reporter, validateRules } from "./structures"
import { IForgeLintConfig, IForgeLintOptions } from "./types"

/** A code the client runs & where it's from */
interface ISourcedCode {
    code: string
    path: string | null
    /** e.g. `messageCreate command ping` */
    label: string
}

/** `null` if unreadable */
type FileCodes = { text: string; codes: IEmbedded[] } | null

const CODE_KEYS = new Set(["code"])

/** @returns every code the client runs: cmds, exts' cmds, slash cmds, custom fns */
function codesOf(client: ForgeClient): ISourcedCode[] {
    const found: ISourcedCode[] = []
    const add = (data: { code?: unknown; path?: unknown } | undefined, label: string) => {
        if (typeof data?.code !== "string" || !data.code) return
        found.push({ code: data.code, path: typeof data.path === "string" ? data.path : null, label })
    }

    const managers = [client.commands, ...(client.options.extensions ?? []).map((ext) => ext.getCommandManager?.())]
    for (const manager of managers) {
        for (const command of manager?.toArray() ?? []) {
            add(command.data, `${command.data.type} command ${command.data.name ?? ""}`.trim())
        }
    }

    // slash cmds nest by subcommand group. Private fields, so don't trust older FS versions to have them
    const walk = (value: unknown) => {
        if (value instanceof Map) for (const inner of value.values()) walk(inner)
        else if (value) {
            const command = value as { name?: string; options?: { code?: unknown; path?: unknown } }
            add(command.options, `slash command ${command.name ?? ""}`.trim())
        }
    }
    walk(client.applicationCommands?.["commands"])

    const functions = client.functions?.["functions"]
    for (const fn of functions?.values() ?? []) add(fn.data, `function $${fn.data.name}`)

    return found
}

export class ForgeLint extends ForgeExtension {
    name = "ForgeLint"
    description = description
    version = version

    // natives are global, a 2nd client would only warn about overrides
    private static loaded = false

    /** @throws on an unknown rule or setting */
    public constructor(public readonly options: IForgeLintOptions = {}) {
        super()
        validateRules(options.rules)
    }

    /** @throws if the client has none */
    public static of(client: ForgeClient) {
        return client.getExtension(ForgeLint, true)
    }

    public init(client: ForgeClient) {
        if (!ForgeLint.loaded) {
            this.load(path.resolve(__dirname, "native"))
            ForgeLint.loaded = true
        }

        if (this.options.check === false) return

        // cmds load after exts init, but before login
        const login = client.login.bind(client)
        client.login = (token?: string) => {
            this.report(client)
            return login(token)
        }
    }

    /**
     * Lints every cmd, slash cmd & custom fn the client has
     * @returns a report per file, or per code w/o one. Positions are the file's when the code's found in it
     */
    public check(client: ForgeClient): IFileReport[] {
        const linter = new Linter(loadedFunctions(), this.options.rules)
        const files = new Map<string, FileCodes>()
        const reports = new Map<string, IFileReport>()
        // 2 cmds w/ the same code in 1 file get 1 literal each
        const used = new Set<IEmbedded>()

        for (const { code, path: file, label } of codesOf(client)) {
            const full = file ? path.resolve(file) : null
            const source = full ? this.read(files, full) : null
            const embedded = source?.codes.find((candidate) => candidate.code === code && !used.has(candidate))
            if (embedded) used.add(embedded)

            const key = embedded ? full! : label
            const report = reports.get(key) ?? {
                path: full ?? "",
                file: embedded ? path.relative(process.cwd(), full!).split(path.sep).join("/") : label,
                problems: [],
                codes: 0,
            }

            const problems = linter.lint(code)
            report.problems.push(
                ...(embedded ? problemsInFile(problems, embedded, lineStarts(source!.text)) : problems)
            )
            report.codes++
            reports.set(key, report)
        }

        return [...reports.values()]
    }

    /** @returns a file's codes, read once */
    private read(files: Map<string, FileCodes>, file: string) {
        if (!files.has(file)) {
            let codes: FileCodes = null

            try {
                const text = readFileSync(file, "utf8")
                codes = { text, codes: scanScript(text, CODE_KEYS).literals.map((literal) => cook(text, literal)) }
            } catch {
                // no file = positions stay the code's
            }

            files.set(file, codes)
        }

        return files.get(file)!
    }

    private report(client: ForgeClient) {
        const reporter = new Reporter()

        try {
            const reports = this.check(client)
            reporter.start(
                reports.length,
                reports.reduce((sum, report) => sum + report.codes, 0),
                loadedFunctions().functions.length
            )
            for (const report of reports) reporter.file(report)
            reporter.summary(reports)
        } catch (error) {
            console.error("ForgeLint could not check the code" + ":", error)
        }
    }
}

/** For editor autocomplete: `module.exports = defineConfig({ ... })` */
export const defineConfig = (config: IForgeLintConfig) => config

export * from "./structures"
export * from "./types"
export { LintOutput } from "./properties/output"
export { fromCustom, fromNative } from "./functions/convert"
export type { ArgTypes } from "./functions/convert"
export type { IEmbedded } from "./functions/embedded"
export { loadedFunctions } from "./functions/loaded"
