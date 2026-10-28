import { ForgeClient, ForgeExtension } from "@tryforge/forgescript";
import { IFileReport } from "./structures";
import { IForgeLintConfig, IForgeLintOptions } from "./types";
export declare class ForgeLint extends ForgeExtension {
    readonly options: IForgeLintOptions;
    name: string;
    description: string;
    version: string;
    private static loaded;
    /** @throws on an unknown rule or setting */
    constructor(options?: IForgeLintOptions);
    /** @throws if the client has none */
    static of(client: ForgeClient): ForgeLint;
    init(client: ForgeClient): void;
    /**
     * Lints every cmd, slash cmd & custom fn the client has
     * @returns a report per file, or per code w/o one. Positions are the file's when the code's found in it
     */
    check(client: ForgeClient): IFileReport[];
    /** @returns a file's codes, read once */
    private read;
    private report;
}
/** For editor autocomplete: `module.exports = defineConfig({ ... })` */
export declare const defineConfig: (config: IForgeLintConfig) => IForgeLintConfig;
export * from "./structures";
export * from "./types";
export { LintOutput } from "./properties/output";
export { fromCustom, fromNative } from "./functions/convert";
export type { ArgTypes } from "./functions/convert";
export type { IEmbedded } from "./functions/embedded";
export { loadedFunctions } from "./functions/loaded";
//# sourceMappingURL=index.d.ts.map