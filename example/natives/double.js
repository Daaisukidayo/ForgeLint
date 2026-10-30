// your own native: $double[number]. Compiled .js: ForgeLint checks its args
const { Arg, ArgType, NativeFunction } = require("@tryforge/forgescript")

exports.default = new NativeFunction({
    name: "$double",
    description: "Doubles a number",
    unwrap: true,
    brackets: true,
    args: [Arg.requiredNumber("number", "What to double")],
    output: ArgType.Number,
    execute(ctx, [number]) {
        return this.success(number * 2)
    },
})
