import { FunctionRegistry } from "./FunctionRegistry";
/** Replace `start`..`end` w/ `text` */
export interface IEdit {
    start: number;
    end: number;
    text: string;
}
/** How the code sits in its file */
export interface IFormatOptions {
    /** real line break here? Default every `\n`. An escaped `\n` in a JS string isn't one */
    isLineBreak?: (index: number) => boolean;
    /** indentation of the line the code starts on, e.g. the `code:` line. Default none */
    indent?: string;
    /** top-level lines go 1 level deeper than `indent`, the closing line in line w/ it. Default `false` */
    alignToKey?: boolean;
}
/** @param edits mustn't overlap */
export declare function applyEdits(text: string, edits: IEdit[]): string;
/**
 * Formats ForgeScript w/o changing what it does: names get their declared case,
 * lines starting w/ a fn, `;` or `]` get indented by nesting. Text lines stay as written
 */
export declare class Formatter {
    readonly registry: FunctionRegistry;
    private readonly indent?;
    /** @param indent spaces per level or `"tab"`. Default whatever the code uses, else 4 */
    constructor(registry: FunctionRegistry, indent?: number | "tab" | undefined);
    format(code: string, options?: IFormatOptions): string;
    /** @returns the edits, in code order */
    edits(code: string, options?: IFormatOptions): IEdit[];
}
//# sourceMappingURL=Formatter.d.ts.map