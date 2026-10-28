import { Arg, ArgType, NativeFunction } from "@tryforge/forgescript"
import { loadedFunctions } from "../../functions/loaded"
import { Formatter } from "../../structures/Formatter"

export default new NativeFunction({
    name: "$formatCode",
    version: "1.0.0",
    description: "Returns the formatted code, with function names in their declared case and nested lines indented",
    unwrap: true,
    brackets: true,
    args: [
        Arg.requiredString("code", "The code to format"),
        Arg.optionalNumber("indent", "Spaces per indent level. Defaults to the indent the code uses, otherwise 4"),
    ],
    output: ArgType.String,
    execute(ctx, [code, indent]) {
        // left out = null or undefined
        const spaces = indent ?? undefined
        if (spaces !== undefined && (!Number.isInteger(spaces) || spaces < 1)) {
            return this.customError("The indent must be a positive whole number")
        }

        return this.success(new Formatter(loadedFunctions(), spaces).format(code))
    },
})
