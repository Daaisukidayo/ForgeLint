import { lineStarts, locate } from "../functions/text"
import { Rule } from "../types"
import { FunctionRegistry } from "./FunctionRegistry"
import { ICall, Parser, flatten } from "./Parser"

/** Replace `start`..`end` w/ `text` */
export interface IEdit {
    start: number
    end: number
    text: string
}

/** How the code sits in its file */
export interface IFormatOptions {
    /** real line break here? Default every `\n`. An escaped `\n` in a JS string isn't one */
    isLineBreak?: (index: number) => boolean
    /** indentation of the line the code starts on, e.g. the `code:` line. Default none */
    indent?: string
    /** top-level lines go 1 level deeper than `indent`, the closing line in line w/ it. Default `false` */
    alignToKey?: boolean
}

/** w/ these, nesting is a guess, so only names get fixed */
const BROKEN = new Set([Rule.unclosedBracket, Rule.unescapedBracket, Rule.strayBracket, Rule.missingBrackets])

/** What a line can start w/: a fn, or a call's `;`/`]` */
interface IToken {
    kind: "call" | "separator" | "close"
    /** for a fn: the call it's in (`null` at the top). For `;`/`]`: their own call */
    call: ICall | null
}

/** @param edits mustn't overlap */
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
 * Formats ForgeScript w/o changing what it does: names get their declared case,
 * lines starting w/ a fn, `;` or `]` get indented by nesting. Text lines stay as written
 */
export class Formatter {
    /** @param indent spaces per level or `"tab"`. Default whatever the code uses, else 4 */
    public constructor(
        public readonly registry: FunctionRegistry,
        private readonly indent?: number | "tab"
    ) {}

    public format(code: string, options: IFormatOptions = {}) {
        return applyEdits(code, this.edits(code, options))
    }

    /** @returns the edits, in code order */
    public edits(code: string, options: IFormatOptions = {}): IEdit[] {
        const { calls, findings } = Parser.parse(code, this.registry)
        const edits: IEdit[] = []

        for (const call of flatten(calls)) {
            const name = call.spelling.slice(1)
            if (code.slice(call.nameStart, call.nameEnd) !== name) {
                edits.push({ start: call.nameStart, end: call.nameEnd, text: name })
            }
        }

        if (!findings.some((finding) => BROKEN.has(finding.rule))) {
            edits.push(...new Layout(code, calls, options, this.indent).edits())
        }

        return edits.sort((a, b) => a.start - b.start)
    }
}

class Layout {
    /** offsets right after a `[`, `;`, `]` or bracketless name */
    private readonly after = new Set<number>()
    /** offset of a fn's `$`, a `;` or a `]` → what it is */
    private readonly tokens = new Map<number, IToken>()
    /** line start → its indentation once formatted */
    private readonly indents = new Map<number, string>()
    private readonly isLineBreak: (index: number) => boolean
    private readonly starts: number[]
    /** indentation of line 0 */
    private readonly first: string
    /** 1 level */
    private readonly unit: string
    /** indentation of top-level lines */
    private readonly base: string
    /** `alignToKey` */
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

    /** @returns edits for every whitespace run between code on 2 lines */
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
     * Kills trailing whitespace, empties blank lines & indents the next line.
     * Skips the run if text touches it, b/c FS prints that whitespace
     * @param end where the next non-whitespace is
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

    /** @returns indentation of the offset's line, once formatted */
    private indentOf(offset: number) {
        const start = this.lineStart(offset)
        return this.indents.get(start) ?? this.written(start)
    }

    /** @returns a line's indentation as written */
    private written(start: number) {
        if (start === 0) return this.first

        let end = start
        while (this.code[end] === " " || this.code[end] === "\t") end++
        return this.code.slice(start, end)
    }

    private lineStart(offset: number) {
        return this.starts[locate(this.starts, offset).line - 1]
    }

    /** @returns space, tab, real line break or its `\r`? */
    private blank(index: number) {
        const char = this.code[index]
        return (
            char === " " || char === "\t" || this.isLineBreak(index) || (char === "\r" && this.isLineBreak(index + 1))
        )
    }

    /** @returns how much deeper than the `code:` line the 1st code line sits, `undefined` if it doesn't */
    private keyStep() {
        const base = this.guessBase()
        return base.length > this.first.length && base.startsWith(this.first)
            ? base.slice(this.first.length)
            : undefined
    }

    /** @returns the 1st code line's indentation, line 0's if the code starts there */
    private guessBase() {
        for (let index = 0; index < this.code.length; index++) {
            if (!this.blank(index)) return this.written(this.lineStart(index))
        }
        return this.first
    }

    /** @returns the step nested fns are indented by most, `undefined` if they never are */
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

        let best: string | undefined
        let most = 0
        for (const [step, count] of counts) {
            if (count > most || (count === most && step.length < best!.length)) {
                best = step
                most = count
            }
        }

        return best
    }
}
