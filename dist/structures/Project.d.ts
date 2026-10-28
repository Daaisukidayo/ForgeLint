import { IEmbedded } from "../functions/embedded";
import { IForgeLintConfig, IProblem } from "../types";
import { Formatter } from "./Formatter";
import { FunctionRegistry } from "./FunctionRegistry";
import { Linter } from "./Linter";
export interface IFileReport {
    /** absolute */
    path: string;
    /** relative to the root, `/`-separated */
    file: string;
    /** w/ the file's offsets, lines & columns */
    problems: IProblem[];
    /** codes in it */
    codes: number;
    /** the file w/ its codes formatted, if that changes smth */
    formatted?: string;
}
/** Lints & formats a file's codes */
export declare function checkText(text: string, codes: IEmbedded[], linter: Linter, formatter: Formatter, alignToKey?: boolean): {
    problems: IProblem[];
    formatted: string | undefined;
};
/** A bot's files, checked together */
export declare class Project {
    readonly config: IForgeLintConfig;
    readonly root: string;
    /** what failed to load. Shown, not fatal */
    readonly notes: string[];
    private readonly keys;
    private loaded;
    /** set w/ `loaded` */
    private forge;
    /**
     * @param root what cfg paths are relative to. Default the cwd
     * @throws on a bad cfg
     */
    constructor(config?: IForgeLintConfig, root?: string);
    /** @returns how many files it wrote */
    static write(reports: IFileReport[]): number;
    /**
     * Fns code can call, minus the ones the files define: exts', FS's, the cfg's. Loaded once
     * @throws if ForgeScript isn't installed
     */
    get functions(): FunctionRegistry;
    /**
     * @param paths default the cfg's `include`, else the root
     * @returns every file to check, absolute & sorted
     * @throws if a path doesn't exist
     */
    files(paths?: string[]): string[];
    /**
     * Lints & formats every file
     * @param paths default the cfg's `include`, else the root
     * @throws if a path doesn't exist or ForgeScript isn't installed
     */
    check(paths?: string[]): IFileReport[];
    private scan;
    /** @param top `dist` & co. only get skipped here, `commands/docs` is fine */
    private walk;
    /** @returns whether the cfg's `exclude` names it, by name or path */
    private excluded;
    /** @param loader returns why files failed */
    private load;
}
//# sourceMappingURL=Project.d.ts.map