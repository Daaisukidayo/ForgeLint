/** A string literal in a file */
export interface ILiteral {
    /** its text, quotes excl. */
    start: number;
    end: number;
    /** `String.raw`: escapes stay as written */
    raw: boolean;
    /** `${...}`s, from `$` to after `}` */
    holes: Array<[number, number]>;
}
/** A custom fn's param, as written */
export interface IParam {
    name: string;
    required?: boolean;
    rest?: boolean;
    type?: string;
}
/** A native's arg written as an object. Its `enum` is skipped, the values can't be read w/o running the code */
export interface IArgObject {
    name: string;
    required: boolean;
    rest: boolean;
    condition: boolean;
    type: string;
}
/** `Arg.requiredString("name", ...)`. Gets run w/ the bot's FS `Arg` later */
export interface IArgCall {
    method: string;
    /** literals, `undefined` for anything else (like an enum) */
    values: Array<string | boolean | undefined>;
}
/** A fn a file defines, read w/o running it */
export interface IDefinition {
    /** custom ones w/o `$`, natives w/ */
    name: string;
    kind: "native" | "custom";
    /** `null` if it's not a plain `true`/`false` */
    brackets: boolean | undefined | null;
    /** a custom fn's, `null` if not plain */
    params: Array<string | IParam> | null;
    firstParamCondition: boolean;
    /** a native's, `null` if not plain */
    args?: Array<IArgObject | IArgCall> | null;
    /** a native's, `null` if not plain */
    unwrap?: boolean | null;
    aliases?: string[];
    deprecated?: boolean;
}
export interface IScriptScan {
    /** values of the code keys */
    literals: ILiteral[];
    definitions: IDefinition[];
}
/**
 * Finds ForgeScript in a JS/TS file w/o running it
 * @param keys keys holding ForgeScript, e.g. `code`
 */
export declare function scanScript(source: string, keys: Set<string>): IScriptScan;
//# sourceMappingURL=script.d.ts.map