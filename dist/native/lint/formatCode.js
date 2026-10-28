"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const loaded_1 = require("../../functions/loaded");
const Formatter_1 = require("../../structures/Formatter");
exports.default = new forgescript_1.NativeFunction({
    name: "$formatCode",
    version: "1.0.0",
    description: "Returns the formatted code, with function names in their declared case and nested lines indented",
    unwrap: true,
    brackets: true,
    args: [
        forgescript_1.Arg.requiredString("code", "The code to format"),
        forgescript_1.Arg.optionalNumber("indent", "Spaces per indent level. Defaults to the indent the code uses, otherwise 4"),
    ],
    output: forgescript_1.ArgType.String,
    execute(ctx, [code, indent]) {
        // left out = null or undefined
        const spaces = indent ?? undefined;
        if (spaces !== undefined && (!Number.isInteger(spaces) || spaces < 1)) {
            return this.customError("The indent must be a positive whole number");
        }
        return this.success(new Formatter_1.Formatter((0, loaded_1.loadedFunctions)(), spaces).format(code));
    },
});
//# sourceMappingURL=formatCode.js.map