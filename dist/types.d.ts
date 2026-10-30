import type { IEdit } from "./structures/Formatter";
/** How bad a problem is. */
export declare enum Severity {
    /** It won't compile, errors at runtime, or does something other than what is written. */
    error = "error",
    /** Probably a mistake. */
    warning = "warning",
    /** Style issues. `--fix` handles them. */
    info = "info"
}
/** Rule names, as configs and `$c[forgelint-disable ...]` use them. */
export declare enum Rule {
    unknownFunction = "unknown-function",
    /** A command's `type` that is no event: the command never runs. */
    unknownEvent = "unknown-event",
    /** `$pingms` is `$ping` followed by `ms`. */
    gluedName = "glued-name",
    tooFewArguments = "too-few-arguments",
    tooManyArguments = "too-many-arguments",
    missingBrackets = "missing-brackets",
    /** `[...]` after a function that takes no arguments, which gets printed. */
    unexpectedBrackets = "unexpected-brackets",
    unclosedBracket = "unclosed-bracket",
    /** A `]` meant for a text `[` closes the function instead. */
    unescapedBracket = "unescaped-bracket",
    /** A top-level `]` that closes nothing. */
    strayBracket = "stray-bracket",
    /** A literal that can't be the argument's type, for example `$round[abc]`. */
    invalidArgument = "invalid-argument",
    /** A `$let` that nothing reads. */
    unusedVariable = "unused-variable",
    deprecated = "deprecated",
    /** `$authorid` instead of `$authorID`. */
    functionCase = "function-case"
}
export type RuleSetting = `${Severity}` | "off";
export type RuleSettings = Partial<Record<`${Rule}`, RuleSetting>>;
export interface IProblem {
    rule: Rule;
    severity: Severity;
    message: string;
    /** The offset in the code, or in the file once mapped. */
    start: number;
    end: number;
    /** Starts at 1. */
    line: number;
    /** Starts at 1. */
    column: number;
    /** An escape for the `]`, on a bracket problem in a file. */
    fix?: IEdit;
}
export interface IFunctionArg {
    name: string;
    required: boolean;
    /** Takes every field from here on. */
    rest: boolean;
    /** Parsed as a condition, like `a==b`. */
    condition: boolean;
    /** The `ArgType` name: `String`, `Number`, `Enum` and others. */
    type: string;
    /** The valid enum keys. */
    enum?: string[];
}
/** A function code can call, with the parts ForgeLint needs. */
export interface IFunctionInfo {
    /** With the `$`. */
    name: string;
    /** With the `$`. */
    aliases: string[];
    /** `undefined` means no brackets at all, `false` optional ones, `true` required ones. */
    brackets?: boolean;
    args: IFunctionArg[];
    /** Its arguments are resolved before it runs, and a bad literal causes an error. */
    unwrap: boolean;
    deprecated: boolean;
    description: string;
    /** Who adds it: `ForgeScript`, a package or a file. */
    source: string;
    /** Its arguments are unknown, it was found by name only. They aren't checked. */
    loose?: boolean;
    /** It may run code ForgeLint can't see with the caller's variables: a custom function, or a function of an extension that runs code with the caller's context. */
    opaque?: boolean;
}
/** `forgelint.config.js`. Paths in it are relative to it. */
export interface IForgeLintConfig {
    /**
     * Files and folders to check.
     * @default "."
     */
    include?: string | string[];
    /**
     * File or folder names to skip anywhere, or paths from the config's folder, for example `"tests"` or `"src/legacy"`.
     * `node_modules` and folders whose names start with a dot are always skipped, as are `dist`, `build`, `docs` and `coverage` at the top level.
     */
    exclude?: string | string[];
    /**
     * Keys holding ForgeScript in JavaScript and TypeScript files.
     * @default ["code"]
     */
    properties?: string | string[];
    /** Folders with custom functions, like the `functions` option of `ForgeClient`. They must be compiled `.js`. */
    functions?: string | string[];
    /** Folders with your own `NativeFunction`s, as compiled `.js`. */
    natives?: string | string[];
    /** Extensions to load functions and events from, by package name. Defaults to every dependency that depends on ForgeScript. */
    extensions?: string | string[];
    /** Functions ForgeLint can't find in your files, for example ones whose names are built in code. They are never reported as unknown. The `$` is optional. */
    known?: string | string[];
    rules?: RuleSettings;
    /** Spaces per indent level, or `"tab"`. Defaults to the indent the code already uses, otherwise 4. */
    indent?: number | "tab";
    /**
     * Top-level code lines go one level deeper than their `code:` line, and the closing `` ` `` lines up with it.
     * With `false`, top-level lines get the indent of the first code line.
     * @default true
     */
    alignToKey?: boolean;
}
/** The options of `new ForgeLint({ ... })`. */
export interface IForgeLintOptions {
    /**
     * Lints every command, slash command and custom function right before the bot logs in.
     * @default true
     */
    check?: boolean;
    /**
     * With `check` on, errors keep the bot from logging in: `login()` rejects.
     * @default false
     */
    stopOnError?: boolean;
    rules?: RuleSettings;
}
//# sourceMappingURL=types.d.ts.map