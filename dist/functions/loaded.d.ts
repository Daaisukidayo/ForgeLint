import { ForgeClient } from "@tryforge/forgescript";
import { FunctionRegistry } from "../structures/FunctionRegistry";
/** @returns every fn FS has loaded rn: its own, exts', custom ones. Rebuilt when they change */
export declare function loadedFunctions(): FunctionRegistry;
/** @returns the rules the client's ForgeLint got, if it has one */
export declare function rulesOf(client: ForgeClient): Partial<Record<"unknown-function" | "glued-name" | "too-few-arguments" | "too-many-arguments" | "missing-brackets" | "unexpected-brackets" | "unclosed-bracket" | "unescaped-bracket" | "stray-bracket" | "invalid-argument" | "deprecated" | "function-case", import("..").RuleSetting>> | undefined;
//# sourceMappingURL=loaded.d.ts.map