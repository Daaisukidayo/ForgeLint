import { FunctionRegistry } from "./FunctionRegistry";
/** Replaces `start`..`end` with `text`. */
export interface IEdit {
    start: number;
    end: number;
    text: string;
}
/** How the code sits in its file. */
export interface IFormatOptions {
    /** Whether a real line break is here. Defaults to every `\n`. An escaped `\n` in a JavaScript string isn't one. */
    isLineBreak?: (index: number) => boolean;
    /**
     * The indentation of the line the code starts on, for example the `code:` line.
     * @default ""
     */
    indent?: string;
    /**
     * Top-level lines go one level deeper than `indent`, and the closing line lines up with it.
     * @default false
     */
    alignToKey?: boolean;
}
/** @param edits They mustn't overlap. */
export declare function applyEdits(text: string, edits: IEdit[]): string;
/**
 * Formats ForgeScript without changing what it does: names get their declared case,
 * and lines starting with a function, `;` or `]` get indented by nesting. Text lines stay as written.
 */
export declare class Formatter {
    readonly registry: FunctionRegistry;
    private readonly indent?;
    /** @param indent Spaces per level, or `"tab"`. Defaults to whatever the code uses, otherwise 4. */
    constructor(registry: FunctionRegistry, indent?: number | "tab" | undefined);
    format(code: string, options?: IFormatOptions): string;
    /** @returns The edits, in code order. */
    edits(code: string, options?: IFormatOptions): IEdit[];
}
//# sourceMappingURL=Formatter.d.ts.map