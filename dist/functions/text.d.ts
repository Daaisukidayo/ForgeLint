import { IFunctionInfo } from "../types";
/** @returns offset of each line's start, 1st is 0 */
export declare function lineStarts(text: string, isLineBreak?: (index: number) => boolean): number[];
/**
 * @param starts from `lineStarts`
 * @returns 1-based line & column
 */
export declare function locate(starts: number[], offset: number): {
    line: number;
    column: number;
};
/** Levenshtein + swapping 2 neighbors. Bails w/ `max + 1` once it's over `max` */
export declare function distance(a: string, b: string, max: number): number;
/** @returns e.g. `$sendMessage[channel ID;content?;return message ID?]` */
export declare function signature(fn: IFunctionInfo): string;
/** @returns `1 argument`, `2 arguments` */
export declare const plural: (count: number, word: string) => string;
//# sourceMappingURL=text.d.ts.map