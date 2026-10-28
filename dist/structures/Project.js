"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
exports.checkText = checkText;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const convert_1 = require("../functions/convert");
const embedded_1 = require("../functions/embedded");
const packages_1 = require("../functions/packages");
const script_1 = require("../functions/script");
const text_1 = require("../functions/text");
const Formatter_1 = require("./Formatter");
const FunctionRegistry_1 = require("./FunctionRegistry");
const Linter_1 = require("./Linter");
const EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts", ".cts", ".mts"]);
/** skipped at the top of a walk, unless included by path */
const BUILD_DIRS = new Set(["dist", "build", "docs", "coverage"]);
/** cfgs can give 1 string or an array */
const listOf = (value) => (value === undefined ? [] : [value].flat());
const readable = (path) => EXTENSIONS.has((0, node_path_1.extname)(path)) && !/\.d\.[cm]?ts$/.test(path);
/** @returns relative to the root, `/`-separated */
const shown = (path, root) => (0, node_path_1.relative)(root, path).split(node_path_1.sep).join("/");
/** If a fn's args aren't plain, they aren't checked */
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
/** Lints & formats a file's codes */
function checkText(text, codes, linter, formatter, alignToKey = true) {
    const starts = (0, text_1.lineStarts)(text);
    const problems = [];
    const edits = [];
    for (const embedded of codes) {
        problems.push(...(0, embedded_1.problemsInFile)(linter.lint(embedded.code), embedded, starts));
        edits.push(...(0, embedded_1.editsInFile)(text, embedded, formatter.edits(embedded.code, { ...embedded, alignToKey })));
    }
    const formatted = (0, Formatter_1.applyEdits)(text, edits);
    return {
        problems: problems.sort((a, b) => a.start - b.start || a.end - b.end),
        formatted: formatted === text ? undefined : formatted,
    };
}
/** A bot's files, checked together */
class Project {
    config;
    root;
    /** what failed to load. Shown, not fatal */
    notes = [];
    keys;
    loaded = null;
    /** set w/ `loaded` */
    forge = null;
    /**
     * @param root what cfg paths are relative to. Default the cwd
     * @throws on a bad cfg
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
    /** @returns how many files it wrote */
    static write(reports) {
        let written = 0;
        for (const report of reports) {
            if (report.formatted === undefined)
                continue;
            (0, node_fs_1.writeFileSync)(report.path, report.formatted, "utf8");
            written++;
        }
        return written;
    }
    /**
     * Fns code can call, minus the ones the files define: exts', FS's, the cfg's. Loaded once
     * @throws if ForgeScript isn't installed
     */
    get functions() {
        if (this.loaded)
            return this.loaded;
        const forgescript = (0, packages_1.findPackage)(packages_1.FORGESCRIPT, this.root);
        if (!forgescript) {
            throw new Error(`Can't find ${packages_1.FORGESCRIPT} from ${this.root}. ForgeLint reads its functions, so install it.`);
        }
        const registry = new FunctionRegistry_1.FunctionRegistry();
        const { Arg, ArgType } = require(forgescript);
        this.forge = { Arg, ArgType };
        const extensions = this.config.extensions === undefined ? (0, packages_1.extensionsOf)(this.root) : listOf(this.config.extensions);
        // like in `ForgeClient`: exts load 1st & keep their names
        for (const name of extensions) {
            const dir = (0, packages_1.findPackage)(name, this.root);
            if (dir)
                this.load(name, () => (0, packages_1.loadNatives)(dir, name, registry, ArgType));
            else
                this.notes.push(`Extension ${name} isn't installed, so its functions are unknown.`);
        }
        this.load("ForgeScript", () => (0, packages_1.loadNatives)((0, node_path_1.join)(forgescript, "dist", "native"), "ForgeScript", registry, ArgType));
        for (const dir of listOf(this.config.natives)) {
            this.load(dir, () => (0, packages_1.loadNatives)((0, node_path_1.resolve)(this.root, dir), dir, registry, ArgType));
        }
        for (const dir of listOf(this.config.functions)) {
            this.load(dir, () => (0, packages_1.loadCustomFunctions)((0, node_path_1.resolve)(this.root, dir), dir, registry, ArgType));
        }
        for (const name of listOf(this.config.known))
            registry.add(FunctionRegistry_1.FunctionRegistry.loose(name, "known"));
        return (this.loaded = registry);
    }
    /**
     * @param paths default the cfg's `include`, else the root
     * @returns every file to check, absolute & sorted
     * @throws if a path doesn't exist
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
     * Lints & formats every file
     * @param paths default the cfg's `include`, else the root
     * @throws if a path doesn't exist or ForgeScript isn't installed
     */
    check(paths) {
        const scanned = this.files(paths).map((path) => this.scan(path));
        // fns the files define count too
        const registry = new FunctionRegistry_1.FunctionRegistry(this.functions.functions);
        for (const { path, definitions } of scanned) {
            for (const definition of definitions)
                registry.add(infoOf(definition, shown(path, this.root), this.forge));
        }
        const linter = new Linter_1.Linter(registry, this.config.rules);
        const formatter = new Formatter_1.Formatter(registry, this.config.indent);
        return scanned.map(({ path, text, codes }) => ({
            path,
            file: shown(path, this.root),
            codes: codes.length,
            ...checkText(text, codes, linter, formatter, this.config.alignToKey ?? true),
        }));
    }
    scan(path) {
        const text = (0, node_fs_1.readFileSync)(path, "utf8");
        const { literals, definitions } = (0, script_1.scanScript)(text, this.keys);
        return { path, text, codes: literals.map((literal) => (0, embedded_1.cook)(text, literal)), definitions };
    }
    /** @param top `dist` & co. only get skipped here, `commands/docs` is fine */
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
    /** @returns whether the cfg's `exclude` names it, by name or path */
    excluded(path) {
        const file = shown(path, this.root);
        const name = file.split("/").at(-1);
        return listOf(this.config.exclude).some((pattern) => {
            const clean = pattern.replace(/^\.\//, "").replace(/\/+$/, "");
            return clean === name || clean === file || file.startsWith(`${clean}/`);
        });
    }
    /** @param loader returns why files failed */
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
            this.notes.push(`${(0, text_1.plural)(failures.length, "file")} of ${what} failed to load, so their functions are unknown. First: ${failures[0]}`);
        }
    }
}
exports.Project = Project;
//# sourceMappingURL=Project.js.map