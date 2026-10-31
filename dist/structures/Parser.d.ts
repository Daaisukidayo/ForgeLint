import { IFunctionInfo, Rule } from "../types";
import { FunctionRegistry } from "./FunctionRegistry";
/** A call's argument. */
export interface IField {
    start: number;
    /** The offset of the `;` or `]` after it, or the code's length if unclosed. */
    end: number;
    /** The functions right inside it. */
    calls: ICall[];
    /** Its text with escapes resolved, `null` if a function is inside. */
    literal: string | null;
}
/** A function call in code. */
export interface ICall {
    fn: IFunctionInfo;
    /** The name as declared, for example `$authorID` for `$AUTHORID`. */
    spelling: string;
    /** The `$`. */
    start: number;
    /** The name without `!`, `#` and `@[...]`. */
    nameStart: number;
    nameEnd: number;
    /** The `[`, `null` without brackets. */
    open: number | null;
    /** The `]`, `null` without brackets or when unclosed. */
    close: number | null;
    /** The `;`s between fields. */
    separators: number[];
    fields: IField[];
    /** Right after it. */
    end: number;
}
/** A problem before it gets a severity and a position. */
export interface IFinding {
    rule: Rule;
    message: string;
    start: number;
    end: number;
    /** ForgeScript won't compile the code. */
    fatal?: boolean;
}
export interface IParsed {
    /** Top-level calls. */
    calls: ICall[];
    /** Syntax problems. */
    findings: IFinding[];
}
/** @returns The calls and all calls nested in them, in code order. */
export declare function flatten(calls: ICall[]): ICall[];
/**
 * Reads ForgeScript like the ForgeScript compiler does, but doesn't stop at the first problem.
 * Code that compiles comes out as the same calls and fields.
 */
export declare class Parser {
    private readonly code;
    private readonly registry;
    private readonly escaped;
    private index;
    private readonly findings;
    /** `suggest` is the slow part: a name gets it once. */
    private readonly guesses;
    private constructor();
    /** @param escaped How an escaped `]` is written where the code lives, for example `\\]` in a JavaScript string. */
    static parse(code: string, registry: FunctionRegistry, escaped?: string): IParsed;
    private top;
    /** At a `$`: reads the call, or reports an unknown name and steps over the `$`. */
    private call;
    /** Reads a field up to its `;` or `]` and stops there. */
    private field;
    /** ForgeScript won't compile fields past the last argument. */
    private tooMany;
    /** @param read The function ForgeScript reads instead, glued to the rest. It needs brackets: it won't compile. */
    private unknown;
    private find;
}
//# sourceMappingURL=Parser.d.ts.map