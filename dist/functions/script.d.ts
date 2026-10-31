/** A string literal in a file. */
export interface ILiteral {
    /** Its text, quotes excluded. */
    start: number;
    end: number;
    /** `String.raw`: escapes stay as written. */
    raw: boolean;
    /** Its `${...}`s, from the `$` to after the `}`. */
    holes: Array<[number, number]>;
    /** For a command's `code`: its `type`, if that is a plain string. Its text, quotes excluded. */
    event?: {
        name: string;
        start: number;
        end: number;
    };
}
/** A custom function's parameter, as written. */
export interface IParam {
    name: string;
    required?: boolean;
    rest?: boolean;
    type?: string;
}
/** A native function's argument written as an object. Its `enum` is skipped: the values can't be read without running the code. */
export interface IArgObject {
    name: string;
    required: boolean;
    rest: boolean;
    condition: boolean;
    type: string;
}
/** `Arg.requiredString("name", ...)`. It gets run with the bot's ForgeScript `Arg` later. */
export interface IArgCall {
    method: string;
    /** Literals, `undefined` for anything else, like an enum. */
    values: Array<string | boolean | undefined>;
}
/** A function a file defines, read without running it. */
export interface IDefinition {
    /** Custom ones without the `$`, native ones with it. */
    name: string;
    kind: "native" | "custom";
    /** `null` if it's not a plain `true` or `false`. */
    brackets: boolean | undefined | null;
    /** A custom function's, `null` if not plain. */
    params: Array<string | IParam> | null;
    firstParamCondition: boolean;
    /** A native function's, `null` if not plain. */
    args?: Array<IArgObject | IArgCall> | null;
    /** A native function's, `null` if not plain. */
    unwrap?: boolean | null;
    aliases?: string[];
    deprecated?: boolean;
}
export interface IScriptScan {
    /** The values of the code keys. */
    literals: ILiteral[];
    definitions: IDefinition[];
}
/**
 * Finds ForgeScript in a JavaScript or TypeScript file without running it.
 * @param keys Keys holding ForgeScript, for example `code`.
 */
export declare function scanScript(source: string, keys: Set<string>): IScriptScan;
//# sourceMappingURL=script.d.ts.map