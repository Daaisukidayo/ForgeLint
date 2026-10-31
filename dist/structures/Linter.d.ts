import { IProblem, Rule, RuleSettings, Severity } from "../types";
import { FunctionRegistry } from "./FunctionRegistry";
export declare const DefaultSeverities: Record<Rule, Severity>;
/** @throws On an unknown rule or setting. */
export declare function validateRules(rules?: RuleSettings): void;
/** Finds problems in ForgeScript code. */
export declare class Linter {
    readonly registry: FunctionRegistry;
    private readonly rules;
    private readonly events?;
    /**
     * @param events What a command's `type` can be. Without them, it isn't checked.
     * @throws On an unknown rule or setting.
     */
    constructor(registry: FunctionRegistry, rules?: RuleSettings, events?: ReadonlySet<string> | undefined);
    /**
     * @param events What the command's manager listens to. Defaults to the ones it got. None means unchecked.
     * @returns The problem with a command's `type`, without a position. `null` if it's an event or the rule is off.
     */
    lintEvent(type: string, events?: ReadonlySet<string> | undefined): Pick<IProblem, "rule" | "severity" | "message"> | null;
    /**
     * @param escaped How an escaped `]` is written where the code lives. Defaults to `\]`, as ForgeScript reads it.
     * @returns The problems, in code order.
     */
    lint(code: string, escaped?: string): IProblem[];
    /** @returns `null` means off. */
    private severityOf;
    /** @returns What's wrong with a call, syntax aside. */
    private check;
}
//# sourceMappingURL=Linter.d.ts.map