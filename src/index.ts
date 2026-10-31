import { EventManager, ForgeClient, ForgeExtension } from "@tryforge/forgescript"
import { readFileSync } from "node:fs"
import path from "node:path"
import { description, version } from "../package.json"
import { IEmbedded, cook, problemsInFile } from "./functions/embedded"
import { loadedFunctions } from "./functions/loaded"
import { scanScript } from "./functions/script"
import { lineStarts, locate, plural } from "./functions/text"
import { IFileReport, Linter, Reporter, validateRules } from "./structures"
import { IForgeLintConfig, IForgeLintOptions } from "./types"

/** A code the client runs, and where it's from. */
interface ISourcedCode {
    code: string
    path: string | null
    /** For example `messageCreate command ping`. */
    label: string
    /** A command's `type` and what its manager listens to. With none loaded, it's unchecked. */
    event?: { type: string; events: Set<string> }
}

/** `null` if unreadable. */
type FileCodes = { text: string; codes: IEmbedded[] } | null

const CODE_KEYS = new Set(["code"])

/** @returns Every code the client runs: commands, extensions' commands, slash commands and custom functions. */
function codesOf(client: ForgeClient): ISourcedCode[] {
    const found: ISourcedCode[] = []
    const add = (
        data: { code?: unknown; path?: unknown } | undefined,
        label: string,
        event?: ISourcedCode["event"]
    ) => {
        if (typeof data?.code !== "string" || !data.code) return
        found.push({ code: data.code, path: typeof data.path === "string" ? data.path : null, label, event })
    }

    const managers = [client.commands, ...(client.options.extensions ?? []).map((ext) => ext.getCommandManager?.())]
    for (const manager of managers) {
        // what its handler loaded. An ext may load them only when it's told to listen to some
        const events = new Set(Object.keys(EventManager.Loaded?.[manager?.handlerName ?? ""] ?? {}))

        for (const command of manager?.toArray() ?? []) {
            const { type, name } = command.data
            add(command.data, `${type} command ${name ?? ""}`.trim(), { type, events })
        }
    }

    // slash cmds nest by subcommand group. Private fields: older FS versions may lack them
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

    /** @throws On an unknown rule or setting. */
    public constructor(public readonly options: IForgeLintOptions = {}) {
        super()
        validateRules(options.rules)

        if (options.stopOnError && options.check === false) {
            console.warn("ForgeLint: stopOnError does nothing while check is false, the bot logs in anyway.")
        }
    }

    /** @throws If the client has none. */
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
            const errors = this.report(client)
            if (errors && this.options.stopOnError) {
                return Promise.reject(new Error(`ForgeLint found ${plural(errors, "error")}. The bot won't log in`))
            }
            return login(token)
        }
    }

    /**
     * Lints every command, slash command and custom function the client has.
     * @returns A report per file, or per code without one. Positions are the file's when the code is found in it.
     */
    public check(client: ForgeClient): IFileReport[] {
        const linter = new Linter(loadedFunctions(), this.options.rules)
        const files = new Map<string, FileCodes>()
        const reports = new Map<string, IFileReport>()
        // 2 cmds w/ the same code in 1 file get 1 literal each
        const used = new Set<IEmbedded>()

        for (const { code, path: file, label, event } of codesOf(client)) {
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

            const starts = embedded ? lineStarts(source!.text) : [0]
            const found = event && linter.lintEvent(event.type, event.events)
            if (found) {
                // the `type` in the file, else where the code starts
                const start = embedded?.event?.start ?? embedded?.map[0] ?? 0
                report.problems.push({ ...found, start, end: embedded?.event?.end ?? start, ...locate(starts, start) })
            }

            // not in a file = can't tell if it was a JS string
            const problems = linter.lint(code, embedded?.escapedBracket ?? "\\] (\\\\] in a JS string)")
            report.problems.push(...(embedded ? problemsInFile(problems, embedded, starts) : problems))
            report.codes++
            reports.set(key, report)
        }

        return [...reports.values()]
    }

    /** @returns A file's codes, read once. */
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

    /** @returns How many errors it found, 0 when it couldn't check. */
    private report(client: ForgeClient) {
        const reporter = new Reporter()

        try {
            return reporter.print(this.check(client), loadedFunctions().functions.length)
        } catch (error) {
            console.error("ForgeLint could not check the code:", error)
            return 0
        }
    }
}

/** For editor autocomplete: `module.exports = defineConfig({ ... })`. */
export const defineConfig = (config: IForgeLintConfig) => config

export * from "./structures"
export * from "./types"
export { LintOutput } from "./properties/output"
export { checkScript, checkText } from "./functions/check"
export type { IScriptOptions } from "./functions/check"
export { fromCustom, fromNative } from "./functions/convert"
export { fromMetadata } from "./functions/metadata"
export type { IFunctionMetadata } from "./functions/metadata"
export type { ArgTypes } from "./functions/convert"
export type { IEmbedded } from "./functions/embedded"
export { loadedFunctions } from "./functions/loaded"
