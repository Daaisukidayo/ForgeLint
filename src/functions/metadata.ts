import { IFunctionInfo } from "../types"

/** A function in an extension's `metadata/functions.json`, as ForgeScript's `generateMetadata` writes it. Only the parts ForgeLint reads. */
export interface IFunctionMetadata {
    name: string
    aliases?: string[]
    brackets?: boolean
    unwrap?: boolean
    deprecated?: boolean
    description?: string
    args?: Array<{
        name: string
        type: string
        required?: boolean
        rest?: boolean
        condition?: boolean
        enum?: string[]
    }>
}

/** @param source Who adds it, for example `ForgeScript`. */
export function fromMetadata(data: IFunctionMetadata, source: string): IFunctionInfo {
    const args = data.args ?? []

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
    }
}
