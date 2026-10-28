import { IFunctionInfo } from "../types";
interface IEntry {
    fn: IFunctionInfo;
    /** that name as declared, e.g. `$authorID` */
    spelling: string;
}
export interface IFunctionMatch extends IEntry {
    /** name length w/o `$` */
    length: number;
}
/** The fns code can call. Matched like FS does it: any case, longest name wins */
export declare class FunctionRegistry {
    /** lowercased name/alias → entry */
    private readonly entries;
    /** name lengths w/o `$`, longest 1st. `null` = recount */
    private lengths;
    constructor(fns?: Iterable<IFunctionInfo>);
    /** A fn known by name only, its args aren't checked. `brackets` as in `IFunctionInfo` */
    static loose(name: string, source: string, brackets?: boolean | undefined): IFunctionInfo;
    /**
     * 1st fn of a name stays, like in FS
     * @param override replace it instead, like custom fns do
     * @returns whether it got added
     */
    add(fn: IFunctionInfo, override?: boolean): boolean;
    private remove;
    /** @param name w/ or w/o `$`, any case, aliases work */
    get(name: string): IFunctionInfo | undefined;
    /**
     * @param index right after the `$` & its `!`, `#`, `@[...]`
     * @returns the longest fn whose name starts there
     */
    match(code: string, index: number): IFunctionMatch | null;
    /** every fn once */
    get functions(): IFunctionInfo[];
    /** @returns closest name/alias, if it's close enough to be a typo */
    suggest(name: string): string | undefined;
}
export {};
//# sourceMappingURL=FunctionRegistry.d.ts.map