import { IFunctionInfo } from "../types";
interface IEntry {
    fn: IFunctionInfo;
    /** That name as declared, for example `$authorID`. */
    spelling: string;
}
export interface IFunctionMatch extends IEntry {
    /** The name's length without the `$`. */
    length: number;
}
/** The functions code can call. Matched like ForgeScript does it: in any case, the longest name wins. */
export declare class FunctionRegistry {
    /** Maps a lowercased name or alias to its entry. */
    private readonly entries;
    /** Name lengths without the `$`, longest first. `null` means recount. */
    private lengths;
    constructor(fns?: Iterable<IFunctionInfo>);
    /** A function known by name only, its arguments aren't checked. `brackets` works as in `IFunctionInfo`. */
    static loose(name: string, source: string, brackets?: boolean | undefined): IFunctionInfo;
    /**
     * The first function of a name stays, like in ForgeScript.
     * @param override Replace it instead, like custom functions do.
     * @returns Whether it got added.
     */
    add(fn: IFunctionInfo, override?: boolean): boolean;
    private remove;
    /** @param name With or without the `$`, in any case. Aliases work. */
    get(name: string): IFunctionInfo | undefined;
    /**
     * @param index Right after the `$` and its `!`, `#` or `@[...]`.
     * @returns The longest function whose name starts there.
     */
    match(code: string, index: number): IFunctionMatch | null;
    /** Every function once. */
    get functions(): IFunctionInfo[];
    /** @returns The closest name or alias, if it's close enough to be a typo. */
    suggest(name: string): string | undefined;
}
export {};
//# sourceMappingURL=FunctionRegistry.d.ts.map