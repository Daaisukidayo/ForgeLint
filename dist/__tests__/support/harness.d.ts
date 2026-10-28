import { FunctionRegistry, RuleSettings } from "../..";
/** the repo, tests use its FS */
export declare const ROOT: string;
export declare const EXAMPLE: string;
/** FS's fns + a custom `$greet[name]` */
export declare const registry: FunctionRegistry;
export declare const lint: (code: string, rules?: RuleSettings) => import("../..").IProblem[];
/** @returns broken rules, in code order */
export declare const rulesIn: (code: string, rules?: RuleSettings) => import("../..").Rule[];
export declare const format: (code: string, indent?: number | "tab") => string;
/**
 * @param files path → content
 * @returns a temp dir w/ them, inside the repo so its FS gets found
 */
export declare function folder(files: Record<string, string>): string;
//# sourceMappingURL=harness.d.ts.map