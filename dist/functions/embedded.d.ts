import { IEdit } from "../structures/Formatter";
import { IProblem } from "../types";
import { ILiteral } from "./script";
/** ForgeScript inside a file */
export interface IEmbedded {
    /** as FS gets it */
    code: string;
    /** file offset of each code char, + the end's at `code.length` */
    map: number[];
    /** real line break here, not an escaped `\n`? */
    isLineBreak: (index: number) => boolean;
    /** indentation of the file line the code starts on */
    indent: string;
    /** how an escaped `]` is written here: `\\]` in a JS string, `\]` in `String.raw` */
    escapedBracket: string;
}
/** what a `${...}` reads as: no `$`, `[`, `]`, `;` or `\` to trip anything */
export declare const HOLE: string;
/** @returns indentation of the offset's line */
export declare function indentAt(source: string, offset: number): string;
/** Builds code from a file's chars, remembering where each came from */
export declare class CodeBuilder {
    private readonly source;
    private code;
    private readonly map;
    constructor(source: string);
    /** @param at file offset `text` comes from */
    push(text: string, at: number): void;
    /**
     * @param end file offset the code ends at
     * @param start file offset it starts at, for its indentation
     * @param raw `String.raw`, so a `\` is written as is
     */
    build(end: number, start: number, raw: boolean): IEmbedded;
}
/** @returns the string JS makes of a literal, w/ each `${...}` as 1 `HOLE` */
export declare function cook(source: string, literal: ILiteral): IEmbedded;
/** @returns the problems w/ the file's offsets, lines & columns */
export declare function problemsInFile(problems: IProblem[], embedded: IEmbedded, starts: number[]): IProblem[];
/** @returns the code's edits as file edits. Ones that'd touch an escape are dropped */
export declare function editsInFile(source: string, embedded: IEmbedded, edits: IEdit[]): IEdit[];
//# sourceMappingURL=embedded.d.ts.map