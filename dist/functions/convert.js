"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromArgCall = fromArgCall;
exports.fromNative = fromNative;
exports.fromCustom = fromCustom;
const forgescript_1 = require("@tryforge/forgescript");
const metadata_1 = require("./metadata");
/** @param type An `ArgType`, or its name, the way custom function parameters take it. */
const typeName = (type, argTypes) => (typeof type === "number" ? argTypes[type] : typeof type === "string" ? type : undefined) ?? "String";
const fromArg = (arg, argTypes) => ({
    name: arg.name,
    required: !!arg.required,
    rest: !!arg.rest,
    condition: !!arg.condition,
    type: typeName(arg.type, argTypes),
    // FS looks values up by key
    enum: arg.enum ? Object.keys(arg.enum).filter((key) => arg.enum[key] !== undefined) : undefined,
});
/**
 * Runs an `Arg.requiredString(...)` read from a file with the bot's ForgeScript `Arg`, for default names and types to match.
 * @returns `null` if `Arg` has no such helper or it throws.
 */
function fromArgCall(call, Arg, argTypes) {
    const helper = Arg[call.method];
    if (typeof helper !== "function")
        return null;
    try {
        // an enum it got is `undefined` here: its values just aren't checked
        return fromArg(helper.apply(Arg, call.values), argTypes);
    }
    catch {
        return null;
    }
}
/** @param argTypes The `ArgType` of the ForgeScript it's built with. Defaults to ForgeLint's. */
function fromNative(data, source, argTypes = forgescript_1.ArgType) {
    return (0, metadata_1.fromMetadata)({ ...data, args: data.args?.map((arg) => fromArg(arg, argTypes)) }, source);
}
/**
 * A custom function, built the way `ForgeFunction.asNative` builds it.
 * @param argTypes The `ArgType` of the ForgeScript it's for. Defaults to ForgeLint's.
 */
function fromCustom(data, source, argTypes = forgescript_1.ArgType) {
    const params = Array.isArray(data.params) ? data.params : [];
    const condition = !!data.firstParamCondition;
    return {
        name: `$${data.name}`,
        aliases: [],
        brackets: data.brackets ?? (params.length ? true : undefined),
        args: params.map((param, i) => {
            const { name, required, rest, type } = typeof param === "string" ? { name: param } : param;
            return {
                name,
                required: required ?? true,
                rest: !!rest,
                condition: i === 0 && condition,
                type: typeName(type, argTypes),
            };
        }),
        unwrap: params.length > 0 && !condition,
        deprecated: false,
        description: "Custom function",
        source,
        // it gets a copy of the caller's variables
        opaque: true,
    };
}
//# sourceMappingURL=convert.js.map