import { Formatter, IEdit } from "../structures/Formatter";
import { Linter } from "../structures/Linter";
import { IProblem } from "../types";
import { IEmbedded } from "./embedded";
export interface IScriptOptions {
    /**
     * Keys holding ForgeScript, like the config's.
     * @default ["code"]
     */
    properties?: string[];
    /**
     * Like the config's.
     * @default true
     */
    alignToKey?: boolean;
}
/** Lints and formats a file's codes. Offsets, lines and columns are the file's. */
export declare function checkText(text: string, codes: IEmbedded[], linter: Linter, formatter: Formatter, alignToKey?: boolean): {
    problems: IProblem[];
    edits: IEdit[];
    /** The file with its codes formatted, if that changes something. */
    formatted: string | undefined;
};
/** Lints and formats the ForgeScript in a JavaScript or TypeScript file's text, saved or not, for example in an editor. */
export declare function checkScript(text: string, linter: Linter, formatter: Formatter, options?: IScriptOptions): {
    problems: IProblem[];
    edits: IEdit[];
    /** The file with its codes formatted, if that changes something. */
    formatted: string | undefined;
};
//# sourceMappingURL=check.d.ts.map