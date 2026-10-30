"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionRegistry = void 0;
const text_1 = require("../functions/text");
const keyOf = (name) => (name.startsWith("$") ? name : `$${name}`).toLowerCase();
/** The functions code can call. Matched like ForgeScript does it: in any case, the longest name wins. */
class FunctionRegistry {
    /** Maps a lowercased name or alias to its entry. */
    entries = new Map();
    /** Name lengths without the `$`, longest first. `null` means recount. */
    lengths = null;
    constructor(fns = []) {
        for (const fn of fns)
            this.add(fn);
    }
    /** A function known by name only, its arguments aren't checked. `brackets` works as in `IFunctionInfo`. */
    static loose(name, source, brackets = false) {
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
        };
    }
    /**
     * The first function of a name stays, like in ForgeScript.
     * @param override Replace it instead, like custom functions do.
     * @returns Whether it got added.
     */
    add(fn, override = false) {
        const key = keyOf(fn.name);
        const taken = this.entries.get(key);
        if (taken && keyOf(taken.fn.name) === key) {
            if (!override)
                return false;
            this.remove(taken.fn);
        }
        this.entries.set(key, { fn, spelling: fn.name });
        for (const alias of fn.aliases) {
            if (!this.entries.has(keyOf(alias)))
                this.entries.set(keyOf(alias), { fn, spelling: alias });
        }
        this.lengths = null;
        return true;
    }
    remove(fn) {
        for (const [key, entry] of this.entries)
            if (entry.fn === fn)
                this.entries.delete(key);
    }
    /** @param name With or without the `$`, in any case. Aliases work. */
    get(name) {
        return this.entries.get(keyOf(name))?.fn;
    }
    /**
     * @param index Right after the `$` and its `!`, `#` or `@[...]`.
     * @returns The longest function whose name starts there.
     */
    match(code, index) {
        this.lengths ??= [...new Set([...this.entries.keys()].map((key) => key.length - 1))].sort((a, b) => b - a);
        for (const length of this.lengths) {
            if (index + length > code.length)
                continue;
            const entry = this.entries.get(`$${code.slice(index, index + length).toLowerCase()}`);
            if (entry)
                return { ...entry, length };
        }
        return null;
    }
    /** Every function once. */
    get functions() {
        return [...new Set([...this.entries.values()].map((entry) => entry.fn))];
    }
    /** @returns The closest name or alias, if it's close enough to be a typo. */
    suggest(name) {
        const key = (0, text_1.closest)(name, this.entries.keys());
        return key && this.entries.get(key).spelling;
    }
}
exports.FunctionRegistry = FunctionRegistry;
//# sourceMappingURL=FunctionRegistry.js.map