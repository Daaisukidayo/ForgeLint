"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadedFunctions = loadedFunctions;
exports.rulesOf = rulesOf;
const forgescript_1 = require("@tryforge/forgescript");
const FunctionRegistry_1 = require("../structures/FunctionRegistry");
const convert_1 = require("./convert");
/** last registry & the fns it's built from */
let cache = null;
/** @returns every fn FS has loaded rn: its own, exts', custom ones. Rebuilt when they change */
function loadedFunctions() {
    const functions = [...forgescript_1.FunctionManager["Functions"].values()];
    if (!cache || cache.functions.length !== functions.length || cache.functions.some((fn, i) => fn !== functions[i])) {
        cache = { functions, registry: new FunctionRegistry_1.FunctionRegistry(functions.map((fn) => (0, convert_1.fromNative)(fn.data, "loaded"))) };
    }
    return cache.registry;
}
/** @returns the rules the client's ForgeLint got, if it has one */
function rulesOf(client) {
    const extension = client.options.extensions?.find((ext) => ext.name === "ForgeLint");
    return extension?.options?.rules;
}
//# sourceMappingURL=loaded.js.map