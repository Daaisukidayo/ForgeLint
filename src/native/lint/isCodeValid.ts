import { Arg, ArgType, NativeFunction } from "@tryforge/forgescript"
import { loadedFunctions, rulesOf } from "../../functions/loaded"
import { Linter } from "../../structures/Linter"
import { Severity } from "../../types"

export default new NativeFunction({
    name: "$isCodeValid",
    version: "1.0.0",
    aliases: ["$isValidCode"],
    description: "Checks whether the code has no errors, returns bool. Warnings are ignored",
    unwrap: true,
    brackets: true,
    args: [Arg.requiredString("code", "The code to check")],
    output: ArgType.Boolean,
    execute(ctx, [code]) {
        const problems = new Linter(loadedFunctions(), rulesOf(ctx.client)).lint(code)
        return this.success(!problems.some((problem) => problem.severity === Severity.error))
    },
})
