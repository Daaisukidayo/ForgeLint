import { closest } from "../functions/text"
import { IFunctionInfo } from "../types"

interface IEntry {
    fn: IFunctionInfo
    /** That name as declared, for example `$authorID`. */
    spelling: string
}

export interface IFunctionMatch extends IEntry {
    /** The name's length without the `$`. */
    length: number
}

const keyOf = (name: string) => (name.startsWith("$") ? name : `$${name}`).toLowerCase()

/** The functions code can call. Matched like ForgeScript does it: in any case, the longest name wins. */
export class FunctionRegistry {
    /** Maps a lowercased name or alias to its entry. */
    private readonly entries = new Map<string, IEntry>()
    /** Name lengths without the `$`, longest first. `null` means recount. */
    private lengths: number[] | null = null

    public constructor(fns: Iterable<IFunctionInfo> = []) {
        for (const fn of fns) this.add(fn)
    }

    /** A function known by name only, its arguments aren't checked. `brackets` works as in `IFunctionInfo`. */
    public static loose(name: string, source: string, brackets: boolean | undefined = false): IFunctionInfo {
        return {
            name: name.startsWith("$") ? name : `$${name}`,
            aliases: [],
            brackets,
            args: [],
            unwrap: false,
            deprecated: false,
            description: "",
            source,
            loose: true,
            // what it runs is unknown too
            opaque: true,
        }
    }

    /**
     * The first function of a name stays, like in ForgeScript.
     * @param override Replace it instead, like custom functions do.
     * @returns Whether it got added.
     */
    public add(fn: IFunctionInfo, override = false) {
        const key = keyOf(fn.name)
        const taken = this.entries.get(key)

        if (taken && keyOf(taken.fn.name) === key) {
            if (!override) return false
            this.remove(taken.fn)
        }

        this.entries.set(key, { fn, spelling: fn.name })
        for (const alias of fn.aliases) {
            if (!this.entries.has(keyOf(alias))) this.entries.set(keyOf(alias), { fn, spelling: alias })
        }

        this.lengths = null
        return true
    }

    private remove(fn: IFunctionInfo) {
        for (const [key, entry] of this.entries) if (entry.fn === fn) this.entries.delete(key)
    }

    /** @param name With or without the `$`, in any case. Aliases work. */
    public get(name: string) {
        return this.entries.get(keyOf(name))?.fn
    }

    /**
     * @param index Right after the `$` and its `!`, `#` or `@[...]`.
     * @returns The longest function whose name starts there.
     */
    public match(code: string, index: number): IFunctionMatch | null {
        this.lengths ??= [...new Set([...this.entries.keys()].map((key) => key.length - 1))].sort((a, b) => b - a)

        for (const length of this.lengths) {
            if (index + length > code.length) continue

            const entry = this.entries.get(`$${code.slice(index, index + length).toLowerCase()}`)
            if (entry) return { ...entry, length }
        }

        return null
    }

    /** Every function once. */
    public get functions() {
        return [...new Set([...this.entries.values()].map((entry) => entry.fn))]
    }

    /** @returns The closest name or alias, if it's close enough to be a typo. */
    public suggest(name: string) {
        const key = closest(name, this.entries.keys())
        return key && this.entries.get(key)!.spelling
    }
}
