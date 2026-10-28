"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionRegistry = void 0;
const text_1 = require("../functions/text");
const keyOf = (name) => (name.startsWith("$") ? name : `$${name}`).toLowerCase();
/** The fns code can call. Matched like FS does it: any case, longest name wins */
class FunctionRegistry {
    /** lowercased name/alias → entry */
    entries = new Map();
    /** name lengths w/o `$`, longest 1st. `null` = recount */
    lengths = null;
    constructor(fns = []) {
        for (const fn of fns)
            this.add(fn);
    }
    /** A fn known by name only, its args aren't checked. `brackets` as in `IFunctionInfo` */
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
        };
    }
    /**
     * 1st fn of a name stays, like in FS
     * @param override replace it instead, like custom fns do
     * @returns whether it got added
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
    /** @param name w/ or w/o `$`, any case, aliases work */
    get(name) {
        return this.entries.get(keyOf(name))?.fn;
    }
    /**
     * @param index right after the `$` & its `!`, `#`, `@[...]`
     * @returns the longest fn whose name starts there
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
    /** every fn once */
    get functions() {
        return [...new Set([...this.entries.values()].map((entry) => entry.fn))];
    }
    /** @returns closest name/alias, if it's close enough to be a typo */
    suggest(name) {
        const wanted = name.toLowerCase();
        // `$a` is 1 edit away from tons of names, none of them meant
        const max = wanted.length > 5 ? 2 : wanted.length > 3 ? 1 : 0;
        if (!max)
            return;
        let best;
        let bestDistance = max + 1;
        for (const [key, { spelling }] of this.entries) {
            const edits = (0, text_1.distance)(wanted, key, max);
            if (edits < bestDistance) {
                best = spelling;
                bestDistance = edits;
            }
        }
        return best;
    }
}
exports.FunctionRegistry = FunctionRegistry;
//# sourceMappingURL=FunctionRegistry.js.map