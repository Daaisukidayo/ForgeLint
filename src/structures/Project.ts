import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { extname, join, relative, resolve, sep } from "node:path"
import { ArgTypes, fromArgCall, fromCustom } from "../functions/convert"
import { IEmbedded, cook, editsInFile, problemsInFile } from "../functions/embedded"
import { FORGESCRIPT, extensionsOf, findPackage, loadCustomFunctions, loadNatives } from "../functions/packages"
import { IDefinition, scanScript } from "../functions/script"
import { lineStarts, plural } from "../functions/text"
import { IForgeLintConfig, IFunctionArg, IFunctionInfo, IProblem } from "../types"
import { Formatter, IEdit, applyEdits } from "./Formatter"
import { FunctionRegistry } from "./FunctionRegistry"
import { Linter, validateRules } from "./Linter"

const EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts", ".cts", ".mts"])

/** skipped at the top of a walk, unless included by path */
const BUILD_DIRS = new Set(["dist", "build", "docs", "coverage"])

export interface IFileReport {
    /** absolute */
    path: string
    /** relative to the root, `/`-separated */
    file: string
    /** w/ the file's offsets, lines & columns */
    problems: IProblem[]
    /** codes in it */
    codes: number
    /** the file w/ its codes formatted, if that changes smth */
    formatted?: string
}

interface IScanned {
    path: string
    text: string
    codes: IEmbedded[]
    definitions: IDefinition[]
}

/** cfgs can give 1 string or an array */
const listOf = (value: string | string[] | undefined) => (value === undefined ? [] : [value].flat())

const readable = (path: string) => EXTENSIONS.has(extname(path)) && !/\.d\.[cm]?ts$/.test(path)

/** @returns relative to the root, `/`-separated */
const shown = (path: string, root: string) => relative(root, path).split(sep).join("/")

/** The bot's FS bits ForgeLint uses */
interface IForge {
    Arg: Record<string, unknown>
    ArgType: ArgTypes
}

/** If a fn's args aren't plain, they aren't checked */
function infoOf(definition: IDefinition, source: string, forge: IForge): IFunctionInfo {
    const { name, kind, brackets, params, firstParamCondition } = definition

    if (kind === "native") {
        const args = definition.args?.map((arg) => ("method" in arg ? fromArgCall(arg, forge.Arg, forge.ArgType) : arg))
        if (brackets === null || !args || args.includes(null)) {
            return FunctionRegistry.loose(name, source, brackets === null ? false : brackets)
        }

        return {
            name,
            aliases: definition.aliases ?? [],
            brackets,
            args: args as IFunctionArg[],
            // FS turns it off w/o args
            unwrap: !!definition.unwrap && args.length > 0,
            deprecated: !!definition.deprecated,
            description: "",
            source,
        }
    }

    if (params === null || brackets === null) return FunctionRegistry.loose(name, source, brackets ?? false)

    return fromCustom(
        { name, params: params as never, brackets: brackets ?? undefined, firstParamCondition, code: "" },
        source,
        forge.ArgType
    )
}

/** Lints & formats a file's codes */
export function checkText(text: string, codes: IEmbedded[], linter: Linter, formatter: Formatter, alignToKey = true) {
    const starts = lineStarts(text)
    const problems: IProblem[] = []
    const edits: IEdit[] = []

    for (const embedded of codes) {
        problems.push(...problemsInFile(linter.lint(embedded.code), embedded, starts))
        edits.push(...editsInFile(text, embedded, formatter.edits(embedded.code, { ...embedded, alignToKey })))
    }

    const formatted = applyEdits(text, edits)
    return {
        problems: problems.sort((a, b) => a.start - b.start || a.end - b.end),
        formatted: formatted === text ? undefined : formatted,
    }
}

/** A bot's files, checked together */
export class Project {
    /** what failed to load. Shown, not fatal */
    public readonly notes: string[] = []
    private readonly keys: Set<string>
    private loaded: FunctionRegistry | null = null
    /** set w/ `loaded` */
    private forge: IForge | null = null

    /**
     * @param root what cfg paths are relative to. Default the cwd
     * @throws on a bad cfg
     */
    public constructor(
        public readonly config: IForgeLintConfig = {},
        public readonly root = process.cwd()
    ) {
        validateRules(config.rules)

        const { indent } = config
        if (indent !== undefined && indent !== "tab" && !(Number.isInteger(indent) && indent > 0)) {
            throw new Error(`indent must be a positive whole number or "tab", not ${JSON.stringify(indent)}.`)
        }

        if (config.alignToKey !== undefined && typeof config.alignToKey !== "boolean") {
            throw new Error(`alignToKey must be true or false, not ${JSON.stringify(config.alignToKey)}.`)
        }

        this.keys = new Set(config.properties === undefined ? ["code"] : listOf(config.properties))
    }

    /** @returns how many files it wrote */
    public static write(reports: IFileReport[]) {
        let written = 0

        for (const report of reports) {
            if (report.formatted === undefined) continue
            writeFileSync(report.path, report.formatted, "utf8")
            written++
        }

        return written
    }

    /**
     * Fns code can call, minus the ones the files define: exts', FS's, the cfg's. Loaded once
     * @throws if ForgeScript isn't installed
     */
    public get functions() {
        if (this.loaded) return this.loaded

        const forgescript = findPackage(FORGESCRIPT, this.root)
        if (!forgescript) {
            throw new Error(
                `Can't find ${FORGESCRIPT} from ${this.root}. ForgeLint reads its functions, so install it.`
            )
        }

        const registry = new FunctionRegistry()
        const { Arg, ArgType } = require(forgescript) as IForge
        this.forge = { Arg, ArgType }
        const extensions =
            this.config.extensions === undefined ? extensionsOf(this.root) : listOf(this.config.extensions)

        // like in `ForgeClient`: exts load 1st & keep their names
        for (const name of extensions) {
            const dir = findPackage(name, this.root)
            if (dir) this.load(name, () => loadNatives(dir, name, registry, ArgType))
            else this.notes.push(`Extension ${name} isn't installed, so its functions are unknown.`)
        }

        this.load("ForgeScript", () =>
            loadNatives(join(forgescript, "dist", "native"), "ForgeScript", registry, ArgType)
        )

        for (const dir of listOf(this.config.natives)) {
            this.load(dir, () => loadNatives(resolve(this.root, dir), dir, registry, ArgType))
        }

        for (const dir of listOf(this.config.functions)) {
            this.load(dir, () => loadCustomFunctions(resolve(this.root, dir), dir, registry, ArgType))
        }

        for (const name of listOf(this.config.known)) registry.add(FunctionRegistry.loose(name, "known"))

        return (this.loaded = registry)
    }

    /**
     * @param paths default the cfg's `include`, else the root
     * @returns every file to check, absolute & sorted
     * @throws if a path doesn't exist
     */
    public files(paths?: string[]) {
        const targets = paths?.length
            ? paths.map((path) => resolve(path))
            : listOf(this.config.include ?? ".").map((path) => resolve(this.root, path))
        const found = new Set<string>()

        for (const target of targets) {
            if (!existsSync(target)) throw new Error(`There is no file or folder at ${target}.`)

            if (statSync(target).isDirectory()) this.walk(target, found, true)
            else if (readable(target)) found.add(target)
        }

        return [...found].sort()
    }

    /**
     * Lints & formats every file
     * @param paths default the cfg's `include`, else the root
     * @throws if a path doesn't exist or ForgeScript isn't installed
     */
    public check(paths?: string[]): IFileReport[] {
        const scanned = this.files(paths).map((path) => this.scan(path))

        // fns the files define count too
        const registry = new FunctionRegistry(this.functions.functions)
        for (const { path, definitions } of scanned) {
            for (const definition of definitions) registry.add(infoOf(definition, shown(path, this.root), this.forge!))
        }

        const linter = new Linter(registry, this.config.rules)
        const formatter = new Formatter(registry, this.config.indent)

        return scanned.map(({ path, text, codes }) => ({
            path,
            file: shown(path, this.root),
            codes: codes.length,
            ...checkText(text, codes, linter, formatter, this.config.alignToKey ?? true),
        }))
    }

    private scan(path: string): IScanned {
        const text = readFileSync(path, "utf8")
        const { literals, definitions } = scanScript(text, this.keys)
        return { path, text, codes: literals.map((literal) => cook(text, literal)), definitions }
    }

    /** @param top `dist` & co. only get skipped here, `commands/docs` is fine */
    private walk(dir: string, found: Set<string>, top: boolean) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name)
            if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
            if ((top && BUILD_DIRS.has(entry.name)) || this.excluded(path)) continue

            if (entry.isDirectory()) this.walk(path, found, false)
            else if (entry.isFile() && readable(path)) found.add(path)
        }
    }

    /** @returns whether the cfg's `exclude` names it, by name or path */
    private excluded(path: string) {
        const file = shown(path, this.root)
        const name = file.split("/").at(-1)

        return listOf(this.config.exclude).some((pattern) => {
            const clean = pattern.replace(/^\.\//, "").replace(/\/+$/, "")
            return clean === name || clean === file || file.startsWith(`${clean}/`)
        })
    }

    /** @param loader returns why files failed */
    private load(what: string, loader: () => string[]) {
        let failures: string[]
        try {
            failures = loader()
        } catch (error) {
            this.notes.push(`Couldn't load ${what}: ${error instanceof Error ? error.message : error}`)
            return
        }

        if (failures.length) {
            this.notes.push(
                `${plural(failures.length, "file")} of ${what} failed to load, so their functions are unknown. First: ${failures[0]}`
            )
        }
    }
}
