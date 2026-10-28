import { FunctionRegistry } from "../structures/FunctionRegistry";
import { ArgTypes } from "./convert";
export declare const FORGESCRIPT = "@tryforge/forgescript";
/**
 * Looks up `node_modules` dirs like `require` does
 * @returns the pkg's dir, `null` if it's not installed or not a valid name
 */
export declare function findPackage(name: string, from: string): string | null;
/** @returns nearest dir w/ a package.json, itself incl., or itself if there's none */
export declare function projectRoot(from: string): string;
/** @returns the bot's deps that depend on ForgeScript, aka its extensions */
export declare function extensionsOf(root: string): string[];
/**
 * Adds every `NativeFunction` in a dir, like `ForgeExtension.load` would, w/o starting the ext
 * @param argTypes the `ArgType` of the FS they're built w/
 * @returns why files failed to load
 * @throws if the dir doesn't exist
 */
export declare function loadNatives(dir: string, source: string, registry: FunctionRegistry, argTypes?: ArgTypes): string[];
/**
 * Adds custom fns like `ForgeClient`'s `functions` does: a .js exports one, an array or `ForgeFunction`s.
 * They replace fns of the same name
 * @returns why files failed to load
 * @throws if the dir doesn't exist
 */
export declare function loadCustomFunctions(dir: string, source: string, registry: FunctionRegistry, argTypes?: ArgTypes): string[];
//# sourceMappingURL=packages.d.ts.map