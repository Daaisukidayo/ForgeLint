import { indentAt } from "../functions/embedded"
import { lineStarts, locate } from "../functions/text"
import { Rule } from "../types"
import { FunctionRegistry } from "./FunctionRegistry"
import { ICall, Parser, flatten } from "./Parser"

/** Replaces `start`..`end` with `text`. */
export interface IEdit {
    start: number
    end: number
    text: string
}

/** How the code sits in its file. */
export interface IFormatOptions {
    /** Whether a real line break is here. Defaults to every `\n`. An escaped `\n` in a JavaScript string isn't one. */
    isLineBreak?: (index: number) => boolean
    /**
     * The indentation of the line the code starts on, for example the `code:` line.
     * @default ""
     */
    indent?: string
    /**
     * Top-level lines go one level deeper than `indent`, and the closing line lines up with it.
     * @default false
     */
    alignToKey?: boolean
}

/** With these, nesting is a guess: only names get fixed. */
const BROKEN = new Set([Rule.unclosedBracket, Rule.unescapedBracket, Rule.strayBracket, Rule.missingBrackets])

/** What a line can start with: a function, or a call's `;` or `]`. */
interface IToken {
    kind: "call" | "separator" | "close"
    /** For a function, the call it's in, `null` at the top. For a `;` or `]`, their own call. */
    call: ICall | null
}

/** @param edits They mustn't overlap. */
export function applyEdits(text: string, edits: IEdit[]) {
    let out = ""
    let at = 0

    for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
        out += text.slice(at, edit.start) + edit.text
        at = edit.end
    }

    return out + text.slice(at)
}

/**
 * Formats ForgeScript without changing what it does: names get their declared case,
 * and lines starting with a function, `;` or `]` get indented by nesting. Text lines stay as written.
 */
export class Formatter {
    /** @param indent Spaces per level, or `"tab"`. Defaults to whatever the code uses, otherwise 4. */
    public constructor(
        public readonly registry: FunctionRegistry,
        private readonly indent?: number | "tab"
    ) {}

    public format(code: string, options: IFormatOptions = {}) {
        return applyEdits(code, this.edits(code, options))
    }

    /** @returns The edits, in code order. */
    public edits(code: string, options: IFormatOptions = {}): IEdit[] {
        const { calls, findings } = Parser.parse(code, this.registry)
        const edits: IEdit[] = flatten(calls)
            .map((call) => ({ start: call.nameStart, end: call.nameEnd, text: call.spelling.slice(1) }))
            .filter((edit) => code.slice(edit.start, edit.end) !== edit.text)

        if (!findings.some((finding) => BROKEN.has(finding.rule))) {
            edits.push(...new Layout(code, calls, options, this.indent).edits())
        }

        return edits.sort((a, b) => a.start - b.start)
    }
}

class Layout {
    /** Offsets right after a `[`, `;`, `]` or a name without brackets. */
    private readonly after = new Set<number>()
    /** Maps the offset of a function's `$`, a `;` or a `]` to what it is. */
    private readonly tokens = new Map<number, IToken>()
    /** Maps a line start to its indentation once formatted. */
    private readonly indents = new Map<number, string>()
    private readonly isLineBreak: (index: number) => boolean
    private readonly starts: number[]
    /** The indentation of line 0. */
    private readonly first: string
    /** One level. */
    private readonly unit: string
    /** The indentation of top-level lines. */
    private readonly base: string
    /** The `alignToKey` option. */
    private readonly align: boolean

    public constructor(
        private readonly code: string,
        calls: ICall[],
        options: IFormatOptions,
        indent?: number | "tab"
    ) {
        this.isLineBreak = options.isLineBreak ?? ((index) => code[index] === "\n")
        this.starts = lineStarts(code, this.isLineBreak)
        this.first = options.indent ?? ""
        this.align = !!options.alignToKey
        this.collect(calls, null)

        // nothing nested to learn the step from? the gap between `code:` & the 1st code line is one too
        const step = this.align ? this.keyStep() : undefined
        this.unit = indent === "tab" ? "\t" : indent ? " ".repeat(indent) : (this.guessUnit() ?? step ?? "    ")
        this.base = this.align ? this.first + this.unit : this.guessBase()
    }

    /** @returns Edits for every whitespace run between code on two lines. */
    public edits() {
        const edits: IEdit[] = []

        for (let index = 0; index < this.code.length;) {
            if (!this.blank(index)) {
                index++
                continue
            }

            const start = index
            while (index < this.code.length && this.blank(index)) index++
            edits.push(...this.run(start, index))
        }

        return edits
    }

    private collect(calls: ICall[], parent: ICall | null) {
        for (const call of calls) {
            this.tokens.set(call.start, { kind: "call", call: parent })
            this.after.add(call.end)
            if (call.open !== null) this.after.add(call.open + 1)
            if (call.close !== null) this.tokens.set(call.close, { kind: "close", call })

            for (const separator of call.separators) {
                this.tokens.set(separator, { kind: "separator", call })
                this.after.add(separator + 1)
            }

            for (const field of call.fields) this.collect(field.calls, call)
        }
    }

    /**
     * Removes trailing whitespace, empties blank lines and indents the next line.
     * Skips the run if text touches it, because ForgeScript prints that whitespace.
     * @param end Where the next non-whitespace is.
     */
    private run(start: number, end: number): IEdit[] {
        const token = this.tokens.get(end)
        // w/ `alignToKey`, the code's 1st & last lines count too: they touch the quotes, not text
        const opens = this.after.has(start) || (this.align && start === 0)
        const closes = !!token || (this.align && end === this.code.length)
        if (!opens || !closes) return []

        const breaks: number[] = []
        for (let i = start; i < end; i++) if (this.isLineBreak(i)) breaks.push(i)
        if (!breaks.length) return []

        const edits: IEdit[] = []
        const edit = (from: number, to: number, text: string) => {
            if (this.code.slice(from, to) !== text) edits.push({ start: from, end: to, text })
        }

        let from = start
        for (const at of breaks) {
            // keep `\r\n` whole
            edit(from, this.code[at - 1] === "\r" && at - 1 >= from ? at - 1 : at, "")
            from = at + 1
        }

        // no token = the closing line
        const indent = token ? this.indentFor(token) : this.first
        edit(from, end, indent)
        this.indents.set(from, indent)

        return edits
    }

    private indentFor(token: IToken) {
        if (token.kind !== "call") return this.indentOf(token.call!.start)
        return token.call ? this.indentOf(token.call.start) + this.unit : this.base
    }

    /** @returns The indentation of the offset's line, once formatted. */
    private indentOf(offset: number) {
        const start = this.lineStart(offset)
        return this.indents.get(start) ?? this.written(start)
    }

    /** @returns A line's indentation as written. */
    private written(start: number) {
        return start === 0 ? this.first : indentAt(this.code, start)
    }

    private lineStart(offset: number) {
        return this.starts[locate(this.starts, offset).line - 1]
    }

    /** @returns Whether it's a space, a tab, a real line break or its `\r`. */
    private blank(index: number) {
        const char = this.code[index]
        return (
            char === " " || char === "\t" || this.isLineBreak(index) || (char === "\r" && this.isLineBreak(index + 1))
        )
    }

    /** @returns How much deeper than the `code:` line the first code line sits, `undefined` if it doesn't. */
    private keyStep() {
        const base = this.guessBase()
        return base.length > this.first.length && base.startsWith(this.first)
            ? base.slice(this.first.length)
            : undefined
    }

    /** @returns The first code line's indentation, line 0's if the code starts there. */
    private guessBase() {
        for (let index = 0; index < this.code.length; index++) {
            if (!this.blank(index)) return this.written(this.lineStart(index))
        }
        return this.first
    }

    /** @returns The step nested functions are indented by most often, `undefined` if they never are. */
    private guessUnit() {
        const counts = new Map<string, number>()

        for (const [offset, token] of this.tokens) {
            if (token.kind !== "call" || !token.call) continue

            const line = this.lineStart(offset)
            const parent = this.lineStart(token.call.start)
            if (line === parent || this.code.slice(line, offset).trim()) continue

            const own = this.written(line)
            const outer = this.written(parent)
            if (own.length <= outer.length || !own.startsWith(outer)) continue

            const step = own.slice(outer.length)
            counts.set(step, (counts.get(step) ?? 0) + 1)
        }

        // the shorter one on a tie
        return [...counts].sort(([a, x], [b, y]) => y - x || a.length - b.length)[0]?.[0]
    }
}
