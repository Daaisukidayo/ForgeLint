import { cook } from "./embedded"

/** A JavaScript or TypeScript token, only what ForgeLint needs. */
interface IToken {
    type: "name" | "string" | "template" | "punct" | "other"
    start: number
    end: number
    /** Its text, quotes included. */
    value: string
    /** A template's `${...}`s, from the `$` to after the `}`. */
    holes: Array<[number, number]>
}

/** A string literal in a file. */
export interface ILiteral {
    /** Its text, quotes excluded. */
    start: number
    end: number
    /** `String.raw`: escapes stay as written. */
    raw: boolean
    /** Its `${...}`s, from the `$` to after the `}`. */
    holes: Array<[number, number]>
    /** For a command's `code`: its `type`, if that is a plain string. Its text, quotes excluded. */
    event?: { name: string; start: number; end: number }
}

/** A custom function's parameter, as written. */
export interface IParam {
    name: string
    required?: boolean
    rest?: boolean
    type?: string
}

/** A native function's argument written as an object. Its `enum` is skipped: the values can't be read without running the code. */
export interface IArgObject {
    name: string
    required: boolean
    rest: boolean
    condition: boolean
    type: string
}

/** `Arg.requiredString("name", ...)`. It gets run with the bot's ForgeScript `Arg` later. */
export interface IArgCall {
    method: string
    /** Literals, `undefined` for anything else, like an enum. */
    values: Array<string | boolean | undefined>
}

/** A function a file defines, read without running it. */
export interface IDefinition {
    /** Custom ones without the `$`, native ones with it. */
    name: string
    kind: "native" | "custom"
    /** `null` if it's not a plain `true` or `false`. */
    brackets: boolean | undefined | null
    /** A custom function's, `null` if not plain. */
    params: Array<string | IParam> | null
    firstParamCondition: boolean
    /** A native function's, `null` if not plain. */
    args?: Array<IArgObject | IArgCall> | null
    /** A native function's, `null` if not plain. */
    unwrap?: boolean | null
    aliases?: string[]
    deprecated?: boolean
}

/** A plain value: a string or number, `true` or `false`, or a name like `ArgType.Number`. */
interface IValue {
    text?: string
    flag?: boolean
    /** `ArgType.Number` becomes `["ArgType", "Number"]`. */
    chain?: string[]
}

export interface IScriptScan {
    /** The values of the code keys. */
    literals: ILiteral[]
    definitions: IDefinition[]
}

/** An open bracket while scanning. */
interface IFrame {
    char: string
    /** Maps an object's keys to their value's token index. */
    keys?: Map<string, number>
    /** `NativeFunction` for `new NativeFunction({`, and the same for `ForgeFunction`. */
    ctor?: string
    /** Its `code`, if it's a literal. */
    code?: ILiteral
}

/** A `/` after these starts a regex, not a division. */
const BEFORE_REGEX = new Set("return typeof case do else in of new delete void throw instanceof yield await".split(" "))

const OPENERS: Record<string, string> = { "}": "{", ")": "(", "]": "[" }

const CONSTRUCTORS = new Set(["NativeFunction", "ForgeFunction"])

/** JavaScript lets any non-ASCII character into names. */
const isNameChar = (char: string, first: boolean) =>
    (first ? /[A-Za-z_$]/ : /[\w$]/).test(char) || char.charCodeAt(0) > 127

/** Splits JavaScript or TypeScript into names, strings, templates and punctuation. Skips comments and regexes. */
class Tokenizer {
    private index = 0

    public constructor(private readonly source: string) {}

    public all() {
        const tokens: IToken[] = []
        for (let token = this.next(); token; token = this.next(token)) tokens.push(token)
        return tokens
    }

    /** @param previous To tell a regex from a division. */
    private next(previous?: IToken): IToken | null {
        this.skipBlank()

        const { source } = this
        const start = this.index
        if (start >= source.length) return null

        const char = source[start]
        let type: IToken["type"] = "other"
        let holes: Array<[number, number]> = []

        if (char === '"' || char === "'") {
            this.quoted(char)
            type = "string"
        } else if (char === "`") {
            holes = this.template()
            type = "template"
        } else if (isNameChar(char, true)) {
            this.index++
            while (this.index < source.length && isNameChar(source[this.index], false)) this.index++
            type = "name"
        } else if (/\d/.test(char)) {
            while (this.index < source.length && /[\w.]/.test(source[this.index])) this.index++
        } else if (char === "/" && this.regexAfter(previous)) {
            this.regex()
        } else {
            this.index++
            type = "punct"
        }

        return { type, start, end: this.index, value: source.slice(start, this.index), holes }
    }

    /** Whitespace, comments and a shebang. */
    private skipBlank() {
        const { source } = this

        for (;;) {
            const char = source[this.index]
            if (char === undefined) return

            if (/\s/.test(char)) this.index++
            else if (source.startsWith("//", this.index) || (this.index === 0 && source.startsWith("#!"))) {
                const end = source.indexOf("\n", this.index)
                this.index = end === -1 ? source.length : end
            } else if (source.startsWith("/*", this.index)) {
                const end = source.indexOf("*/", this.index + 2)
                this.index = end === -1 ? source.length : end + 2
            } else return
        }
    }

    private quoted(quote: string) {
        const { source } = this
        this.index++

        while (this.index < source.length) {
            const char = source[this.index]

            if (char === "\\") this.index += 2
            else if (char === quote) {
                this.index++
                return
            } else if (char === "\n") return
            else this.index++
        }
    }

    /** @returns Its `${...}`s. */
    private template() {
        const { source } = this
        const holes: Array<[number, number]> = []
        this.index++

        while (this.index < source.length) {
            const char = source[this.index]

            if (char === "\\") this.index += 2
            else if (char === "`") {
                this.index++
                break
            } else if (char === "$" && source[this.index + 1] === "{") {
                const start = this.index
                this.index += 2
                this.expression()
                holes.push([start, this.index])
            } else this.index++
        }

        return holes
    }

    /** Skips the inside of a `${...}`, up to and including its `}`. */
    private expression() {
        let depth = 0
        let previous: IToken | undefined

        for (let token = this.next(); token; token = this.next(previous)) {
            if (token.type === "punct" && token.value === "{") depth++
            else if (token.type === "punct" && token.value === "}" && !depth--) return
            previous = token
        }
    }

    private regexAfter(previous?: IToken) {
        if (!previous) return true
        if (previous.type === "punct") return !")]}".includes(previous.value)
        return previous.type === "name" && BEFORE_REGEX.has(previous.value)
    }

    private regex() {
        const { source } = this
        let inClass = false
        this.index++

        while (this.index < source.length) {
            const char = source[this.index]
            if (char === "\\") {
                this.index += 2
                continue
            }
            if (char === "\n") return

            this.index++
            if (char === "[") inClass = true
            else if (char === "]") inClass = false
            else if (char === "/" && !inClass) break
        }

        while (this.index < source.length && /[a-z]/i.test(source[this.index])) this.index++
    }
}

/** @returns A plain string's text, `null` if it's no string or has a `${...}`. */
function textOf(source: string, token: IToken | undefined) {
    if (!token || (token.type !== "string" && token.type !== "template") || token.holes.length) return null
    return cook(source, { start: token.start + 1, end: token.end - 1, raw: false, holes: [] }).code
}

/** @returns The key a token would be in an object. */
function keyOf(source: string, token: IToken) {
    return token.type === "name" ? token.value : textOf(source, token)
}

/** @returns `true` or `false` if it's that, `undefined` without a value, otherwise `null`. */
const booleanAt = (source: string, tokens: IToken[], index: number | undefined) =>
    index === undefined ? undefined : (valueAt(source, tokens, index).value?.flag ?? null)

/** @returns The literal starting at the index, `String.raw` included. */
function literalAt(tokens: IToken[], index: number): ILiteral | null {
    let raw = false
    if (tokens[index]?.value === "String" && tokens[index + 1]?.value === "." && tokens[index + 2]?.value === "raw") {
        raw = true
        index += 3
    }

    const token = tokens[index]
    if (!token || (token.type !== "template" && (raw || token.type !== "string"))) return null

    return { start: token.start + 1, end: token.end - 1, raw, holes: token.holes }
}

/** Something read at an index: `null` if it isn't plain. `next` is the index right after it. */
type Read<T> = { value: T | null; next: number }

/** @returns The index of the top-level `,` or closing bracket that ends the value at `index`. */
function skip(tokens: IToken[], index: number) {
    let depth = 0

    for (let i = index; i < tokens.length; i++) {
        const { type, value } = tokens[i]
        if (type !== "punct") continue

        if ("([{".includes(value)) depth++
        else if (")]}".includes(value)) {
            if (!depth) return i
            depth--
        } else if (value === "," && !depth) return i
    }

    return tokens.length
}

/** Reads a string, number, `true`, `false` or `a.b.c`. Anything fancier is `null` and skipped. */
function valueAt(source: string, tokens: IToken[], index: number): Read<IValue> {
    const token = tokens[index]
    let value: IValue | null = null
    let next = index + 1

    const text = textOf(source, token)
    if (text !== null) value = { text }
    else if (token?.type === "other" && /^\d/.test(token.value)) value = { text: token.value }
    else if (token?.value === "true" || token?.value === "false") value = { flag: token.value === "true" }
    else if (token?.type === "name") {
        const chain = [token.value]
        while (tokens[next]?.value === "." && tokens[next + 1]?.type === "name") {
            chain.push(tokens[next + 1].value)
            next += 2
        }
        value = { chain }
    }

    // `a + b`, `fn()`... aren't plain
    if (value && skip(tokens, index) === next) return { value, next }
    return { value: null, next: skip(tokens, index) }
}

/** Reads items up to `close`, with `,`s between. One item that isn't plain, or no `close`, gives `null`. */
function listAt<T>(tokens: IToken[], index: number, close: string, item: (index: number) => Read<T>): Read<T[]> {
    const items: T[] = []
    let i = index

    while (i < tokens.length && tokens[i].value !== close) {
        if (tokens[i].value === ",") {
            i++
            continue
        }

        const { value, next } = item(i)
        if (value === null) return { value: null, next: index }
        items.push(value)
        i = next
    }

    return i < tokens.length ? { value: items, next: i + 1 } : { value: null, next: index }
}

/** Reads `{ key: value, ... }`. Values that aren't plain are `null`. */
function objectAt(source: string, tokens: IToken[], index: number): Read<Map<string, IValue | null>> {
    if (tokens[index]?.value !== "{") return { value: null, next: index }

    const { value: pairs, next } = listAt(tokens, index + 1, "}", (i) => {
        // spreads, shorthands & methods aren't plain
        const key = keyOf(source, tokens[i])
        if (key === null || tokens[i + 1]?.value !== ":") return { value: null, next: i }

        const { value, next } = valueAt(source, tokens, i + 2)
        return { value: [key, value] as const, next }
    })

    return { value: pairs && new Map(pairs), next }
}

/** Reads `[...]` with `item`. One item that isn't plain gives `null`. */
const arrayAt = <T>(tokens: IToken[], index: number | undefined, item: (index: number) => Read<T>) =>
    index === undefined || tokens[index]?.value !== "[" ? null : listAt(tokens, index + 1, "]", item).value

/** @returns `undefined` if the key is missing, `null` if it's not a plain `true` or `false`. */
const flagOf = (keys: Map<string, IValue | null>, key: string) =>
    keys.has(key) ? (keys.get(key)?.flag ?? null) : undefined

/** `"Number"` or `ArgType.Number`. */
const typeOf = (value: IValue | null | undefined) =>
    value?.text ?? (value?.chain?.at(-2) === "ArgType" ? value.chain.at(-1) : undefined)

/** A custom function's parameter: `"a"` or `{ name: "b", required: false, type: ArgType.Number }`. */
function paramAt(source: string, tokens: IToken[], index: number): Read<string | IParam> {
    const text = textOf(source, tokens[index])
    if (text !== null) return { value: text, next: index + 1 }

    const { value: keys, next } = objectAt(source, tokens, index)
    const name = keys?.get("name")?.text
    if (!keys || !name) return { value: null, next }

    const param: IParam = { name }
    for (const key of ["required", "rest"] as const) {
        const flag = flagOf(keys, key)
        if (flag === null) return { value: null, next }
        if (flag !== undefined) param[key] = flag
    }

    if (keys.has("type")) {
        param.type = typeOf(keys.get("type"))
        if (!param.type) return { value: null, next }
    }

    return { value: param, next }
}

/** A native function's argument: `{ name, type: ArgType.String, required, rest }` or `Arg.requiredString(...)`. */
function argAt(source: string, tokens: IToken[], index: number): Read<IArgObject | IArgCall> {
    if (tokens[index]?.value === "{") {
        const { value: keys, next } = objectAt(source, tokens, index)
        const name = keys?.get("name")?.text
        // FS's own default
        const type = keys?.has("type") ? typeOf(keys.get("type")) : "Unknown"
        const flags = keys ? (["required", "rest", "condition"] as const).map((key) => flagOf(keys, key)) : [null]
        if (!name || !type || flags.includes(null)) return { value: null, next }

        const [required, rest, condition] = flags
        return { value: { name, type, required: !!required, rest: !!rest, condition: !!condition }, next }
    }

    // `Arg.requiredString(`, or `forgescript_1.Arg.requiredString(` once compiled
    if (tokens[index]?.type !== "name") return { value: null, next: index }

    const chain = [tokens[index].value]
    let at = index
    while (tokens[at + 1]?.value === "." && tokens[at + 2]?.type === "name") {
        chain.push(tokens[at + 2].value)
        at += 2
    }

    if (chain.at(-2) !== "Arg" || tokens[at + 1]?.value !== "(") return { value: null, next: index }

    const { value: values, next } = listAt(tokens, at + 2, ")", (i) => {
        const { value, next } = valueAt(source, tokens, i)
        return { value: value?.flag ?? value?.text, next }
    })

    return values ? { value: { method: chain.at(-1)!, values }, next } : { value: null, next: index }
}

/** @returns The function a just-closed object defines: `new NativeFunction({...})`, `new ForgeFunction({...})` or `{ name, params, code }`. */
function definitionOf(source: string, tokens: IToken[], frame: IFrame): IDefinition | null {
    const keys = frame.keys!
    const name = textOf(source, tokens[keys.get("name") ?? -1])
    if (name === null) return null

    const brackets = booleanAt(source, tokens, keys.get("brackets"))

    if (frame.ctor === "NativeFunction") {
        if (!name.startsWith("$")) return null

        const unwrap = booleanAt(source, tokens, keys.get("unwrap"))
        const aliases = arrayAt(tokens, keys.get("aliases"), (i) => ({ value: textOf(source, tokens[i]), next: i + 1 }))

        return {
            name,
            kind: "native",
            brackets,
            params: null,
            firstParamCondition: false,
            args: keys.has("args") ? arrayAt(tokens, keys.get("args"), (i) => argAt(source, tokens, i)) : [],
            unwrap: unwrap === undefined ? false : unwrap,
            aliases: aliases ?? [],
            deprecated: booleanAt(source, tokens, keys.get("deprecated")) === true,
        }
    }

    if (frame.ctor !== "ForgeFunction" && !(keys.has("params") && keys.has("code"))) return null

    return {
        name,
        kind: "custom",
        brackets,
        params: keys.has("params") ? arrayAt(tokens, keys.get("params"), (i) => paramAt(source, tokens, i)) : [],
        firstParamCondition: booleanAt(source, tokens, keys.get("firstParamCondition")) === true,
    }
}

/** @returns A just-closed command's `type`. A slash command's, one with `data`, says how it registers and is no event. */
function eventOf(source: string, tokens: IToken[], frame: IFrame): ILiteral["event"] {
    const token = tokens[frame.keys!.get("type") ?? -1]
    const name = frame.keys!.has("data") ? null : textOf(source, token)
    return name === null ? undefined : { name, start: token.start + 1, end: token.end - 1 }
}

/**
 * Finds ForgeScript in a JavaScript or TypeScript file without running it.
 * @param keys Keys holding ForgeScript, for example `code`.
 */
export function scanScript(source: string, keys: Set<string>): IScriptScan {
    const tokens = new Tokenizer(source).all()
    const literals: ILiteral[] = []
    const definitions: IDefinition[] = []
    const stack: IFrame[] = []

    tokens.forEach((token, i) => {
        if (token.type === "punct" && "{([".includes(token.value)) {
            const object = token.value === "{"
            const ctor = object && tokens[i - 1]?.value === "(" ? tokens[i - 2]?.value : undefined
            stack.push({
                char: token.value,
                keys: object ? new Map() : undefined,
                ctor: ctor && CONSTRUCTORS.has(ctor) ? ctor : undefined,
            })
            return
        }

        if (token.type === "punct" && token.value in OPENERS) {
            // pop up to its opener, in case brackets don't match
            const at = stack.map((frame) => frame.char).lastIndexOf(OPENERS[token.value])
            if (at === -1) return

            const [frame] = stack.splice(at)
            const definition = frame.keys && definitionOf(source, tokens, frame)
            if (definition) definitions.push(definition)

            const event = frame.code && eventOf(source, tokens, frame)
            if (event) frame.code!.event = event
            return
        }

        const frame = stack.at(-1)
        const before = tokens[i - 1]
        const after = tokens[i + 1]
        if (!frame?.keys || after?.type !== "punct" || after.value !== ":") return
        if (before?.type !== "punct" || (before.value !== "{" && before.value !== ",")) return

        const key = keyOf(source, token)
        if (key === null) return

        frame.keys.set(key, i + 2)
        if (keys.has(key)) {
            const literal = literalAt(tokens, i + 2)
            if (literal) literals.push(literal)
            // just `code`: other keys can sit next to a `type` that's no event
            if (literal && key === "code") frame.code = literal
        }
    })

    return { literals, definitions }
}
