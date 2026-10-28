"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LintOutput = void 0;
/** What `$lintCode` returns */
var LintOutput;
(function (LintOutput) {
    /** `[{ rule, severity, message, line, column }]`. Default */
    LintOutput["json"] = "json";
    /** a line per problem: `1:5 error Unknown function $x (unknown-function)` */
    LintOutput["text"] = "text";
})(LintOutput || (exports.LintOutput = LintOutput = {}));
//# sourceMappingURL=output.js.map