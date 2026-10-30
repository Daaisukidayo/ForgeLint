import { Formatter, IEdit, applyEdits } from "../structures/Formatter"
import { Linter } from "../structures/Linter"
import { IProblem } from "../types"
import { IEmbedded, cook, editsInFile, problemsInFile } from "./embedded"
import { scanScript } from "./script"
import { lineStarts, locate } from "./text"

export interface IScriptOptions {
    /**
     * Keys holding ForgeScript, like the config's.
     * @default ["code"]
     */
    properties?: string[]
    /**
     * Like the config's.
     * @default true
     */
    alignToKey?: boolean
}

/** Lints and formats a file's codes. Offsets, lines and columns are the file's. */
export function checkText(text: string, codes: IEmbedded[], linter: Linter, formatter: Formatter, alignToKey = true) {
    const starts = lineStarts(text)
    const problems: IProblem[] = []
    const edits: IEdit[] = []

    for (const embedded of codes) {
        problems.push(...problemsInFile(linter.lint(embedded.code, embedded.escapedBracket), embedded, starts))
        edits.push(...editsInFile(text, embedded, formatter.edits(embedded.code, { ...embedded, alignToKey })))

        const { event } = embedded
        const found = event && linter.lintEvent(event.name)
        if (event && found)
            problems.push({ ...found, start: event.start, end: event.end, ...locate(starts, event.start) })
    }

    const formatted = applyEdits(text, edits)
    return {
        problems: problems.sort((a, b) => a.start - b.start || a.end - b.end),
        edits,
        /** The file with its codes formatted, if that changes something. */
        formatted: formatted === text ? undefined : formatted,
    }
}

/** Lints and formats the ForgeScript in a JavaScript or TypeScript file's text, saved or not, for example in an editor. */
export function checkScript(text: string, linter: Linter, formatter: Formatter, options: IScriptOptions = {}) {
    const { literals } = scanScript(text, new Set(options.properties ?? ["code"]))
    const codes = literals.map((literal) => cook(text, literal))
    return checkText(text, codes, linter, formatter, options.alignToKey)
}
