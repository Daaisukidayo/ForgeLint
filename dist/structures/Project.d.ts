import { IForgeLintConfig, IProblem } from "../types";
import { FunctionRegistry } from "./FunctionRegistry";
export interface IFileReport {
    /** Absolute. */
    path: string;
    /** Relative to the root, `/`-separated. */
    file: string;
    /** With the file's offsets, lines and columns. */
    problems: IProblem[];
    /** The codes in it. */
    codes: number;
    /** The file with its codes formatted, if that changes something. */
    formatted?: string;
}
/** A bot's files, checked together. */
export declare class Project {
    readonly config: IForgeLintConfig;
    readonly root: string;
    /** What failed to load. Shown, not fatal. */
    readonly notes: string[];
    private readonly keys;
    private loaded;
    /** Set with `loaded`. */
    private forge;
    /** What a command's `type` can be, set with `loaded`. `undefined` means unchecked: the events of ForgeScript itself couldn't be read. */
    private events?;
    /**
     * @param root What config paths are relative to. Defaults to the current folder.
     * @throws On a bad config.
     */
    constructor(config?: IForgeLintConfig, root?: string);
    /** @returns How many files it wrote. */
    static write(reports: IFileReport[]): number;
    /**
     * The functions code can call, minus the ones the files define: the extensions', ForgeScript's and the config's. Loaded once.
     * @throws If ForgeScript isn't installed.
     */
    get functions(): FunctionRegistry;
    /**
     * @param paths Defaults to the config's `include`, otherwise the root.
     * @returns Every file to check, absolute and sorted.
     * @throws If a path doesn't exist.
     */
    files(paths?: string[]): string[];
    /**
     * Lints and formats every file.
     * @param paths Defaults to the config's `include`, otherwise the root.
     * @param brackets Also escape each `]` a problem has a `fix` for, in `formatted`. The problems are then the fixed text's.
     * @throws If a path doesn't exist or ForgeScript isn't installed.
     */
    check(paths?: string[], brackets?: boolean): IFileReport[];
    private scan;
    /** @param top Only here do `dist` and the like get skipped: `commands/docs` is fine. */
    private walk;
    /** @returns Whether the config's `exclude` names it, by name or path. */
    private excluded;
    /** @param loader Returns why files failed. */
    private load;
}
//# sourceMappingURL=Project.d.ts.map