import { FunctionRegistry, RuleSettings } from "../..";
/** The repository. Tests use its ForgeScript. */
export declare const ROOT: string;
export declare const EXAMPLE: string;
/** ForgeScript's functions plus a custom `$greet[name]`. */
export declare const registry: FunctionRegistry;
export declare const lint: (code: string, rules?: RuleSettings) => import("../..").IProblem[];
/** @returns The broken rules, in code order. */
export declare const rulesIn: (code: string, rules?: RuleSettings) => import("../..").Rule[];
export declare const format: (code: string, indent?: number | "tab") => string;
/**
 * @param files Maps a path to its content.
 * @returns A temporary folder with them, inside the repository for its ForgeScript to be found.
 */
export declare function folder(files: Record<string, string>): string;
//# sourceMappingURL=harness.d.ts.map