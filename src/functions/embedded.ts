import { IEdit } from "../structures/Formatter"
import { IProblem } from "../types"
import { ILiteral } from "./script"
import { locate } from "./text"

/** ForgeScript inside a file */
export interface IEmbedded {
    /** as FS gets it */
    code: string
    /** file offset of each code char, + the end's at `code.length` */
    map: number[]
    /** real line break here, not an escaped `\n`? */
    isLineBreak: (index: number) => boolean
    /** indentation of the file line the code starts on */
    indent: string
}

/** what a `${...}` reads as: no `$`, `[`, `]`, `;` or `\` to trip anything */
export const HOLE = String.fromCharCode(0xfffc)

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v" }

/** LS & PS: a `\` before them is a line continuation too */
const SEPARATORS = String.fromCharCode(0x2028, 0x2029)

/** @returns the char of a hex code point, nothing if it's broken */
const charOf = (hex: string) => {
    const point = parseInt(hex, 16)
    return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ""
}

/** @returns indentation of the offset's line */
export function indentAt(source: string, offset: number) {
    let start = offset
    while (start > 0 && source[start - 1] !== "\n") start--

    let end = start
    while (source[end] === " " || source[end] === "\t") end++
    return source.slice(start, end)
}

/** Builds code from a file's chars, remembering where each came from */
export class CodeBuilder {
    private code = ""
    private readonly map: number[] = []

    public constructor(private readonly source: string) {}

    /** @param at file offset `text` comes from */
    public push(text: string, at: number) {
        for (let i = 0; i < text.length; i++) this.map.push(at)
        this.code += text
    }

    /**
     * @param end file offset the code ends at
     * @param start file offset it starts at, for its indentation
     */
    public build(end: number, start: number): IEmbedded {
        const { code, map, source } = this
        map.push(end)

        return {
            code,
            map,
            isLineBreak: (index) =>
                code[index] === "\n" && (source[map[index]] === "\n" || source[map[index]] === "\r"),
            indent: indentAt(source, start),
        }
    }
}

/** @returns the string JS makes of a literal, w/ each `${...}` as 1 `HOLE` */
export function cook(source: string, literal: ILiteral): IEmbedded {
    const builder = new CodeBuilder(source)
    const holes = [...literal.holes]
    let i = literal.start

    while (i < literal.end) {
        if (holes[0]?.[0] === i) {
            builder.push(HOLE, i)
            i = holes.shift()![1]
            continue
        }

        const char = source[i]

        // JS reads template line breaks as `\n`
        if (char === "\r") {
            builder.push("\n", i)
            i += source[i + 1] === "\n" ? 2 : 1
            continue
        }

        if (char !== "\\" || literal.raw) {
            builder.push(char, i)
            i++
            continue
        }

        const next = source[i + 1]

        if (next in ESCAPES) {
            builder.push(ESCAPES[next], i)
            i += 2
        } else if (next === "\r") {
            // line continuation = nothing
            i += source[i + 2] === "\n" ? 3 : 2
        } else if (next === "\n" || (next && SEPARATORS.includes(next))) {
            i += 2
        } else if (next === "x") {
            builder.push(charOf(source.slice(i + 2, i + 4)), i)
            i += 4
        } else if (next === "u" && source[i + 2] === "{") {
            // a `}` past the literal = broken escape, don't jump there
            const close = source.indexOf("}", i)
            const end = close === -1 || close >= literal.end ? literal.end : close
            builder.push(charOf(source.slice(i + 3, end)), i)
            i = end + 1
        } else if (next === "u") {
            builder.push(charOf(source.slice(i + 2, i + 6)), i)
            i += 6
        } else if (next === "0" && !/\d/.test(source[i + 2] ?? "")) {
            builder.push("\0", i)
            i += 2
        } else {
            // `\\`, `` \` ``, `\$`, quotes
            builder.push(next ?? "", i)
            i += 2
        }
    }

    return builder.build(literal.end, literal.start)
}

/** @returns the problems w/ the file's offsets, lines & columns */
export function problemsInFile(problems: IProblem[], embedded: IEmbedded, starts: number[]): IProblem[] {
    return problems.map((problem) => {
        const start = embedded.map[problem.start]
        return { ...problem, start, end: embedded.map[problem.end], ...locate(starts, start) }
    })
}

/** @returns the code's edits as file edits. Ones that'd touch an escape are dropped */
export function editsInFile(source: string, embedded: IEmbedded, edits: IEdit[]): IEdit[] {
    return edits.flatMap((edit) => {
        const start = embedded.map[edit.start]
        const end = embedded.map[edit.end]
        const same = source.slice(start, end) === embedded.code.slice(edit.start, edit.end)
        return same ? [{ start, end, text: edit.text }] : []
    })
}
