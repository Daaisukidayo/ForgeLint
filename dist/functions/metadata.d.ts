import { IFunctionInfo } from "../types";
/** A function in an extension's `metadata/functions.json`, as ForgeScript's `generateMetadata` writes it. Only the parts ForgeLint reads. */
export interface IFunctionMetadata {
    name: string;
    aliases?: string[];
    brackets?: boolean;
    unwrap?: boolean;
    deprecated?: boolean;
    description?: string;
    args?: Array<{
        name: string;
        type: string;
        required?: boolean;
        rest?: boolean;
        condition?: boolean;
        enum?: string[];
    }>;
}
/** @param source Who adds it, for example `ForgeScript`. */
export declare function fromMetadata(data: IFunctionMetadata, source: string): IFunctionInfo;
//# sourceMappingURL=metadata.d.ts.map