import { ForgeClient, ForgeExtension } from "@tryforge/forgescript";
import { IFileReport } from "./structures";
import { IForgeLintConfig, IForgeLintOptions } from "./types";
export declare class ForgeLint extends ForgeExtension {
    readonly options: IForgeLintOptions;
    name: string;
    description: string;
    version: string;
    private static loaded;
    /** @throws On an unknown rule or setting. */
    constructor(options?: IForgeLintOptions);
    /** @throws If the client has none. */
    static of(client: ForgeClient): ForgeLint;
    init(client: ForgeClient): void;
    /**
     * Lints every command, slash command and custom function the client has.
     * @returns A report per file, or per code without one. Positions are the file's when the code is found in it.
     */
    check(client: ForgeClient): IFileReport[];
    /** @returns A file's codes, read once. */
    private read;
    /** @returns How many errors it found, 0 when it couldn't check. */
    private report;
}
/** For editor autocomplete: `module.exports = defineConfig({ ... })`. */
export declare const defineConfig: (config: IForgeLintConfig) => IForgeLintConfig;
export * from "./structures";
export * from "./types";
export { LintOutput } from "./properties/output";
export { checkScript, checkText } from "./functions/check";
export type { IScriptOptions } from "./functions/check";
export { fromCustom, fromNative } from "./functions/convert";
export { fromMetadata } from "./functions/metadata";
export type { IFunctionMetadata } from "./functions/metadata";
export type { ArgTypes } from "./functions/convert";
export type { IEmbedded } from "./functions/embedded";
export { loadedFunctions } from "./functions/loaded";
//# sourceMappingURL=index.d.ts.map