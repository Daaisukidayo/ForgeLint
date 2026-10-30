import { IArg, IForgeFunction, INativeFunction } from "@tryforge/forgescript";
import { IFunctionArg, IFunctionInfo } from "../types";
import { IArgCall } from "./script";
/** `ArgType` names by number. */
export type ArgTypes = Record<number, string>;
/**
 * Runs an `Arg.requiredString(...)` read from a file with the bot's ForgeScript `Arg`, for default names and types to match.
 * @returns `null` if `Arg` has no such helper or it throws.
 */
export declare function fromArgCall(call: IArgCall, Arg: Record<string, unknown>, argTypes: ArgTypes): IFunctionArg | null;
/** @param argTypes The `ArgType` of the ForgeScript it's built with. Defaults to ForgeLint's. */
export declare function fromNative(data: INativeFunction<IArg[]>, source: string, argTypes?: ArgTypes): IFunctionInfo;
/**
 * A custom function, built the way `ForgeFunction.asNative` builds it.
 * @param argTypes The `ArgType` of the ForgeScript it's for. Defaults to ForgeLint's.
 */
export declare function fromCustom(data: IForgeFunction, source: string, argTypes?: ArgTypes): IFunctionInfo;
//# sourceMappingURL=convert.d.ts.map