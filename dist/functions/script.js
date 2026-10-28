"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanScript = scanScript;
const embedded_1 = require("./embedded");
/** a `/` after these starts a regex, not a division */
const BEFORE_REGEX = new Set([
    "return",
    "typeof",
    "case",
    "do",
    "else",
    "in",
    "of",
    "new",
    "delete",
    "void",
    "throw",
    "instanceof",
    "yield",
    "await",
]);
const OPENERS = { "}": "{", ")": "(", "]": "[" };
const CONSTRUCTORS = new Set(["NativeFunction", "ForgeFunction"]);
/** JS lets any non-ASCII char into names */
const isNameChar = (char, first) => (first ? /[A-Za-z_$]/ : /[\w$]/).test(char) || char.charCodeAt(0) > 127;
/** Splits JS/TS into names, strings, templates & punctuation. Skips comments & regexes */
class Tokenizer {
    source;
    index = 0;
    constructor(source) {
        this.source = source;
    }
    all() {
        const tokens = [];
        for (let token = this.next(); token; token = this.next(token))
            tokens.push(token);
        return tokens;
    }
    /** @param previous to tell a regex from a division */
    next(previous) {
        this.skipBlank();
        const { source } = this;
        const start = this.index;
        if (start >= source.length)
            return null;
        const char = source[start];
        let type = "other";
        let holes = [];
        if (char === '"' || char === "'") {
            this.quoted(char);
            type = "string";
        }
        else if (char === "`") {
            holes = this.template();
            type = "template";
        }
        else if (isNameChar(char, true)) {
            this.index++;
            while (this.index < source.length && isNameChar(source[this.index], false))
                this.index++;
            type = "name";
        }
        else if (/\d/.test(char)) {
            while (this.index < source.length && /[\w.]/.test(source[this.index]))
                this.index++;
        }
        else if (char === "/" && this.regexAfter(previous)) {
            this.regex();
        }
        else {
            this.index++;
            type = "punct";
        }
        return { type, start, end: this.index, value: source.slice(start, this.index), holes };
    }
    /** whitespace, comments & a shebang */
    skipBlank() {
        const { source } = this;
        for (;;) {
            const char = source[this.index];
            if (char === undefined)
                return;
            if (/\s/.test(char))
                this.index++;
            else if (source.startsWith("//", this.index) || (this.index === 0 && source.startsWith("#!"))) {
                const end = source.indexOf("\n", this.index);
                this.index = end === -1 ? source.length : end;
            }
            else if (source.startsWith("/*", this.index)) {
                const end = source.indexOf("*/", this.index + 2);
                this.index = end === -1 ? source.length : end + 2;
            }
            else
                return;
        }
    }
    quoted(quote) {
        const { source } = this;
        this.index++;
        while (this.index < source.length) {
            const char = source[this.index];
            if (char === "\\")
                this.index += 2;
            else if (char === quote) {
                this.index++;
                return;
            }
            else if (char === "\n")
                return;
            else
                this.index++;
        }
    }
    /** @returns its `${...}`s */
    template() {
        const { source } = this;
        const holes = [];
        this.index++;
        while (this.index < source.length) {
            const char = source[this.index];
            if (char === "\\")
                this.index += 2;
            else if (char === "`") {
                this.index++;
                break;
            }
            else if (char === "$" && source[this.index + 1] === "{") {
                const start = this.index;
                this.index += 2;
                this.expression();
                holes.push([start, this.index]);
            }
            else
                this.index++;
        }
        return holes;
    }
    /** Skips a `${...}`'s insides, up to & incl. its `}` */
    expression() {
        let depth = 0;
        let previous;
        for (let token = this.next(); token; token = this.next(previous)) {
            if (token.type === "punct" && token.value === "{")
                depth++;
            else if (token.type === "punct" && token.value === "}" && !depth--)
                return;
            previous = token;
        }
    }
    regexAfter(previous) {
        if (!previous)
            return true;
        if (previous.type === "punct")
            return !")]}".includes(previous.value);
        return previous.type === "name" && BEFORE_REGEX.has(previous.value);
    }
    regex() {
        const { source } = this;
        let inClass = false;
        this.index++;
        while (this.index < source.length) {
            const char = source[this.index];
            if (char === "\\") {
                this.index += 2;
                continue;
            }
            if (char === "\n")
                return;
            this.index++;
            if (char === "[")
                inClass = true;
            else if (char === "]")
                inClass = false;
            else if (char === "/" && !inClass)
                break;
        }
        while (this.index < source.length && /[a-z]/i.test(source[this.index]))
            this.index++;
    }
}
/** @returns a plain string's text, `null` if it's no string or has `${...}` */
function textOf(source, token) {
    if (!token || (token.type !== "string" && token.type !== "template") || token.holes.length)
        return null;
    return (0, embedded_1.cook)(source, { start: token.start + 1, end: token.end - 1, raw: false, holes: [] }).code;
}
/** @returns the key a token would be in an object */
function keyOf(source, token) {
    return token.type === "name" ? token.value : textOf(source, token);
}
/** @returns `true`/`false` if it's that, `undefined` w/o value, else `null` */
function booleanAt(tokens, index) {
    if (index === undefined)
        return undefined;
    const { type, value } = tokens[index] ?? {};
    return type === "name" && (value === "true" || value === "false") ? value === "true" : null;
}
/** @returns the literal starting at the idx, `String.raw` incl. */
function literalAt(tokens, index) {
    let raw = false;
    if (tokens[index]?.value === "String" && tokens[index + 1]?.value === "." && tokens[index + 2]?.value === "raw") {
        raw = true;
        index += 3;
    }
    const token = tokens[index];
    if (!token || (token.type !== "template" && (raw || token.type !== "string")))
        return null;
    return { start: token.start + 1, end: token.end - 1, raw, holes: token.holes };
}
/** @returns idx of the top-level `,` or closing bracket that ends the value at `index` */
function skip(tokens, index) {
    let depth = 0;
    for (let i = index; i < tokens.length; i++) {
        const { type, value } = tokens[i];
        if (type !== "punct")
            continue;
        if ("([{".includes(value))
            depth++;
        else if (")]}".includes(value)) {
            if (!depth)
                return i;
            depth--;
        }
        else if (value === "," && !depth)
            return i;
    }
    return tokens.length;
}
/** Reads a string, number, `true`/`false` or `a.b.c`. Anything fancier = `null`, skipped */
function valueAt(source, tokens, index) {
    const token = tokens[index];
    let value = null;
    let next = index + 1;
    const text = textOf(source, token);
    if (text !== null)
        value = { text };
    else if (token?.type === "other" && /^\d/.test(token.value))
        value = { text: token.value };
    else if (token?.value === "true" || token?.value === "false")
        value = { flag: token.value === "true" };
    else if (token?.type === "name") {
        const chain = [token.value];
        while (tokens[next]?.value === "." && tokens[next + 1]?.type === "name") {
            chain.push(tokens[next + 1].value);
            next += 2;
        }
        value = { chain };
    }
    // `a + b`, `fn()`... aren't plain
    if (value && skip(tokens, index) === next)
        return { value, next };
    return { value: null, next: skip(tokens, index) };
}
/** Reads `{ key: value, ... }`. Values that aren't plain are `null` */
function objectAt(source, tokens, index) {
    if (tokens[index]?.value !== "{")
        return { value: null, next: index };
    const keys = new Map();
    let i = index + 1;
    while (i < tokens.length && tokens[i].value !== "}") {
        if (tokens[i].value === ",") {
            i++;
            continue;
        }
        // spreads, shorthands & methods aren't plain
        const key = keyOf(source, tokens[i]);
        if (key === null || tokens[i + 1]?.value !== ":")
            return { value: null, next: index };
        const { value, next } = valueAt(source, tokens, i + 2);
        keys.set(key, value);
        i = next;
    }
    return i < tokens.length ? { value: keys, next: i + 1 } : { value: null, next: index };
}
/** Reads `[...]` w/ `item`. One item that isn't plain = `null` */
function arrayAt(tokens, index, item) {
    if (index === undefined || tokens[index]?.value !== "[")
        return null;
    const items = [];
    let i = index + 1;
    while (i < tokens.length && tokens[i].value !== "]") {
        if (tokens[i].value === ",") {
            i++;
            continue;
        }
        const { value, next } = item(i);
        if (value === null)
            return null;
        items.push(value);
        i = next;
    }
    return i < tokens.length ? items : null;
}
/** @returns `undefined` if the key's missing, `null` if it's not a plain `true`/`false` */
const flagOf = (keys, key) => keys.has(key) ? (keys.get(key)?.flag ?? null) : undefined;
/** `"Number"` or `ArgType.Number` */
const typeOf = (value) => value?.text ?? (value?.chain?.at(-2) === "ArgType" ? value.chain.at(-1) : undefined);
/** A custom fn's param: `"a"` or `{ name: "b", required: false, type: ArgType.Number }` */
function paramAt(source, tokens, index) {
    const text = textOf(source, tokens[index]);
    if (text !== null)
        return { value: text, next: index + 1 };
    const { value: keys, next } = objectAt(source, tokens, index);
    const name = keys?.get("name")?.text;
    if (!keys || !name)
        return { value: null, next };
    const param = { name };
    for (const key of ["required", "rest"]) {
        const flag = flagOf(keys, key);
        if (flag === null)
            return { value: null, next };
        if (flag !== undefined)
            param[key] = flag;
    }
    if (keys.has("type")) {
        param.type = typeOf(keys.get("type"));
        if (!param.type)
            return { value: null, next };
    }
    return { value: param, next };
}
/** A native's arg: `{ name, type: ArgType.String, required, rest }` or `Arg.requiredString(...)` */
function argAt(source, tokens, index) {
    if (tokens[index]?.value === "{") {
        const { value: keys, next } = objectAt(source, tokens, index);
        const name = keys?.get("name")?.text;
        // FS's own default
        const type = keys?.has("type") ? typeOf(keys.get("type")) : "Unknown";
        const flags = keys ? ["required", "rest", "condition"].map((key) => flagOf(keys, key)) : [null];
        if (!name || !type || flags.includes(null))
            return { value: null, next };
        const [required, rest, condition] = flags;
        return { value: { name, type, required: !!required, rest: !!rest, condition: !!condition }, next };
    }
    // `Arg.requiredString(`, or `forgescript_1.Arg.requiredString(` once compiled
    if (tokens[index]?.type !== "name")
        return { value: null, next: index };
    const chain = [tokens[index].value];
    let at = index;
    while (tokens[at + 1]?.value === "." && tokens[at + 2]?.type === "name") {
        chain.push(tokens[at + 2].value);
        at += 2;
    }
    if (chain.at(-2) !== "Arg" || tokens[at + 1]?.value !== "(")
        return { value: null, next: index };
    const values = [];
    let i = at + 2;
    while (i < tokens.length && tokens[i].value !== ")") {
        if (tokens[i].value === ",") {
            i++;
            continue;
        }
        const { value, next } = valueAt(source, tokens, i);
        values.push(value?.flag ?? value?.text);
        i = next;
    }
    return i < tokens.length ? { value: { method: chain.at(-1), values }, next: i + 1 } : { value: null, next: index };
}
/** @returns the fn a just-closed object defines: `new NativeFunction({...})`, `new ForgeFunction({...})` or `{ name, params, code }` */
function definitionOf(source, tokens, frame) {
    const keys = frame.keys;
    const name = textOf(source, tokens[keys.get("name") ?? -1]);
    if (name === null)
        return null;
    const brackets = booleanAt(tokens, keys.get("brackets"));
    if (frame.ctor === "NativeFunction") {
        if (!name.startsWith("$"))
            return null;
        const unwrap = booleanAt(tokens, keys.get("unwrap"));
        const aliases = arrayAt(tokens, keys.get("aliases"), (i) => ({
            value: textOf(source, tokens[i]),
            next: i + 1,
        }));
        return {
            name,
            kind: "native",
            brackets,
            params: null,
            firstParamCondition: false,
            args: keys.has("args") ? arrayAt(tokens, keys.get("args"), (i) => argAt(source, tokens, i)) : [],
            unwrap: unwrap === undefined ? false : unwrap,
            aliases: aliases ?? [],
            deprecated: booleanAt(tokens, keys.get("deprecated")) === true,
        };
    }
    if (frame.ctor !== "ForgeFunction" && !(keys.has("params") && keys.has("code")))
        return null;
    return {
        name,
        kind: "custom",
        brackets,
        params: keys.has("params") ? arrayAt(tokens, keys.get("params"), (i) => paramAt(source, tokens, i)) : [],
        firstParamCondition: booleanAt(tokens, keys.get("firstParamCondition")) === true,
    };
}
/**
 * Finds ForgeScript in a JS/TS file w/o running it
 * @param keys keys holding ForgeScript, e.g. `code`
 */
function scanScript(source, keys) {
    const tokens = new Tokenizer(source).all();
    const literals = [];
    const definitions = [];
    const stack = [];
    tokens.forEach((token, i) => {
        if (token.type === "punct" && "{([".includes(token.value)) {
            const object = token.value === "{";
            const ctor = object && tokens[i - 1]?.value === "(" ? tokens[i - 2]?.value : undefined;
            stack.push({
                char: token.value,
                keys: object ? new Map() : undefined,
                ctor: ctor && CONSTRUCTORS.has(ctor) ? ctor : undefined,
            });
            return;
        }
        if (token.type === "punct" && token.value in OPENERS) {
            // pop up to its opener, in case brackets don't match
            const at = stack.map((frame) => frame.char).lastIndexOf(OPENERS[token.value]);
            if (at === -1)
                return;
            const [frame] = stack.splice(at);
            const definition = frame.keys && definitionOf(source, tokens, frame);
            if (definition)
                definitions.push(definition);
            return;
        }
        const frame = stack.at(-1);
        const before = tokens[i - 1];
        const after = tokens[i + 1];
        if (!frame?.keys || after?.type !== "punct" || after.value !== ":")
            return;
        if (before?.type !== "punct" || (before.value !== "{" && before.value !== ","))
            return;
        const key = keyOf(source, token);
        if (key === null)
            return;
        frame.keys.set(key, i + 2);
        if (keys.has(key)) {
            const literal = literalAt(tokens, i + 2);
            if (literal)
                literals.push(literal);
        }
    });
    return { literals, definitions };
}
//# sourceMappingURL=script.js.map