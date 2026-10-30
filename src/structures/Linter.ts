import { HOLE } from "../functions/embedded"
import { closest, lineStarts, locate, plural, signature } from "../functions/text"
import { IFunctionArg, IFunctionInfo, IProblem, Rule, RuleSettings, Severity } from "../types"
import { FunctionRegistry } from "./FunctionRegistry"
import { ICall, IField, IFinding, Parser, flatten } from "./Parser"

export const DefaultSeverities: Record<Rule, Severity> = {
    [Rule.unknownFunction]: Severity.error,
    [Rule.unknownEvent]: Severity.error,
    [Rule.gluedName]: Severity.warning,
    [Rule.tooFewArguments]: Severity.error,
    [Rule.tooManyArguments]: Severity.error,
    [Rule.missingBrackets]: Severity.error,
    [Rule.unexpectedBrackets]: Severity.warning,
    [Rule.unclosedBracket]: Severity.error,
    [Rule.unescapedBracket]: Severity.error,
    [Rule.strayBracket]: Severity.warning,
    [Rule.invalidArgument]: Severity.error,
    [Rule.unusedVariable]: Severity.warning,
    [Rule.deprecated]: Severity.warning,
    [Rule.functionCase]: Severity.info,
}

/** A `$c[forgelint-...]` directive. */
interface IDirective {
    kind: "disable" | "enable" | "disable-line" | "disable-next-line"
    /** `null` means every rule. */
    rules: string[] | null
    /** Right after the `$c[...]`. */
    at: number
    /** The line of its `]`. */
    line: number
}

const DIRECTIVE = /^forgelint-(disable-next-line|disable-line|disable|enable)(?:\s+([\s\S]*))?$/

/** The most enum values listed in a message. */
const SHOWN_VALUES = 8

/** Types ForgeScript makes something out of empty text. Any other required argument errors when empty. */
const EMPTY_OK = new Set(["String", "Unknown", "Number", "BigInt", "Time"])

/** @throws On an unknown rule or setting. */
export function validateRules(rules: RuleSettings = {}) {
    const names = Object.values(Rule) as string[]
    const settings = [...Object.values(Severity), "off"] as string[]

    for (const [rule, setting] of Object.entries(rules ?? {})) {
        if (!names.includes(rule)) throw new Error(`${rule} is not a rule. The rules are: ${names.join(", ")}.`)
        if (!settings.includes(setting as string)) {
            throw new Error(`Rule ${rule} can't be ${JSON.stringify(setting)}, only ${settings.join(", ")}.`)
        }
    }
}

/** @returns The fields needed, up to the last required argument. */
const minimumArgs = (fn: IFunctionInfo) => fn.args.map((arg) => arg.required).lastIndexOf(true) + 1

/** @returns The argument a field fills. A rest argument takes all fields from its own on. */
function argAt(fn: IFunctionInfo, index: number): IFunctionArg | undefined {
    const rest = fn.args.findIndex((arg) => arg.rest)
    return fn.args[rest !== -1 && index >= rest ? rest : index]
}

/**
 * Only types ForgeScript checks the same way at runtime.
 * @returns Why plain text can't be the argument, to go after `Argument "x" of $fn`. Nothing if it can or isn't plain.
 */
function invalidLiteral(arg: IFunctionArg, field: IField) {
    const value = field.literal
    // FS just leaves out an empty optional arg. A `${...}` could be anything
    if (arg.condition || value === null || (!arg.required && !value) || value.includes(HOLE)) return

    const shown = JSON.stringify(value)
    if (!value && !EMPTY_OK.has(arg.type)) return "is required but empty"

    switch (arg.type) {
        case "Number":
            return isNaN(Number(value)) ? `must be a number, not ${shown}` : undefined

        case "Boolean":
            return value === "true" || value === "false" ? undefined : `must be true or false, not ${shown}`

        case "Enum": {
            if (!arg.enum || arg.enum.includes(value)) return

            const names = arg.enum.filter((name) => isNaN(Number(name)))
            const more = names.length > SHOWN_VALUES ? ", ..." : ""
            return `must be one of ${names.slice(0, SHOWN_VALUES).join(", ")}${more}, not ${shown}`
        }
    }
}

const isComment = (call: ICall) => call.spelling.toLowerCase() === "$c"

/** Functions that read a variable. `$letSum` and the like add to what's there. */
const READS = new Set(["$get", "$has", "$letSum", "$letSub", "$letMulti", "$letDivide"])

/** Functions that run code that isn't in the text, with the same variables. */
const OPAQUE = new Set(["$eval", "$djsEval", "$callFunction", "$callLocalFunction"])

/** @returns The calls that run, nested ones too. The ones in a `$c` don't. */
const running = (calls: ICall[]): ICall[] =>
    calls.flatMap((call) => (isComment(call) ? [] : [call, ...running(call.fields.flatMap((field) => field.calls))]))

/**
 * Skips code calling an `opaque` or `OPAQUE` function: it may read the variables without a `$get` in the text.
 * @returns A finding per variable `$let` sets and nothing reads, at its first `$let`.
 */
function unusedVariables(calls: ICall[]): IFinding[] {
    const live = running(calls)
    if (live.some((call) => call.fn.opaque || OPAQUE.has(call.fn.name))) return []

    const set = new Map<string, IField>()
    const read = new Set<string>()

    for (const call of live) {
        const reads = READS.has(call.fn.name)
        if (!reads && call.fn.name !== "$let") continue

        // `null` = built in code, `HOLE` = a `${...}`: could be any name
        const name = call.fields[0]?.literal
        if (name == null || name.includes(HOLE)) {
            if (reads) return []
            continue
        }

        if (reads) read.add(name)
        else if (name && !set.has(name)) set.set(name, call.fields[0])
    }

    return [...set]
        .filter(([name]) => !read.has(name))
        .map(([name, field]) => {
            const other = [...read].find((key) => key.toLowerCase() === name.toLowerCase())
            return {
                rule: Rule.unusedVariable,
                start: field.start,
                end: field.end,
                message: `Variable ${name} is set but never read${other ? `: ${other} is another one, names are case-sensitive` : ""}`,
            }
        })
}

function directivesIn(calls: ICall[], starts: number[]) {
    const directives: IDirective[] = []

    for (const call of calls) {
        if (!isComment(call) || call.fields.some((field) => field.literal === null)) continue

        const match = DIRECTIVE.exec(
            call.fields
                .map((field) => field.literal)
                .join(";")
                .trim()
        )
        if (!match) continue

        const rules = match[2]?.split(/[\s,;]+/).filter(Boolean)
        directives.push({
            kind: match[1] as IDirective["kind"],
            rules: rules?.length ? rules : null,
            at: call.end,
            line: locate(starts, call.end - 1).line,
        })
    }

    return directives
}

/** @param directives In code order. */
function silenced(rule: Rule, start: number, line: number, directives: IDirective[]) {
    let off = false

    for (const directive of directives) {
        if (directive.rules && !directive.rules.includes(rule)) continue

        if (directive.kind === "disable-next-line" && line === directive.line + 1) return true
        if (directive.kind === "disable-line" && line === directive.line) return true

        if (directive.at <= start) {
            if (directive.kind === "disable") off = true
            else if (directive.kind === "enable") off = false
        }
    }

    return off
}

/** Finds problems in ForgeScript code. */
export class Linter {
    /**
     * @param events What a command's `type` can be. Without them, it isn't checked.
     * @throws On an unknown rule or setting.
     */
    public constructor(
        public readonly registry: FunctionRegistry,
        private readonly rules: RuleSettings = {},
        private readonly events?: ReadonlySet<string>
    ) {
        validateRules(rules)
    }

    /**
     * @param events What the command's manager listens to. Defaults to the ones it got. None means unchecked.
     * @returns The problem with a command's `type`, without a position. `null` if it's an event or the rule is off.
     */
    public lintEvent(type: string, events = this.events): Pick<IProblem, "rule" | "severity" | "message"> | null {
        const severity = this.severityOf(Rule.unknownEvent)
        if (!severity || !events?.size || events.has(type)) return null

        const guess = closest(type, events)
        const hint = guess ? `Did you mean ${guess}?` : "Is the extension that adds it installed?"
        return {
            rule: Rule.unknownEvent,
            severity,
            message: `Unknown event ${type}. ${hint}`,
        }
    }

    /**
     * @param escaped How an escaped `]` is written where the code lives. Defaults to `\]`, as ForgeScript reads it.
     * @returns The problems, in code order.
     */
    public lint(code: string, escaped?: string): IProblem[] {
        const { calls, findings } = Parser.parse(code, this.registry, escaped)

        const all = flatten(calls)
        for (const call of all) findings.push(...this.check(code, call))
        findings.push(...unusedVariables(calls))

        const starts = lineStarts(code)
        const directives = directivesIn(all, starts)
        const comments = all.filter((call) => isComment(call) && call.open !== null)
        const problems: IProblem[] = []

        for (const { rule, message, start, end, fatal } of findings) {
            const severity = this.severityOf(rule)
            if (!severity) continue

            // `$c` never runs: in it only stuff that breaks compiling counts, or a `]` leaking text out
            const commented = comments.some((call) => start > call.open! && start < (call.close ?? call.end))
            if (commented && !fatal && rule !== Rule.unescapedBracket) continue

            const { line, column } = locate(starts, start)
            if (!silenced(rule, start, line, directives))
                problems.push({ rule, severity, message, start, end, line, column })
        }

        return problems.sort((a, b) => a.start - b.start || a.end - b.end)
    }

    /** @returns `null` means off. */
    private severityOf(rule: Rule): Severity | null {
        const setting = this.rules[rule]
        if (setting === "off") return null
        return (setting as Severity | undefined) ?? DefaultSeverities[rule]
    }

    /** @returns What's wrong with a call, syntax aside. */
    private check(code: string, call: ICall): IFinding[] {
        const { fn, spelling } = call
        const found: IFinding[] = []

        const written = code.slice(call.nameStart, call.nameEnd)
        if (written !== spelling.slice(1)) {
            found.push({
                rule: Rule.functionCase,
                start: call.nameStart,
                end: call.nameEnd,
                message: `Write ${spelling}, not $${written}`,
            })
        }

        if (fn.deprecated) {
            found.push({
                rule: Rule.deprecated,
                start: call.start,
                end: call.nameEnd,
                message: `${spelling} is deprecated`,
            })
        }

        // unclosed = already reported & its fields are a guess
        if (call.close === null || fn.loose) return found

        // a `${...}` could hold `;`s, making more args
        const holes = call.fields.some((field) => code.slice(field.start, field.end).includes(HOLE))
        const needed = minimumArgs(fn)
        if (call.fields.length < needed && !holes) {
            found.push({
                rule: Rule.tooFewArguments,
                start: call.start,
                end: call.end,
                message: `${spelling} needs at least ${plural(needed, "argument")}, got ${call.fields.length}. Usage: ${signature(fn, spelling)}`,
            })
        }

        // w/o unwrap, the fn reads its fields itself
        if (!fn.unwrap) return found

        call.fields.forEach((field, i) => {
            const arg = argAt(fn, i)
            const why = arg && invalidLiteral(arg, field)
            if (why) {
                found.push({
                    rule: Rule.invalidArgument,
                    start: field.start,
                    end: field.end,
                    message: `Argument "${arg.name}" of ${spelling} ${why}`,
                })
            }
        })

        return found
    }
}
