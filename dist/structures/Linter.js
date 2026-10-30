"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Linter = exports.DefaultSeverities = void 0;
exports.validateRules = validateRules;
const embedded_1 = require("../functions/embedded");
const text_1 = require("../functions/text");
const types_1 = require("../types");
const Parser_1 = require("./Parser");
exports.DefaultSeverities = {
    [types_1.Rule.unknownFunction]: types_1.Severity.error,
    [types_1.Rule.unknownEvent]: types_1.Severity.error,
    [types_1.Rule.gluedName]: types_1.Severity.warning,
    [types_1.Rule.tooFewArguments]: types_1.Severity.error,
    [types_1.Rule.tooManyArguments]: types_1.Severity.error,
    [types_1.Rule.missingBrackets]: types_1.Severity.error,
    [types_1.Rule.unexpectedBrackets]: types_1.Severity.warning,
    [types_1.Rule.unclosedBracket]: types_1.Severity.error,
    [types_1.Rule.unescapedBracket]: types_1.Severity.error,
    [types_1.Rule.strayBracket]: types_1.Severity.warning,
    [types_1.Rule.invalidArgument]: types_1.Severity.error,
    [types_1.Rule.unusedVariable]: types_1.Severity.warning,
    [types_1.Rule.deprecated]: types_1.Severity.warning,
    [types_1.Rule.functionCase]: types_1.Severity.info,
};
const DIRECTIVE = /^forgelint-(disable-next-line|disable-line|disable|enable)(?:\s+([\s\S]*))?$/;
/** The most enum values listed in a message. */
const SHOWN_VALUES = 8;
/** Types ForgeScript makes something out of empty text. Any other required argument errors when empty. */
const EMPTY_OK = new Set(["String", "Unknown", "Number", "BigInt", "Time"]);
/** @throws On an unknown rule or setting. */
function validateRules(rules = {}) {
    const names = Object.values(types_1.Rule);
    const settings = [...Object.values(types_1.Severity), "off"];
    for (const [rule, setting] of Object.entries(rules ?? {})) {
        if (!names.includes(rule))
            throw new Error(`${rule} is not a rule. The rules are: ${names.join(", ")}.`);
        if (!settings.includes(setting)) {
            throw new Error(`Rule ${rule} can't be ${JSON.stringify(setting)}, only ${settings.join(", ")}.`);
        }
    }
}
/** @returns The fields needed, up to the last required argument. */
const minimumArgs = (fn) => fn.args.map((arg) => arg.required).lastIndexOf(true) + 1;
/** @returns The argument a field fills. A rest argument takes all fields from its own on. */
function argAt(fn, index) {
    const rest = fn.args.findIndex((arg) => arg.rest);
    return fn.args[rest !== -1 && index >= rest ? rest : index];
}
/**
 * Only types ForgeScript checks the same way at runtime.
 * @returns Why plain text can't be the argument, to go after `Argument "x" of $fn`. Nothing if it can or isn't plain.
 */
function invalidLiteral(arg, field) {
    const value = field.literal;
    // FS just leaves out an empty optional arg. A `${...}` could be anything
    if (arg.condition || value === null || (!arg.required && !value) || value.includes(embedded_1.HOLE))
        return;
    const shown = JSON.stringify(value);
    if (!value && !EMPTY_OK.has(arg.type))
        return "is required but empty";
    switch (arg.type) {
        case "Number":
            return isNaN(Number(value)) ? `must be a number, not ${shown}` : undefined;
        case "Boolean":
            return value === "true" || value === "false" ? undefined : `must be true or false, not ${shown}`;
        case "Enum": {
            if (!arg.enum || arg.enum.includes(value))
                return;
            const names = arg.enum.filter((name) => isNaN(Number(name)));
            const more = names.length > SHOWN_VALUES ? ", ..." : "";
            return `must be one of ${names.slice(0, SHOWN_VALUES).join(", ")}${more}, not ${shown}`;
        }
    }
}
const isComment = (call) => call.spelling.toLowerCase() === "$c";
/** Functions that read a variable. `$letSum` and the like add to what's there. */
const READS = new Set(["$get", "$has", "$letSum", "$letSub", "$letMulti", "$letDivide"]);
/** Functions that run code that isn't in the text, with the same variables. */
const OPAQUE = new Set(["$eval", "$djsEval", "$callFunction", "$callLocalFunction"]);
/** @returns The calls that run, nested ones too. The ones in a `$c` don't. */
const running = (calls) => calls.flatMap((call) => (isComment(call) ? [] : [call, ...running(call.fields.flatMap((field) => field.calls))]));
/**
 * Skips code calling an `opaque` or `OPAQUE` function: it may read the variables without a `$get` in the text.
 * @returns A finding per variable `$let` sets and nothing reads, at its first `$let`.
 */
function unusedVariables(calls) {
    const live = running(calls);
    if (live.some((call) => call.fn.opaque || OPAQUE.has(call.fn.name)))
        return [];
    const set = new Map();
    const read = new Set();
    for (const call of live) {
        const reads = READS.has(call.fn.name);
        if (!reads && call.fn.name !== "$let")
            continue;
        // `null` = built in code, `HOLE` = a `${...}`: could be any name
        const name = call.fields[0]?.literal;
        if (name == null || name.includes(embedded_1.HOLE)) {
            if (reads)
                return [];
            continue;
        }
        if (reads)
            read.add(name);
        else if (name && !set.has(name))
            set.set(name, call.fields[0]);
    }
    return [...set]
        .filter(([name]) => !read.has(name))
        .map(([name, field]) => {
        const other = [...read].find((key) => key.toLowerCase() === name.toLowerCase());
        return {
            rule: types_1.Rule.unusedVariable,
            start: field.start,
            end: field.end,
            message: `Variable ${name} is set but never read${other ? `: ${other} is another one, names are case-sensitive` : ""}`,
        };
    });
}
function directivesIn(calls, starts) {
    const directives = [];
    for (const call of calls) {
        if (!isComment(call) || call.fields.some((field) => field.literal === null))
            continue;
        const match = DIRECTIVE.exec(call.fields
            .map((field) => field.literal)
            .join(";")
            .trim());
        if (!match)
            continue;
        const rules = match[2]?.split(/[\s,;]+/).filter(Boolean);
        directives.push({
            kind: match[1],
            rules: rules?.length ? rules : null,
            at: call.end,
            line: (0, text_1.locate)(starts, call.end - 1).line,
        });
    }
    return directives;
}
/** @param directives In code order. */
function silenced(rule, start, line, directives) {
    let off = false;
    for (const directive of directives) {
        if (directive.rules && !directive.rules.includes(rule))
            continue;
        if (directive.kind === "disable-next-line" && line === directive.line + 1)
            return true;
        if (directive.kind === "disable-line" && line === directive.line)
            return true;
        if (directive.at <= start) {
            if (directive.kind === "disable")
                off = true;
            else if (directive.kind === "enable")
                off = false;
        }
    }
    return off;
}
/** Finds problems in ForgeScript code. */
class Linter {
    registry;
    rules;
    events;
    /**
     * @param events What a command's `type` can be. Without them, it isn't checked.
     * @throws On an unknown rule or setting.
     */
    constructor(registry, rules = {}, events) {
        this.registry = registry;
        this.rules = rules;
        this.events = events;
        validateRules(rules);
    }
    /**
     * @param events What the command's manager listens to. Defaults to the ones it got. None means unchecked.
     * @returns The problem with a command's `type`, without a position. `null` if it's an event or the rule is off.
     */
    lintEvent(type, events = this.events) {
        const severity = this.severityOf(types_1.Rule.unknownEvent);
        if (!severity || !events?.size || events.has(type))
            return null;
        const guess = (0, text_1.closest)(type, events);
        const hint = guess ? `Did you mean ${guess}?` : "Is the extension that adds it installed?";
        return {
            rule: types_1.Rule.unknownEvent,
            severity,
            message: `Unknown event ${type}. ${hint}`,
        };
    }
    /**
     * @param escaped How an escaped `]` is written where the code lives. Defaults to `\]`, as ForgeScript reads it.
     * @returns The problems, in code order.
     */
    lint(code, escaped) {
        const { calls, findings } = Parser_1.Parser.parse(code, this.registry, escaped);
        const all = (0, Parser_1.flatten)(calls);
        for (const call of all)
            findings.push(...this.check(code, call));
        findings.push(...unusedVariables(calls));
        const starts = (0, text_1.lineStarts)(code);
        const directives = directivesIn(all, starts);
        const comments = all.filter((call) => isComment(call) && call.open !== null);
        const problems = [];
        for (const { rule, message, start, end, fatal } of findings) {
            const severity = this.severityOf(rule);
            if (!severity)
                continue;
            // `$c` never runs: in it only stuff that breaks compiling counts, or a `]` leaking text out
            const commented = comments.some((call) => start > call.open && start < (call.close ?? call.end));
            if (commented && !fatal && rule !== types_1.Rule.unescapedBracket)
                continue;
            const { line, column } = (0, text_1.locate)(starts, start);
            if (!silenced(rule, start, line, directives))
                problems.push({ rule, severity, message, start, end, line, column });
        }
        return problems.sort((a, b) => a.start - b.start || a.end - b.end);
    }
    /** @returns `null` means off. */
    severityOf(rule) {
        const setting = this.rules[rule];
        if (setting === "off")
            return null;
        return setting ?? exports.DefaultSeverities[rule];
    }
    /** @returns What's wrong with a call, syntax aside. */
    check(code, call) {
        const { fn, spelling } = call;
        const found = [];
        const written = code.slice(call.nameStart, call.nameEnd);
        if (written !== spelling.slice(1)) {
            found.push({
                rule: types_1.Rule.functionCase,
                start: call.nameStart,
                end: call.nameEnd,
                message: `Write ${spelling}, not $${written}`,
            });
        }
        if (fn.deprecated) {
            found.push({
                rule: types_1.Rule.deprecated,
                start: call.start,
                end: call.nameEnd,
                message: `${spelling} is deprecated`,
            });
        }
        // unclosed = already reported & its fields are a guess
        if (call.close === null || fn.loose)
            return found;
        // a `${...}` could hold `;`s, making more args
        const holes = call.fields.some((field) => code.slice(field.start, field.end).includes(embedded_1.HOLE));
        const needed = minimumArgs(fn);
        if (call.fields.length < needed && !holes) {
            found.push({
                rule: types_1.Rule.tooFewArguments,
                start: call.start,
                end: call.end,
                message: `${spelling} needs at least ${(0, text_1.plural)(needed, "argument")}, got ${call.fields.length}. Usage: ${(0, text_1.signature)(fn, spelling)}`,
            });
        }
        // w/o unwrap, the fn reads its fields itself
        if (!fn.unwrap)
            return found;
        call.fields.forEach((field, i) => {
            const arg = argAt(fn, i);
            const why = arg && invalidLiteral(arg, field);
            if (why) {
                found.push({
                    rule: types_1.Rule.invalidArgument,
                    start: field.start,
                    end: field.end,
                    message: `Argument "${arg.name}" of ${spelling} ${why}`,
                });
            }
        });
        return found;
    }
}
exports.Linter = Linter;
//# sourceMappingURL=Linter.js.map