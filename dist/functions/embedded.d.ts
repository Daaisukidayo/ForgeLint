import { IEdit } from "../structures/Formatter";
import { IProblem } from "../types";
import { ILiteral } from "./script";
/** ForgeScript inside a file. */
export interface IEmbedded {
    /** The code as ForgeScript gets it. */
    code: string;
    /** The file offset of each code character, plus the end's at `code.length`. */
    map: number[];
    /** Whether a real line break is here, not an escaped `\n`. */
    isLineBreak: (index: number) => boolean;
    /** The indentation of the file line the code starts on. */
    indent: string;
    /** How an escaped `]` is written here: `\\]` in a JavaScript string, `\]` in `String.raw`. */
    escapedBracket: string;
    /** Its command's `type`, as `ILiteral` has it. */
    event?: ILiteral["event"];
}
/** What a `${...}` reads as: no `$`, `[`, `]`, `;` or `\` to trip anything. */
export declare const HOLE: string;
/** @returns The indentation of the offset's line. */
export declare function indentAt(source: string, offset: number): string;
/** @returns The string JavaScript makes of a literal, with each `${...}` as one `HOLE`. */
export declare function cook(source: string, literal: ILiteral): IEmbedded;
/** @returns The problems with the file's offsets, lines and columns, and a `fix` for each `]` an escape fixes. */
export declare function problemsInFile(problems: IProblem[], embedded: IEmbedded, starts: number[]): IProblem[];
/** @returns The code's edits as file edits. Ones that would touch an escape are dropped. */
export declare function editsInFile(source: string, embedded: IEmbedded, edits: IEdit[]): IEdit[];
//# sourceMappingURL=embedded.d.ts.map