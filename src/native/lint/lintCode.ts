import { Arg, ArgType, NativeFunction } from "@tryforge/forgescript"
import { loadedFunctions, rulesOf } from "../../functions/loaded"
import { LintOutput } from "../../properties/output"
import { Linter } from "../../structures/Linter"

export default new NativeFunction({
    name: "$lintCode",
    version: "1.0.0",
    description: "Returns the problems found in the code",
    unwrap: true,
    brackets: true,
    args: [
        Arg.requiredString("code", "The code to check"),
        Arg.optionalEnum(LintOutput, "output", "The output format, json by default"),
    ],
    output: ArgType.Json,
    execute(ctx, [code, output]) {
        const problems = new Linter(loadedFunctions(), rulesOf(ctx.client)).lint(code)

        if (output === LintOutput.text) {
            return this.success(
                problems.map((p) => `${p.line}:${p.column} ${p.severity} ${p.message} (${p.rule})`).join("\n")
            )
        }

        return this.successJSON(
            problems.map(({ rule, severity, message, line, column }) => ({ rule, severity, message, line, column }))
        )
    },
})
