import { plural, signature } from "../functions/text"
import { IFunctionInfo, Rule } from "../types"
import { FunctionRegistry } from "./FunctionRegistry"

/** A call's arg */
export interface IField {
    start: number
    /** offset of the `;`/`]` after it, or the code's length if unclosed */
    end: number
    /** fns right inside it */
    calls: ICall[]
    /** its text w/ escapes resolved, `null` if a fn's inside */
    literal: string | null
}

/** A fn call in code */
export interface ICall {
    fn: IFunctionInfo
    /** name as declared, e.g. `$authorID` for `$AUTHORID` */
    spelling: string
    /** the `$` */
    start: number
    /** the name w/o `!`, `#`, `@[...]` */
    nameStart: number
    nameEnd: number
    /** `[`, `null` w/o brackets */
    open: number | null
    /** `]`, `null` w/o brackets or unclosed */
    close: number | null
    /** the `;`s between fields */
    separators: number[]
    fields: IField[]
    /** right after it */
    end: number
}

/** A problem before it gets a severity & position */
export interface IFinding {
    rule: Rule
    message: string
    start: number
    end: number
    /** FS won't compile the code */
    fatal?: boolean
}

export interface IParsed {
    /** top-level calls */
    calls: ICall[]
    /** syntax problems */
    findings: IFinding[]
}

/** FS names are letters & digits */
const WORD = /[A-Za-z][A-Za-z0-9]*/y

/** @returns the calls & all calls nested in them, in code order */
export function flatten(calls: ICall[]): ICall[] {
    return calls.flatMap((call) => [call, ...flatten(call.fields.flatMap((field) => field.calls))])
}

/**
 * Reads ForgeScript like FS's compiler does, but doesn't bail on the 1st problem.
 * Code that compiles comes out as the same calls & fields
 */
export class Parser {
    private index = 0
    private readonly findings: IFinding[] = []
    /** `suggest` is the slow bit, so a name gets it once */
    private readonly guesses = new Map<string, string | undefined>()

    private constructor(
        private readonly code: string,
        private readonly registry: FunctionRegistry,
        private readonly escaped: string
    ) {}

    /** @param escaped how an escaped `]` is written where the code lives, e.g. `\\]` in a JS string */
    public static parse(code: string, registry: FunctionRegistry, escaped = "\\]"): IParsed {
        const parser = new Parser(code, registry, escaped)
        return { calls: parser.top(), findings: parser.findings }
    }

    private top() {
        const calls: ICall[] = []
        // text `[`s, so the `]` closing one isn't stray
        let open = 0

        while (this.index < this.code.length) {
            const char = this.code[this.index]

            if (char === "\\") {
                // `\]` closes a text `[`
                if (this.code[this.index + 1] === "]" && open) open--
                this.index += 2
                continue
            }

            if (char === "$") {
                const call = this.call()
                if (call) calls.push(call)
                continue
            }

            if (char === "[") open++
            else if (char === "]") {
                if (open) open--
                else {
                    this.find(
                        Rule.strayBracket,
                        this.index,
                        this.index + 1,
                        `This ] closes nothing, so it's printed as text. If that's intended, escape it: ${this.escaped}`
                    )
                }
            }

            this.index++
        }

        return calls
    }

    /** At a `$`: reads the call, or reports an unknown name & steps over the `$` */
    private call(): ICall | null {
        const start = this.index
        let index = start + 1

        // `$!fn` = no output, `$#fn` = fail silently, `$@[...]fn` = count
        if (this.code[index] === "!") index++
        if (this.code[index] === "#") index++
        if (this.code.startsWith("@[", index)) {
            const close = this.code.indexOf("]", index + 2)
            const line = this.code.indexOf("\n", index + 2)
            if (close !== -1 && (line === -1 || close < line)) index = close + 1
        }

        WORD.lastIndex = index
        const word = WORD.exec(this.code)?.[0] ?? ""
        const match = this.registry.match(this.code, index)

        if (!match) {
            if (word) this.unknown(start, index + word.length, word)
            this.index = start + 1
            return null
        }

        const { fn, spelling } = match
        const nameEnd = index + match.length
        const call: ICall = {
            fn,
            spelling,
            start,
            nameStart: index,
            nameEnd,
            open: null,
            close: null,
            separators: [],
            fields: [],
            end: nameEnd,
        }
        this.index = nameEnd

        // `$getUserVar` w/o ForgeDB = `$get` + `UserVar`, which won't compile (`$get` needs brackets).
        // `$pingms` = `$ping` + `ms` & runs fine, prob on purpose
        const glued = word.length > match.length
        if (glued && fn.brackets) this.unknown(start, index + word.length, word, spelling)
        else if (glued) {
            this.find(
                Rule.gluedName,
                start,
                index + word.length,
                `$${word} reads as ${spelling} followed by "${word.slice(match.length)}". If you meant another function, is its extension installed?`
            )
        }

        if (this.code[nameEnd] !== "[") {
            if (fn.brackets && !glued) {
                this.find(Rule.missingBrackets, start, nameEnd, `${spelling} needs brackets: ${signature(fn)}`, true)
            }
            return call
        }

        if (fn.brackets === undefined) {
            this.find(
                Rule.unexpectedBrackets,
                nameEnd,
                nameEnd + 1,
                `${spelling} takes no arguments, so this [ and what follows is printed as text`
            )
            return call
        }

        call.open = nameEnd
        this.index = nameEnd + 1

        for (;;) {
            call.fields.push(this.field(call))
            const char = this.code[this.index]

            if (char === ";") {
                call.separators.push(this.index++)
                continue
            }

            if (char === "]") call.close = this.index++
            else this.find(Rule.unclosedBracket, start, nameEnd + 1, `${spelling}[ is never closed. Add a ]`, true)
            break
        }

        call.end = Math.min(this.index, this.code.length)
        this.tooMany(call)
        return call
    }

    /** Reads a field up to its `;`/`]` & stops there */
    private field(owner: ICall): IField {
        const start = this.index
        const calls: ICall[] = []
        // text `[`s. A `]` closes the fn anyway
        let open = 0
        let text = ""

        while (this.index < this.code.length) {
            const char = this.code[this.index]

            if (char === "\\") {
                if (this.code[this.index + 1] === "]" && open) open--
                text += this.code[this.index + 1] ?? ""
                this.index += 2
                continue
            }

            if (char === ";" || char === "]") {
                if (char === "]" && open) {
                    this.find(
                        Rule.unescapedBracket,
                        this.index,
                        this.index + 1,
                        `This ] closes ${owner.spelling}, not the [ before it. Escape it: ${this.escaped}`
                    )
                }
                break
            }

            if (char === "$") {
                const call = this.call()
                if (call) calls.push(call)
                else text += "$"
                continue
            }

            if (char === "[") open++
            text += char
            this.index++
        }

        return { start, end: Math.min(this.index, this.code.length), calls, literal: calls.length ? null : text }
    }

    /** FS won't compile fields past the last arg */
    private tooMany(call: ICall) {
        const { fn } = call
        if (fn.loose || fn.args.some((arg) => arg.rest) || call.fields.length <= fn.args.length) return

        this.find(
            Rule.tooManyArguments,
            call.separators[fn.args.length - 1] ?? call.open!,
            call.close ?? call.end,
            `${call.spelling} takes at most ${plural(fn.args.length, "argument")}, got ${call.fields.length}: ${signature(fn)}`,
            true
        )
    }

    /** @param read the fn FS reads instead, glued to the rest. It needs brackets, so it won't compile */
    private unknown(start: number, end: number, word: string, read?: string) {
        const name = `$${word}`
        if (!this.guesses.has(name)) this.guesses.set(name, this.registry.suggest(name))
        const guess = this.guesses.get(name)

        let message = `Unknown function ${name}`
        if (read) message += `: ForgeScript reads it as ${read} followed by "${word.slice(read.length - 1)}"`
        message += guess ? `. Did you mean ${guess}?` : ". Is the extension that adds it installed?"

        this.find(Rule.unknownFunction, start, end, message, !!read)
    }

    private find(rule: Rule, start: number, end: number, message: string, fatal = false) {
        this.findings.push(fatal ? { rule, message, start, end, fatal } : { rule, message, start, end })
    }
}
