"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rule = exports.Severity = void 0;
/** How bad a problem is */
var Severity;
(function (Severity) {
    /** won't compile, errors at runtime, or does smth else than written */
    Severity["error"] = "error";
    /** prob a mistake */
    Severity["warning"] = "warning";
    /** style stuff, `--fix` handles it */
    Severity["info"] = "info";
})(Severity || (exports.Severity = Severity = {}));
/** Rule names, as cfgs & `$c[forgelint-disable ...]` use them */
var Rule;
(function (Rule) {
    Rule["unknownFunction"] = "unknown-function";
    /** `$pingms` = `$ping` + `ms` */
    Rule["gluedName"] = "glued-name";
    Rule["tooFewArguments"] = "too-few-arguments";
    Rule["tooManyArguments"] = "too-many-arguments";
    Rule["missingBrackets"] = "missing-brackets";
    /** `[...]` after a fn that takes no args, gets printed */
    Rule["unexpectedBrackets"] = "unexpected-brackets";
    Rule["unclosedBracket"] = "unclosed-bracket";
    /** a `]` meant for a text `[` closes the fn instead */
    Rule["unescapedBracket"] = "unescaped-bracket";
    /** top-level `]` that closes nothing */
    Rule["strayBracket"] = "stray-bracket";
    /** literal that can't be the arg's type, e.g. `$round[abc]` */
    Rule["invalidArgument"] = "invalid-argument";
    Rule["deprecated"] = "deprecated";
    /** `$authorid` vs `$authorID` */
    Rule["functionCase"] = "function-case";
})(Rule || (exports.Rule = Rule = {}));
//# sourceMappingURL=types.js.map