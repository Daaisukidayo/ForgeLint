import { IProblem, Rule, RuleSettings, Severity } from "../types";
import { FunctionRegistry } from "./FunctionRegistry";
export declare const DefaultSeverities: Record<Rule, Severity>;
/** @throws on an unknown rule or setting */
export declare function validateRules(rules?: RuleSettings): void;
/** Finds problems in ForgeScript code */
export declare class Linter {
    readonly registry: FunctionRegistry;
    private readonly rules;
    /** @throws on an unknown rule or setting */
    constructor(registry: FunctionRegistry, rules?: RuleSettings);
    /** @returns problems, in code order */
    lint(code: string): IProblem[];
    /** @returns `null` = off */
    private severityOf;
    /** @returns what's wrong w/ a call, syntax aside */
    private check;
}
//# sourceMappingURL=Linter.d.ts.map