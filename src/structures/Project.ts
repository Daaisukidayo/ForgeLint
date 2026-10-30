import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { extname, join, relative, resolve, sep } from "node:path"
import { checkScript, checkText } from "../functions/check"
import { ArgTypes, fromArgCall, fromCustom } from "../functions/convert"
import { IEmbedded, cook } from "../functions/embedded"
import {
    CALLER,
    FORGESCRIPT,
    extensionsOf,
    findPackage,
    loadCustomFunctions,
    loadEvents,
    loadNatives,
    touchesCaller,
} from "../functions/packages"
import { IDefinition, scanScript } from "../functions/script"
import { plural } from "../functions/text"
import { IForgeLintConfig, IFunctionArg, IFunctionInfo, IProblem } from "../types"
import { Formatter, applyEdits } from "./Formatter"
import { FunctionRegistry } from "./FunctionRegistry"
import { Linter, validateRules } from "./Linter"

const EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts", ".cts", ".mts"])

/** Skipped at the top of a walk, unless included by path. */
const BUILD_DIRS = new Set(["dist", "build", "docs", "coverage"])

export interface IFileReport {
    /** Absolute. */
    path: string
    /** Relative to the root, `/`-separated. */
    file: string
    /** With the file's offsets, lines and columns. */
    problems: IProblem[]
    /** The codes in it. */
    codes: number
    /** The file with its codes formatted, if that changes something. */
    formatted?: string
}

interface IScanned {
    path: string
    text: string
    codes: IEmbedded[]
    definitions: IDefinition[]
}

/** Configs can give one string or an array. */
const listOf = (value: string | string[] | undefined) => (value === undefined ? [] : [value].flat())

const readable = (path: string) => EXTENSIONS.has(extname(path)) && !/\.d\.[cm]?ts$/.test(path)

/** @returns The path relative to the root, `/`-separated. */
const shown = (path: string, root: string) => relative(root, path).split(sep).join("/")

/** The parts of the bot's ForgeScript that ForgeLint uses. */
interface IForge {
    Arg: Record<string, unknown>
    ArgType: ArgTypes
}

/** If a function's arguments aren't plain, they aren't checked. */
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

/** A bot's files, checked together. */
export class Project {
    /** What failed to load. Shown, not fatal. */
    public readonly notes: string[] = []
    private readonly keys: Set<string>
    private loaded: FunctionRegistry | null = null
    /** Set with `loaded`. */
    private forge: IForge | null = null
    /** What a command's `type` can be, set with `loaded`. `undefined` means unchecked: the events of ForgeScript itself couldn't be read. */
    private events?: Set<string>

    /**
     * @param root What config paths are relative to. Defaults to the current folder.
     * @throws On a bad config.
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

    /** @returns How many files it wrote. */
    public static write(reports: IFileReport[]) {
        const changed = reports.filter((report) => report.formatted !== undefined)
        for (const report of changed) writeFileSync(report.path, report.formatted!, "utf8")
        return changed.length
    }

    /**
     * The functions code can call, minus the ones the files define: the extensions', ForgeScript's and the config's. Loaded once.
     * @throws If ForgeScript isn't installed.
     */
    public get functions() {
        if (this.loaded) return this.loaded

        const forgescript = findPackage(FORGESCRIPT, this.root)
        if (!forgescript) {
            throw new Error(`Can't find ${FORGESCRIPT} from ${this.root}. ForgeLint reads its functions: install it.`)
        }

        const registry = new FunctionRegistry()
        const events = new Set<string>()
        const { Arg, ArgType } = require(forgescript) as IForge
        this.forge = { Arg, ArgType }
        const extensions =
            this.config.extensions === undefined ? extensionsOf(this.root) : listOf(this.config.extensions)

        // like in `ForgeClient`: exts load 1st & keep their names
        for (const name of extensions) {
            const dir = findPackage(name, this.root)
            if (dir) {
                this.load(name, () => [
                    ...loadNatives(dir, name, registry, ArgType, touchesCaller(dir)),
                    ...loadEvents(dir, events),
                ])
            } else this.notes.push(`Extension ${name} isn't installed: its functions & events are unknown.`)
        }

        this.load("ForgeScript", () =>
            loadNatives(join(forgescript, "dist", "native"), "ForgeScript", registry, ArgType)
        )

        const native = new Set<string>()
        this.load("ForgeScript's events", () => loadEvents(join(forgescript, "dist", "handlers"), native))
        // w/o FS's own, every command would look wrong
        this.events = native.size ? new Set([...native, ...events]) : undefined

        for (const dir of listOf(this.config.natives)) {
            const full = resolve(this.root, dir)
            this.load(dir, () => loadNatives(full, dir, registry, ArgType, touchesCaller(full)))
        }

        for (const dir of listOf(this.config.functions)) {
            this.load(dir, () => loadCustomFunctions(resolve(this.root, dir), dir, registry, ArgType))
        }

        for (const name of listOf(this.config.known)) registry.add(FunctionRegistry.loose(name, "known"))

        return (this.loaded = registry)
    }

    /**
     * @param paths Defaults to the config's `include`, otherwise the root.
     * @returns Every file to check, absolute and sorted.
     * @throws If a path doesn't exist.
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
     * Lints and formats every file.
     * @param paths Defaults to the config's `include`, otherwise the root.
     * @param brackets Also escape each `]` a problem has a `fix` for, in `formatted`. The problems are then the fixed text's.
     * @throws If a path doesn't exist or ForgeScript isn't installed.
     */
    public check(paths?: string[], brackets = false): IFileReport[] {
        const scanned = this.files(paths).map((path) => this.scan(path))

        // fns the files define count too
        const registry = new FunctionRegistry(this.functions.functions)
        for (const { path, text, definitions } of scanned) {
            // a native whose file runs code w/ the caller's ctx may read its variables. Custom ones always may
            const opaque = CALLER.test(text)
            for (const definition of definitions) {
                registry.add({ opaque, ...infoOf(definition, shown(path, this.root), this.forge!) })
            }
        }

        const linter = new Linter(registry, this.config.rules, this.events)
        const formatter = new Formatter(registry, this.config.indent)
        const options = { properties: [...this.keys], alignToKey: this.config.alignToKey ?? true }

        return scanned.map(({ path, text, codes }) => {
            let current = text
            let result = checkText(text, codes, linter, formatter, options.alignToKey)

            // 1 at a time: escaping an unescaped `]` often fixes the stray one after it. Each round escapes another `]`
            for (let left = brackets ? text.split("]").length - 1 : 0; left > 0; left--) {
                const fix = result.problems.find((problem) => problem.fix)?.fix
                if (!fix) break

                current = applyEdits(current, [fix])
                result = checkScript(current, linter, formatter, options)
            }

            const final = result.formatted ?? current
            const formatted = final === text ? undefined : final
            return { path, file: shown(path, this.root), problems: result.problems, codes: codes.length, formatted }
        })
    }

    private scan(path: string): IScanned {
        const text = readFileSync(path, "utf8")
        const { literals, definitions } = scanScript(text, this.keys)
        return { path, text, codes: literals.map((literal) => cook(text, literal)), definitions }
    }

    /** @param top Only here do `dist` and the like get skipped: `commands/docs` is fine. */
    private walk(dir: string, found: Set<string>, top: boolean) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name)
            if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
            if ((top && BUILD_DIRS.has(entry.name)) || this.excluded(path)) continue

            if (entry.isDirectory()) this.walk(path, found, false)
            else if (entry.isFile() && readable(path)) found.add(path)
        }
    }

    /** @returns Whether the config's `exclude` names it, by name or path. */
    private excluded(path: string) {
        const file = shown(path, this.root)
        const name = file.split("/").at(-1)

        return listOf(this.config.exclude).some((pattern) => {
            const clean = pattern.replace(/^\.\//, "").replace(/\/+$/, "")
            return clean === name || clean === file || file.startsWith(`${clean}/`)
        })
    }

    /** @param loader Returns why files failed. */
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
                `${plural(failures.length, "file")} of ${what} failed to load: what they add is unknown. First: ${failures[0]}`
            )
        }
    }
}
