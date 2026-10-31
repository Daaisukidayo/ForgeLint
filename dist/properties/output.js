"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LintOutput = void 0;
/** What `$lintCode` returns. */
var LintOutput;
(function (LintOutput) {
    /** The default: `[{ rule, severity, message, line, column }]`. */
    LintOutput["json"] = "json";
    /** A line per problem: `1:5 error Unknown function $x (unknown-function)`. */
    LintOutput["text"] = "text";
})(LintOutput || (exports.LintOutput = LintOutput = {}));
//# sourceMappingURL=output.js.map