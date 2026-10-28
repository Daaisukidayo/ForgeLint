"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromArgCall = fromArgCall;
exports.fromNative = fromNative;
exports.fromCustom = fromCustom;
const forgescript_1 = require("@tryforge/forgescript");
/** @param type an `ArgType`, or its name like custom fn params take it */
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
 * Runs an `Arg.requiredString(...)` read from a file w/ the bot's FS `Arg`, so default names & types match
 * @returns `null` if `Arg` has no such helper or it throws
 */
function fromArgCall(call, Arg, argTypes) {
    const helper = Arg[call.method];
    if (typeof helper !== "function")
        return null;
    try {
        // an enum it got is `undefined` here, so its values just aren't checked
        return fromArg(helper.apply(Arg, call.values), argTypes);
    }
    catch {
        return null;
    }
}
/** @param argTypes the `ArgType` of the FS it's built w/. Default ForgeLint's */
function fromNative(data, source, argTypes = forgescript_1.ArgType) {
    const args = data.args ?? [];
    return {
        name: data.name,
        aliases: (data.aliases ?? []).filter((alias) => typeof alias === "string"),
        brackets: data.brackets,
        args: args.map((arg) => fromArg(arg, argTypes)),
        // FS turns it off w/o args
        unwrap: !!data.unwrap && args.length > 0,
        deprecated: !!data.deprecated,
        description: data.description ?? "",
        source,
    };
}
/**
 * A custom fn, built the way `ForgeFunction.asNative` builds it
 * @param argTypes the `ArgType` of the FS it's for. Default ForgeLint's
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
    };
}
//# sourceMappingURL=convert.js.map