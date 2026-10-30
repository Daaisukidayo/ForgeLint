import { IFunctionInfo, IProblem } from "../types";
/** @returns The problem without its offsets, for output. */
export declare function brief(problem: IProblem): {
    rule: import("../types").Rule;
    severity: import("../types").Severity;
    message: string;
    line: number;
    column: number;
};
/** @returns The offset of each line's start. The first one is 0. */
export declare function lineStarts(text: string, isLineBreak?: (index: number) => boolean): number[];
/**
 * @param starts From `lineStarts`.
 * @returns The line and column, both starting at 1.
 */
export declare function locate(starts: number[], offset: number): {
    line: number;
    column: number;
};
/** Levenshtein distance, plus swapping two neighbors. Stops with `max + 1` once it's over `max`. */
export declare function distance(a: string, b: string, max: number): number;
/** @returns The closest of `names`, if it's close enough to be a typo. Case doesn't count. */
export declare function closest(name: string, names: Iterable<string>): string | undefined;
/**
 * @param name For example the alias the code used. Defaults to its own name.
 * @returns For example `$sendMessage[channel ID;content?;return message ID?]`.
 */
export declare function signature(fn: IFunctionInfo, name?: string): string;
/** @returns For example `1 argument` or `2 arguments`. */
export declare const plural: (count: number, word: string) => string;
//# sourceMappingURL=text.d.ts.map