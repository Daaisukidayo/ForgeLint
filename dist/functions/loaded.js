"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadedFunctions = loadedFunctions;
exports.rulesOf = rulesOf;
const forgescript_1 = require("@tryforge/forgescript");
const node_path_1 = require("node:path");
const FunctionRegistry_1 = require("../structures/FunctionRegistry");
const convert_1 = require("./convert");
const packages_1 = require("./packages");
/** The last registry and the functions it was built from. */
let cache = null;
/** Where ForgeScript loads its own native functions from. */
const NATIVES = (0, node_path_1.join)((0, node_path_1.dirname)(require.resolve("@tryforge/forgescript")), "native") + node_path_1.sep;
/** Maps a package folder to whether it runs code with the caller's context. */
const callers = new Map();
/** @returns Whether a loaded function may run code ForgeLint can't see with the caller's variables. */
function opaque(fn) {
    // custom fns have no `path`
    if (!fn.path)
        return true;
    if (fn.path.startsWith(NATIVES))
        return false;
    const dir = (0, packages_1.projectRoot)((0, node_path_1.dirname)(fn.path));
    if (!callers.has(dir))
        callers.set(dir, (0, packages_1.touchesCaller)(dir));
    return callers.get(dir);
}
/** @returns Every function ForgeScript has loaded right now: its own, the extensions' and custom ones. It's rebuilt when they change. */
function loadedFunctions() {
    const functions = [...forgescript_1.FunctionManager["Functions"].values()];
    if (!cache || cache.functions.length !== functions.length || cache.functions.some((fn, i) => fn !== functions[i])) {
        const infos = functions.map((fn) => ({ ...(0, convert_1.fromNative)(fn.data, "loaded"), opaque: opaque(fn) }));
        cache = { functions, registry: new FunctionRegistry_1.FunctionRegistry(infos) };
    }
    return cache.registry;
}
/** @returns The rules of the client's ForgeLint, if it has one. */
function rulesOf(client) {
    const extension = client.options.extensions?.find((ext) => ext.name === "ForgeLint");
    return extension?.options?.rules;
}
//# sourceMappingURL=loaded.js.map