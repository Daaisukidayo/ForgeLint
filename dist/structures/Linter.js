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
    [types_1.Rule.gluedName]: types_1.Severity.warning,
    [types_1.Rule.tooFewArguments]: types_1.Severity.error,
    [types_1.Rule.tooManyArguments]: types_1.Severity.error,
    [types_1.Rule.missingBrackets]: types_1.Severity.error,
    [types_1.Rule.unexpectedBrackets]: types_1.Severity.warning,
    [types_1.Rule.unclosedBracket]: types_1.Severity.error,
    [types_1.Rule.unescapedBracket]: types_1.Severity.error,
    [types_1.Rule.strayBracket]: types_1.Severity.warning,
    [types_1.Rule.invalidArgument]: types_1.Severity.error,
    [types_1.Rule.deprecated]: types_1.Severity.warning,
    [types_1.Rule.functionCase]: types_1.Severity.info,
};
const DIRECTIVE = /^forgelint-(disable-next-line|disable-line|disable|enable)(?:\s+([\s\S]*))?$/;
/** max enum values listed in a msg */
const SHOWN_VALUES = 8;
/** types FS makes smth out of empty text. Any other required arg errors when empty */
const EMPTY_OK = new Set(["String", "Unknown", "Number", "BigInt", "Time"]);
/** @throws on an unknown rule or setting */
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
/** @returns fields needed: up to the last required arg */
function minimumArgs(fn) {
    let needed = 0;
    fn.args.forEach((arg, i) => {
        if (arg.required)
            needed = i + 1;
    });
    return needed;
}
/** @returns the arg a field fills. A rest arg eats all fields from its own on */
function argAt(fn, index) {
    const rest = fn.args.findIndex((arg) => arg.rest);
    return fn.args[rest !== -1 && index >= rest ? rest : index];
}
/**
 * Only types FS checks the same way at runtime
 * @returns why plain text can't be the arg, to go after `Argument "x" of $fn`. Nothing if it can or isn't plain
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
/** @param directives in code order */
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
/** Finds problems in ForgeScript code */
class Linter {
    registry;
    rules;
    /** @throws on an unknown rule or setting */
    constructor(registry, rules = {}) {
        this.registry = registry;
        this.rules = rules;
        validateRules(rules);
    }
    /**
     * @param escaped how an escaped `]` is written where the code lives. Default `\]`, as FS reads it
     * @returns problems, in code order
     */
    lint(code, escaped) {
        const { calls, findings } = Parser_1.Parser.parse(code, this.registry, escaped);
        const all = (0, Parser_1.flatten)(calls);
        for (const call of all)
            findings.push(...this.check(code, call));
        const starts = (0, text_1.lineStarts)(code);
        const directives = directivesIn(all, starts);
        const comments = all.filter((call) => isComment(call) && call.open !== null);
        const problems = [];
        for (const { rule, message, start, end, fatal } of findings) {
            const severity = this.severityOf(rule);
            if (!severity)
                continue;
            // `$c` never runs, so in it only stuff that breaks compiling counts, or a `]` leaking text out
            const commented = comments.some((call) => start > call.open && start < (call.close ?? call.end));
            if (commented && !fatal && rule !== types_1.Rule.unescapedBracket)
                continue;
            const { line, column } = (0, text_1.locate)(starts, start);
            if (!silenced(rule, start, line, directives))
                problems.push({ rule, severity, message, start, end, line, column });
        }
        return problems.sort((a, b) => a.start - b.start || a.end - b.end);
    }
    /** @returns `null` = off */
    severityOf(rule) {
        const setting = this.rules[rule];
        if (setting === "off")
            return null;
        return setting ?? exports.DefaultSeverities[rule];
    }
    /** @returns what's wrong w/ a call, syntax aside */
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
        // a `${...}` could hold `;`s, so it may be more args
        const holes = call.fields.some((field) => code.slice(field.start, field.end).includes(embedded_1.HOLE));
        const needed = minimumArgs(fn);
        if (call.fields.length < needed && !holes) {
            found.push({
                rule: types_1.Rule.tooFewArguments,
                start: call.start,
                end: call.end,
                message: `${spelling} needs at least ${(0, text_1.plural)(needed, "argument")}, got ${call.fields.length}: ${(0, text_1.signature)(fn)}`,
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