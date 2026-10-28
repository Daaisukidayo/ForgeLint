import { IFunctionInfo, Rule } from "../types";
import { FunctionRegistry } from "./FunctionRegistry";
/** A call's arg */
export interface IField {
    start: number;
    /** offset of the `;`/`]` after it, or the code's length if unclosed */
    end: number;
    /** fns right inside it */
    calls: ICall[];
    /** its text w/ escapes resolved, `null` if a fn's inside */
    literal: string | null;
}
/** A fn call in code */
export interface ICall {
    fn: IFunctionInfo;
    /** name as declared, e.g. `$authorID` for `$AUTHORID` */
    spelling: string;
    /** the `$` */
    start: number;
    /** the name w/o `!`, `#`, `@[...]` */
    nameStart: number;
    nameEnd: number;
    /** `[`, `null` w/o brackets */
    open: number | null;
    /** `]`, `null` w/o brackets or unclosed */
    close: number | null;
    /** the `;`s between fields */
    separators: number[];
    fields: IField[];
    /** right after it */
    end: number;
}
/** A problem before it gets a severity & position */
export interface IFinding {
    rule: Rule;
    message: string;
    start: number;
    end: number;
    /** FS won't compile the code */
    fatal?: boolean;
}
export interface IParsed {
    /** top-level calls */
    calls: ICall[];
    /** syntax problems */
    findings: IFinding[];
}
/** @returns the calls & all calls nested in them, in code order */
export declare function flatten(calls: ICall[]): ICall[];
/**
 * Reads ForgeScript like FS's compiler does, but doesn't bail on the 1st problem.
 * Code that compiles comes out as the same calls & fields
 */
export declare class Parser {
    private readonly code;
    private readonly registry;
    private readonly escaped;
    private index;
    private readonly findings;
    /** `suggest` is the slow bit, so a name gets it once */
    private readonly guesses;
    private constructor();
    /** @param escaped how an escaped `]` is written where the code lives, e.g. `\\]` in a JS string */
    static parse(code: string, registry: FunctionRegistry, escaped?: string): IParsed;
    private top;
    /** At a `$`: reads the call, or reports an unknown name & steps over the `$` */
    private call;
    /** Reads a field up to its `;`/`]` & stops there */
    private field;
    /** FS won't compile fields past the last arg */
    private tooMany;
    /** @param read the fn FS reads instead, glued to the rest. It needs brackets, so it won't compile */
    private unknown;
    private find;
}
//# sourceMappingURL=Parser.d.ts.map