import { IArg, IForgeFunction, INativeFunction } from "@tryforge/forgescript";
import { IFunctionArg, IFunctionInfo } from "../types";
import { IArgCall } from "./script";
/** `ArgType`: name by number */
export type ArgTypes = Record<number, string>;
/**
 * Runs an `Arg.requiredString(...)` read from a file w/ the bot's FS `Arg`, so default names & types match
 * @returns `null` if `Arg` has no such helper or it throws
 */
export declare function fromArgCall(call: IArgCall, Arg: Record<string, unknown>, argTypes: ArgTypes): IFunctionArg | null;
/** @param argTypes the `ArgType` of the FS it's built w/. Default ForgeLint's */
export declare function fromNative(data: INativeFunction<IArg[]>, source: string, argTypes?: ArgTypes): IFunctionInfo;
/**
 * A custom fn, built the way `ForgeFunction.asNative` builds it
 * @param argTypes the `ArgType` of the FS it's for. Default ForgeLint's
 */
export declare function fromCustom(data: IForgeFunction, source: string, argTypes?: ArgTypes): IFunctionInfo;
//# sourceMappingURL=convert.d.ts.map