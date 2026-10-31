"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const check_1 = require("../functions/check");
const convert_1 = require("../functions/convert");
const embedded_1 = require("../functions/embedded");
const packages_1 = require("../functions/packages");
const script_1 = require("../functions/script");
const text_1 = require("../functions/text");
const Formatter_1 = require("./Formatter");
const FunctionRegistry_1 = require("./FunctionRegistry");
const Linter_1 = require("./Linter");
const EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts", ".cts", ".mts"]);
/** Skipped at the top of a walk, unless included by path. */
const BUILD_DIRS = new Set(["dist", "build", "docs", "coverage"]);
/** Configs can give one string or an array. */
const listOf = (value) => (value === undefined ? [] : [value].flat());
const readable = (path) => EXTENSIONS.has((0, node_path_1.extname)(path)) && !/\.d\.[cm]?ts$/.test(path);
/** @returns The path relative to the root, `/`-separated. */
const shown = (path, root) => (0, node_path_1.relative)(root, path).split(node_path_1.sep).join("/");
/** If a function's arguments aren't plain, they aren't checked. */
function infoOf(definition, source, forge) {
    const { name, kind, brackets, params, firstParamCondition } = definition;
    if (kind === "native") {
        const args = definition.args?.map((arg) => ("method" in arg ? (0, convert_1.fromArgCall)(arg, forge.Arg, forge.ArgType) : arg));
        if (brackets === null || !args || args.includes(null)) {
            return FunctionRegistry_1.FunctionRegistry.loose(name, source, brackets === null ? false : brackets);
        }
        return {
            name,
            aliases: definition.aliases ?? [],
            brackets,
            args: args,
            // FS turns it off w/o args
            unwrap: !!definition.unwrap && args.length > 0,
            deprecated: !!definition.deprecated,
            description: "",
            source,
        };
    }
    if (params === null || brackets === null)
        return FunctionRegistry_1.FunctionRegistry.loose(name, source, brackets ?? false);
    return (0, convert_1.fromCustom)({ name, params: params, brackets: brackets ?? undefined, firstParamCondition, code: "" }, source, forge.ArgType);
}
/** A bot's files, checked together. */
class Project {
    config;
    root;
    /** What failed to load. Shown, not fatal. */
    notes = [];
    keys;
    loaded = null;
    /** Set with `loaded`. */
    forge = null;
    /** What a command's `type` can be, set with `loaded`. `undefined` means unchecked: the events of ForgeScript itself couldn't be read. */
    events;
    /**
     * @param root What config paths are relative to. Defaults to the current folder.
     * @throws On a bad config.
     */
    constructor(config = {}, root = process.cwd()) {
        this.config = config;
        this.root = root;
        (0, Linter_1.validateRules)(config.rules);
        const { indent } = config;
        if (indent !== undefined && indent !== "tab" && !(Number.isInteger(indent) && indent > 0)) {
            throw new Error(`indent must be a positive whole number or "tab", not ${JSON.stringify(indent)}.`);
        }
        if (config.alignToKey !== undefined && typeof config.alignToKey !== "boolean") {
            throw new Error(`alignToKey must be true or false, not ${JSON.stringify(config.alignToKey)}.`);
        }
        this.keys = new Set(config.properties === undefined ? ["code"] : listOf(config.properties));
    }
    /** @returns How many files it wrote. */
    static write(reports) {
        const changed = reports.filter((report) => report.formatted !== undefined);
        for (const report of changed)
            (0, node_fs_1.writeFileSync)(report.path, report.formatted, "utf8");
        return changed.length;
    }
    /**
     * The functions code can call, minus the ones the files define: the extensions', ForgeScript's and the config's. Loaded once.
     * @throws If ForgeScript isn't installed.
     */
    get functions() {
        if (this.loaded)
            return this.loaded;
        const forgescript = (0, packages_1.findPackage)(packages_1.FORGESCRIPT, this.root);
        if (!forgescript) {
            throw new Error(`Can't find ${packages_1.FORGESCRIPT} from ${this.root}. ForgeLint reads its functions: install it.`);
        }
        const registry = new FunctionRegistry_1.FunctionRegistry();
        const events = new Set();
        const { Arg, ArgType } = require(forgescript);
        this.forge = { Arg, ArgType };
        const extensions = this.config.extensions === undefined ? (0, packages_1.extensionsOf)(this.root) : listOf(this.config.extensions);
        // like in `ForgeClient`: exts load 1st & keep their names
        for (const name of extensions) {
            const dir = (0, packages_1.findPackage)(name, this.root);
            if (dir) {
                this.load(name, () => [
                    ...(0, packages_1.loadNatives)(dir, name, registry, ArgType, (0, packages_1.touchesCaller)(dir)),
                    ...(0, packages_1.loadEvents)(dir, events),
                ]);
            }
            else
                this.notes.push(`Extension ${name} isn't installed: its functions & events are unknown.`);
        }
        this.load("ForgeScript", () => (0, packages_1.loadNatives)((0, node_path_1.join)(forgescript, "dist", "native"), "ForgeScript", registry, ArgType));
        const native = new Set();
        this.load("ForgeScript's events", () => (0, packages_1.loadEvents)((0, node_path_1.join)(forgescript, "dist", "handlers"), native));
        // w/o FS's own, every command would look wrong
        this.events = native.size ? new Set([...native, ...events]) : undefined;
        for (const dir of listOf(this.config.natives)) {
            const full = (0, node_path_1.resolve)(this.root, dir);
            this.load(dir, () => (0, packages_1.loadNatives)(full, dir, registry, ArgType, (0, packages_1.touchesCaller)(full)));
        }
        for (const dir of listOf(this.config.functions)) {
            this.load(dir, () => (0, packages_1.loadCustomFunctions)((0, node_path_1.resolve)(this.root, dir), dir, registry, ArgType));
        }
        for (const name of listOf(this.config.known))
            registry.add(FunctionRegistry_1.FunctionRegistry.loose(name, "known"));
        return (this.loaded = registry);
    }
    /**
     * @param paths Defaults to the config's `include`, otherwise the root.
     * @returns Every file to check, absolute and sorted.
     * @throws If a path doesn't exist.
     */
    files(paths) {
        const targets = paths?.length
            ? paths.map((path) => (0, node_path_1.resolve)(path))
            : listOf(this.config.include ?? ".").map((path) => (0, node_path_1.resolve)(this.root, path));
        const found = new Set();
        for (const target of targets) {
            if (!(0, node_fs_1.existsSync)(target))
                throw new Error(`There is no file or folder at ${target}.`);
            if ((0, node_fs_1.statSync)(target).isDirectory())
                this.walk(target, found, true);
            else if (readable(target))
                found.add(target);
        }
        return [...found].sort();
    }
    /**
     * Lints and formats every file.
     * @param paths Defaults to the config's `include`, otherwise the root.
     * @param brackets Also escape each `]` a problem has a `fix` for, in `formatted`. The problems are then the fixed text's.
     * @throws If a path doesn't exist or ForgeScript isn't installed.
     */
    check(paths, brackets = false) {
        const scanned = this.files(paths).map((path) => this.scan(path));
        // fns the files define count too
        const registry = new FunctionRegistry_1.FunctionRegistry(this.functions.functions);
        for (const { path, text, definitions } of scanned) {
            // a native whose file runs code w/ the caller's ctx may read its variables. Custom ones always may
            const opaque = packages_1.CALLER.test(text);
            for (const definition of definitions) {
                registry.add({ opaque, ...infoOf(definition, shown(path, this.root), this.forge) });
            }
        }
        const linter = new Linter_1.Linter(registry, this.config.rules, this.events);
        const formatter = new Formatter_1.Formatter(registry, this.config.indent);
        const options = { properties: [...this.keys], alignToKey: this.config.alignToKey ?? true };
        return scanned.map(({ path, text, codes }) => {
            let current = text;
            let result = (0, check_1.checkText)(text, codes, linter, formatter, options.alignToKey);
            // 1 at a time: escaping an unescaped `]` often fixes the stray one after it. Each round escapes another `]`
            for (let left = brackets ? text.split("]").length - 1 : 0; left > 0; left--) {
                const fix = result.problems.find((problem) => problem.fix)?.fix;
                if (!fix)
                    break;
                current = (0, Formatter_1.applyEdits)(current, [fix]);
                result = (0, check_1.checkScript)(current, linter, formatter, options);
            }
            const final = result.formatted ?? current;
            const formatted = final === text ? undefined : final;
            return { path, file: shown(path, this.root), problems: result.problems, codes: codes.length, formatted };
        });
    }
    scan(path) {
        const text = (0, node_fs_1.readFileSync)(path, "utf8");
        const { literals, definitions } = (0, script_1.scanScript)(text, this.keys);
        return { path, text, codes: literals.map((literal) => (0, embedded_1.cook)(text, literal)), definitions };
    }
    /** @param top Only here do `dist` and the like get skipped: `commands/docs` is fine. */
    walk(dir, found, top) {
        for (const entry of (0, node_fs_1.readdirSync)(dir, { withFileTypes: true })) {
            const path = (0, node_path_1.join)(dir, entry.name);
            if (entry.name === "node_modules" || entry.name.startsWith("."))
                continue;
            if ((top && BUILD_DIRS.has(entry.name)) || this.excluded(path))
                continue;
            if (entry.isDirectory())
                this.walk(path, found, false);
            else if (entry.isFile() && readable(path))
                found.add(path);
        }
    }
    /** @returns Whether the config's `exclude` names it, by name or path. */
    excluded(path) {
        const file = shown(path, this.root);
        const name = file.split("/").at(-1);
        return listOf(this.config.exclude).some((pattern) => {
            const clean = pattern.replace(/^\.\//, "").replace(/\/+$/, "");
            return clean === name || clean === file || file.startsWith(`${clean}/`);
        });
    }
    /** @param loader Returns why files failed. */
    load(what, loader) {
        let failures;
        try {
            failures = loader();
        }
        catch (error) {
            this.notes.push(`Couldn't load ${what}: ${error instanceof Error ? error.message : error}`);
            return;
        }
        if (failures.length) {
            this.notes.push(`${(0, text_1.plural)(failures.length, "file")} of ${what} failed to load: what they add is unknown. First: ${failures[0]}`);
        }
    }
}
exports.Project = Project;
//# sourceMappingURL=Project.js.map