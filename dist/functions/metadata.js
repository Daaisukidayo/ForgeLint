"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromMetadata = fromMetadata;
/** @param source Who adds it, for example `ForgeScript`. */
function fromMetadata(data, source) {
    const args = data.args ?? [];
    return {
        name: data.name,
        aliases: (data.aliases ?? []).filter((alias) => typeof alias === "string"),
        brackets: data.brackets,
        args: args.map((arg) => ({
            name: arg.name,
            required: !!arg.required,
            rest: !!arg.rest,
            condition: !!arg.condition,
            type: arg.type,
            enum: arg.enum,
        })),
        // FS turns it off w/o args
        unwrap: !!data.unwrap && args.length > 0,
        deprecated: !!data.deprecated,
        description: data.description ?? "",
        source,
    };
}
//# sourceMappingURL=metadata.js.map