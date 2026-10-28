"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const loaded_1 = require("../../functions/loaded");
const output_1 = require("../../properties/output");
const Linter_1 = require("../../structures/Linter");
exports.default = new forgescript_1.NativeFunction({
    name: "$lintCode",
    version: "1.0.0",
    description: "Returns the problems found in the code",
    unwrap: true,
    brackets: true,
    args: [
        forgescript_1.Arg.requiredString("code", "The code to check"),
        forgescript_1.Arg.optionalEnum(output_1.LintOutput, "output", "The output format, json by default"),
    ],
    output: forgescript_1.ArgType.Json,
    execute(ctx, [code, output]) {
        const problems = new Linter_1.Linter((0, loaded_1.loadedFunctions)(), (0, loaded_1.rulesOf)(ctx.client)).lint(code);
        if (output === output_1.LintOutput.text) {
            return this.success(problems.map((p) => `${p.line}:${p.column} ${p.severity} ${p.message} (${p.rule})`).join("\n"));
        }
        return this.successJSON(problems.map(({ rule, severity, message, line, column }) => ({ rule, severity, message, line, column })));
    },
});
//# sourceMappingURL=lintCode.js.map