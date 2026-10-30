import { ArgType, IArg, IForgeFunction, IForgeFunctionParam, INativeFunction } from "@tryforge/forgescript"
import { IFunctionArg, IFunctionInfo } from "../types"
import { fromMetadata } from "./metadata"
import { IArgCall } from "./script"

/** `ArgType` names by number. */
export type ArgTypes = Record<number, string>

/** @param type An `ArgType`, or its name, the way custom function parameters take it. */
const typeName = (type: unknown, argTypes: ArgTypes) =>
    (typeof type === "number" ? argTypes[type] : typeof type === "string" ? type : undefined) ?? "String"

const fromArg = (arg: IArg, argTypes: ArgTypes): IFunctionArg => ({
    name: arg.name,
    required: !!arg.required,
    rest: !!arg.rest,
    condition: !!arg.condition,
    type: typeName(arg.type, argTypes),
    // FS looks values up by key
    enum: arg.enum ? Object.keys(arg.enum).filter((key) => arg.enum![key] !== undefined) : undefined,
})

/**
 * Runs an `Arg.requiredString(...)` read from a file with the bot's ForgeScript `Arg`, for default names and types to match.
 * @returns `null` if `Arg` has no such helper or it throws.
 */
export function fromArgCall(call: IArgCall, Arg: Record<string, unknown>, argTypes: ArgTypes): IFunctionArg | null {
    const helper = Arg[call.method]
    if (typeof helper !== "function") return null

    try {
        // an enum it got is `undefined` here: its values just aren't checked
        return fromArg(helper.apply(Arg, call.values), argTypes)
    } catch {
        return null
    }
}

/** @param argTypes The `ArgType` of the ForgeScript it's built with. Defaults to ForgeLint's. */
export function fromNative(data: INativeFunction<IArg[]>, source: string, argTypes: ArgTypes = ArgType): IFunctionInfo {
    return fromMetadata({ ...data, args: data.args?.map((arg) => fromArg(arg, argTypes)) }, source)
}

/**
 * A custom function, built the way `ForgeFunction.asNative` builds it.
 * @param argTypes The `ArgType` of the ForgeScript it's for. Defaults to ForgeLint's.
 */
export function fromCustom(data: IForgeFunction, source: string, argTypes: ArgTypes = ArgType): IFunctionInfo {
    const params = Array.isArray(data.params) ? data.params : []
    const condition = !!data.firstParamCondition

    return {
        name: `$${data.name}`,
        aliases: [],
        brackets: data.brackets ?? (params.length ? true : undefined),
        args: params.map((param, i) => {
            const { name, required, rest, type }: IForgeFunctionParam =
                typeof param === "string" ? { name: param } : param

            return {
                name,
                required: required ?? true,
                rest: !!rest,
                condition: i === 0 && condition,
                type: typeName(type, argTypes),
            }
        }),
        unwrap: params.length > 0 && !condition,
        deprecated: false,
        description: "Custom function",
        source,
        // it gets a copy of the caller's variables
        opaque: true,
    }
}
