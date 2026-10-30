"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rule = exports.Severity = void 0;
/** How bad a problem is. */
var Severity;
(function (Severity) {
    /** It won't compile, errors at runtime, or does something other than what is written. */
    Severity["error"] = "error";
    /** Probably a mistake. */
    Severity["warning"] = "warning";
    /** Style issues. `--fix` handles them. */
    Severity["info"] = "info";
})(Severity || (exports.Severity = Severity = {}));
/** Rule names, as configs and `$c[forgelint-disable ...]` use them. */
var Rule;
(function (Rule) {
    Rule["unknownFunction"] = "unknown-function";
    /** A command's `type` that is no event: the command never runs. */
    Rule["unknownEvent"] = "unknown-event";
    /** `$pingms` is `$ping` followed by `ms`. */
    Rule["gluedName"] = "glued-name";
    Rule["tooFewArguments"] = "too-few-arguments";
    Rule["tooManyArguments"] = "too-many-arguments";
    Rule["missingBrackets"] = "missing-brackets";
    /** `[...]` after a function that takes no arguments, which gets printed. */
    Rule["unexpectedBrackets"] = "unexpected-brackets";
    Rule["unclosedBracket"] = "unclosed-bracket";
    /** A `]` meant for a text `[` closes the function instead. */
    Rule["unescapedBracket"] = "unescaped-bracket";
    /** A top-level `]` that closes nothing. */
    Rule["strayBracket"] = "stray-bracket";
    /** A literal that can't be the argument's type, for example `$round[abc]`. */
    Rule["invalidArgument"] = "invalid-argument";
    /** A `$let` that nothing reads. */
    Rule["unusedVariable"] = "unused-variable";
    Rule["deprecated"] = "deprecated";
    /** `$authorid` instead of `$authorID`. */
    Rule["functionCase"] = "function-case";
})(Rule || (exports.Rule = Rule = {}));
//# sourceMappingURL=types.js.map