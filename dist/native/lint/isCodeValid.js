"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const loaded_1 = require("../../functions/loaded");
const Linter_1 = require("../../structures/Linter");
const types_1 = require("../../types");
exports.default = new forgescript_1.NativeFunction({
    name: "$isCodeValid",
    version: "1.0.0",
    aliases: ["$isValidCode"],
    description: "Checks whether the code has no errors, returns bool. Warnings are ignored",
    unwrap: true,
    brackets: true,
    args: [forgescript_1.Arg.requiredString("code", "The code to check")],
    output: forgescript_1.ArgType.Boolean,
    execute(ctx, [code]) {
        const problems = new Linter_1.Linter((0, loaded_1.loadedFunctions)(), (0, loaded_1.rulesOf)(ctx.client)).lint(code);
        return this.success(!problems.some((problem) => problem.severity === types_1.Severity.error));
    },
});
//# sourceMappingURL=isCodeValid.js.map