import { ForgeClient } from "@tryforge/forgescript";
import { FunctionRegistry } from "../structures/FunctionRegistry";
/** @returns Every function ForgeScript has loaded right now: its own, the extensions' and custom ones. It's rebuilt when they change. */
export declare function loadedFunctions(): FunctionRegistry;
/** @returns The rules of the client's ForgeLint, if it has one. */
export declare function rulesOf(client: ForgeClient): Partial<Record<"deprecated" | "unknown-function" | "unknown-event" | "glued-name" | "too-few-arguments" | "too-many-arguments" | "missing-brackets" | "unexpected-brackets" | "unclosed-bracket" | "unescaped-bracket" | "stray-bracket" | "invalid-argument" | "unused-variable" | "function-case", import("../types").RuleSetting>> | undefined;
//# sourceMappingURL=loaded.d.ts.map