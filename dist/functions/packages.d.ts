import { FunctionRegistry } from "../structures/FunctionRegistry";
import { ArgTypes } from "./convert";
export declare const FORGESCRIPT = "@tryforge/forgescript";
/**
 * Code that runs code with the caller's context, which can read the caller's variables.
 * Shortcut: it goes by ForgeScript's `ctx` naming, and a package calling it something else slips through. Widen it if one shows up.
 */
export declare const CALLER: RegExp;
/**
 * Looks up `node_modules` folders like `require` does.
 * @returns The package's folder, `null` if it's not installed or not a valid name.
 */
export declare function findPackage(name: string, from: string): string | null;
/** @returns The nearest folder with a package.json, itself included, or itself if there's none. */
export declare function projectRoot(from: string): string;
/** @returns Whether Node runs the folder's `.js` files as ESM. */
export declare const isModule: (dir: string) => boolean;
/** @returns The bot's dependencies that depend on ForgeScript, also known as its extensions. */
export declare function extensionsOf(root: string): string[];
/** @returns Whether a `.js` file in the folder runs code with the caller's context. */
export declare const touchesCaller: (dir: string) => boolean;
/**
 * Adds every `NativeFunction` in a folder, like `ForgeExtension.load` would, without starting the extension.
 * @param argTypes The `ArgType` of the ForgeScript they're built with.
 * @param opaque Whether they may run code with the caller's variables, see `touchesCaller`.
 * @returns Why files failed to load.
 * @throws If the folder doesn't exist.
 */
export declare function loadNatives(dir: string, source: string, registry: FunctionRegistry, argTypes?: ArgTypes, opaque?: boolean): string[];
/**
 * Adds the event of every handler in a folder, the way `EventManager.load` reads them, without listening to any.
 * @returns Why files failed to load.
 * @throws If the folder doesn't exist.
 */
export declare function loadEvents(dir: string, events: Set<string>): string[];
/**
 * Adds custom functions like the `functions` option of `ForgeClient` does: a `.js` file exports one, an array or `ForgeFunction`s.
 * They replace functions of the same name.
 * @returns Why files failed to load.
 * @throws If the folder doesn't exist.
 */
export declare function loadCustomFunctions(dir: string, source: string, registry: FunctionRegistry, argTypes?: ArgTypes): string[];
//# sourceMappingURL=packages.d.ts.map