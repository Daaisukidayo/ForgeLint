import { IFunctionInfo, IProblem } from "../types"

/** @returns The problem without its offsets, for output. */
export function brief(problem: IProblem) {
    const { rule, severity, message, line, column } = problem
    return { rule, severity, message, line, column }
}

/** @returns The offset of each line's start. The first one is 0. */
export function lineStarts(text: string, isLineBreak = (index: number) => text[index] === "\n") {
    const starts = [0]
    for (let i = 0; i < text.length; i++) if (isLineBreak(i)) starts.push(i + 1)
    return starts
}

/**
 * @param starts From `lineStarts`.
 * @returns The line and column, both starting at 1.
 */
export function locate(starts: number[], offset: number) {
    let low = 0
    let high = starts.length - 1

    while (low < high) {
        const mid = (low + high + 1) >> 1
        if (starts[mid] <= offset) low = mid
        else high = mid - 1
    }

    return { line: low + 1, column: offset - starts[low] + 1 }
}

/** Levenshtein distance, plus swapping two neighbors. Stops with `max + 1` once it's over `max`. */
export function distance(a: string, b: string, max: number) {
    if (Math.abs(a.length - b.length) > max) return max + 1

    let before: number[] = []
    let previous = Array.from({ length: b.length + 1 }, (_, j) => j)

    for (let i = 1; i <= a.length; i++) {
        const row = [i]
        let best = i

        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            let value = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + cost)
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                value = Math.min(value, before[j - 2] + 1)
            }

            row[j] = value
            best = Math.min(best, value)
        }

        if (best > max) return max + 1
        before = previous
        previous = row
    }

    return previous[b.length]
}

/** @returns The closest of `names`, if it's close enough to be a typo. Case doesn't count. */
export function closest(name: string, names: Iterable<string>) {
    const wanted = name.toLowerCase()
    // `$a` is 1 edit away from tons of names, none of them meant
    const max = wanted.length > 5 ? 2 : wanted.length > 3 ? 1 : 0
    if (!max) return

    let best: string | undefined
    let bestDistance = max + 1

    for (const candidate of names) {
        const edits = distance(wanted, candidate.toLowerCase(), max)
        if (edits < bestDistance) {
            best = candidate
            bestDistance = edits
        }
    }

    return best
}

/**
 * @param name For example the alias the code used. Defaults to its own name.
 * @returns For example `$sendMessage[channel ID;content?;return message ID?]`.
 */
export function signature(fn: IFunctionInfo, name = fn.name) {
    // args unknown, but it still takes some
    if (fn.loose && fn.brackets !== undefined) return `${name}[...args]`
    if (fn.brackets === undefined || !fn.args.length) return name

    const args = fn.args.map((arg) => `${arg.name}${arg.rest ? "..." : ""}${arg.required ? "" : "?"}`)
    return `${name}[${args.join(";")}]`
}

/** @returns For example `1 argument` or `2 arguments`. */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`
