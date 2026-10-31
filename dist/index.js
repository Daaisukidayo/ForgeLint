"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadedFunctions = exports.fromMetadata = exports.fromNative = exports.fromCustom = exports.checkText = exports.checkScript = exports.LintOutput = exports.defineConfig = exports.ForgeLint = void 0;
const forgescript_1 = require("@tryforge/forgescript");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const package_json_1 = require("../package.json");
const embedded_1 = require("./functions/embedded");
const loaded_1 = require("./functions/loaded");
const script_1 = require("./functions/script");
const text_1 = require("./functions/text");
const structures_1 = require("./structures");
const CODE_KEYS = new Set(["code"]);
/** @returns Every code the client runs: commands, extensions' commands, slash commands and custom functions. */
function codesOf(client) {
    const found = [];
    const add = (data, label, event) => {
        if (typeof data?.code !== "string" || !data.code)
            return;
        found.push({ code: data.code, path: typeof data.path === "string" ? data.path : null, label, event });
    };
    const managers = [client.commands, ...(client.options.extensions ?? []).map((ext) => ext.getCommandManager?.())];
    for (const manager of managers) {
        // what its handler loaded. An ext may load them only when it's told to listen to some
        const events = new Set(Object.keys(forgescript_1.EventManager.Loaded?.[manager?.handlerName ?? ""] ?? {}));
        for (const command of manager?.toArray() ?? []) {
            const { type, name } = command.data;
            add(command.data, `${type} command ${name ?? ""}`.trim(), { type, events });
        }
    }
    // slash cmds nest by subcommand group. Private fields: older FS versions may lack them
    const walk = (value) => {
        if (value instanceof Map)
            for (const inner of value.values())
                walk(inner);
        else if (value) {
            const command = value;
            add(command.options, `slash command ${command.name ?? ""}`.trim());
        }
    };
    walk(client.applicationCommands?.["commands"]);
    const functions = client.functions?.["functions"];
    for (const fn of functions?.values() ?? [])
        add(fn.data, `function $${fn.data.name}`);
    return found;
}
class ForgeLint extends forgescript_1.ForgeExtension {
    options;
    name = "ForgeLint";
    description = package_json_1.description;
    version = package_json_1.version;
    // natives are global, a 2nd client would only warn about overrides
    static loaded = false;
    /** @throws On an unknown rule or setting. */
    constructor(options = {}) {
        super();
        this.options = options;
        (0, structures_1.validateRules)(options.rules);
        if (options.stopOnError && options.check === false) {
            console.warn("ForgeLint: stopOnError does nothing while check is false, the bot logs in anyway.");
        }
    }
    /** @throws If the client has none. */
    static of(client) {
        return client.getExtension(ForgeLint, true);
    }
    init(client) {
        if (!ForgeLint.loaded) {
            this.load(node_path_1.default.resolve(__dirname, "native"));
            ForgeLint.loaded = true;
        }
        if (this.options.check === false)
            return;
        // cmds load after exts init, but before login
        const login = client.login.bind(client);
        client.login = (token) => {
            const errors = this.report(client);
            if (errors && this.options.stopOnError) {
                return Promise.reject(new Error(`ForgeLint found ${(0, text_1.plural)(errors, "error")}. The bot won't log in`));
            }
            return login(token);
        };
    }
    /**
     * Lints every command, slash command and custom function the client has.
     * @returns A report per file, or per code without one. Positions are the file's when the code is found in it.
     */
    check(client) {
        const linter = new structures_1.Linter((0, loaded_1.loadedFunctions)(), this.options.rules);
        const files = new Map();
        const reports = new Map();
        // 2 cmds w/ the same code in 1 file get 1 literal each
        const used = new Set();
        for (const { code, path: file, label, event } of codesOf(client)) {
            const full = file ? node_path_1.default.resolve(file) : null;
            const source = full ? this.read(files, full) : null;
            const embedded = source?.codes.find((candidate) => candidate.code === code && !used.has(candidate));
            if (embedded)
                used.add(embedded);
            const key = embedded ? full : label;
            const report = reports.get(key) ?? {
                path: full ?? "",
                file: embedded ? node_path_1.default.relative(process.cwd(), full).split(node_path_1.default.sep).join("/") : label,
                problems: [],
                codes: 0,
            };
            const starts = embedded ? (0, text_1.lineStarts)(source.text) : [0];
            const found = event && linter.lintEvent(event.type, event.events);
            if (found) {
                // the `type` in the file, else where the code starts
                const start = embedded?.event?.start ?? embedded?.map[0] ?? 0;
                report.problems.push({ ...found, start, end: embedded?.event?.end ?? start, ...(0, text_1.locate)(starts, start) });
            }
            // not in a file = can't tell if it was a JS string
            const problems = linter.lint(code, embedded?.escapedBracket ?? "\\] (\\\\] in a JS string)");
            report.problems.push(...(embedded ? (0, embedded_1.problemsInFile)(problems, embedded, starts) : problems));
            report.codes++;
            reports.set(key, report);
        }
        return [...reports.values()];
    }
    /** @returns A file's codes, read once. */
    read(files, file) {
        if (!files.has(file)) {
            let codes = null;
            try {
                const text = (0, node_fs_1.readFileSync)(file, "utf8");
                codes = { text, codes: (0, script_1.scanScript)(text, CODE_KEYS).literals.map((literal) => (0, embedded_1.cook)(text, literal)) };
            }
            catch {
                // no file = positions stay the code's
            }
            files.set(file, codes);
        }
        return files.get(file);
    }
    /** @returns How many errors it found, 0 when it couldn't check. */
    report(client) {
        const reporter = new structures_1.Reporter();
        try {
            return reporter.print(this.check(client), (0, loaded_1.loadedFunctions)().functions.length);
        }
        catch (error) {
            console.error("ForgeLint could not check the code:", error);
            return 0;
        }
    }
}
exports.ForgeLint = ForgeLint;
/** For editor autocomplete: `module.exports = defineConfig({ ... })`. */
const defineConfig = (config) => config;
exports.defineConfig = defineConfig;
__exportStar(require("./structures"), exports);
__exportStar(require("./types"), exports);
var output_1 = require("./properties/output");
Object.defineProperty(exports, "LintOutput", { enumerable: true, get: function () { return output_1.LintOutput; } });
var check_1 = require("./functions/check");
Object.defineProperty(exports, "checkScript", { enumerable: true, get: function () { return check_1.checkScript; } });
Object.defineProperty(exports, "checkText", { enumerable: true, get: function () { return check_1.checkText; } });
var convert_1 = require("./functions/convert");
Object.defineProperty(exports, "fromCustom", { enumerable: true, get: function () { return convert_1.fromCustom; } });
Object.defineProperty(exports, "fromNative", { enumerable: true, get: function () { return convert_1.fromNative; } });
var metadata_1 = require("./functions/metadata");
Object.defineProperty(exports, "fromMetadata", { enumerable: true, get: function () { return metadata_1.fromMetadata; } });
var loaded_2 = require("./functions/loaded");
Object.defineProperty(exports, "loadedFunctions", { enumerable: true, get: function () { return loaded_2.loadedFunctions; } });
//# sourceMappingURL=index.js.map