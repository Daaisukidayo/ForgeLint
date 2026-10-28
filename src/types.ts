/** How bad a problem is */
export enum Severity {
    /** won't compile, errors at runtime, or does smth else than written */
    error = "error",
    /** prob a mistake */
    warning = "warning",
    /** style stuff, `--fix` handles it */
    info = "info",
}

/** Rule names, as cfgs & `$c[forgelint-disable ...]` use them */
export enum Rule {
    unknownFunction = "unknown-function",
    /** `$pingms` = `$ping` + `ms` */
    gluedName = "glued-name",
    tooFewArguments = "too-few-arguments",
    tooManyArguments = "too-many-arguments",
    missingBrackets = "missing-brackets",
    /** `[...]` after a fn that takes no args, gets printed */
    unexpectedBrackets = "unexpected-brackets",
    unclosedBracket = "unclosed-bracket",
    /** a `]` meant for a text `[` closes the fn instead */
    unescapedBracket = "unescaped-bracket",
    /** top-level `]` that closes nothing */
    strayBracket = "stray-bracket",
    /** literal that can't be the arg's type, e.g. `$round[abc]` */
    invalidArgument = "invalid-argument",
    deprecated = "deprecated",
    /** `$authorid` vs `$authorID` */
    functionCase = "function-case",
}

export type RuleSetting = `${Severity}` | "off"

export type RuleSettings = Partial<Record<`${Rule}`, RuleSetting>>

export interface IProblem {
    rule: Rule
    severity: Severity
    message: string
    /** offset in the code, or in the file once mapped */
    start: number
    end: number
    /** 1-based */
    line: number
    /** 1-based */
    column: number
}

export interface IFunctionArg {
    name: string
    required: boolean
    /** eats every field from here on */
    rest: boolean
    /** parsed as `a==b` */
    condition: boolean
    /** `ArgType` name: `String`, `Number`, `Enum`... */
    type: string
    /** valid enum keys */
    enum?: string[]
}

/** A fn code can call, the bits ForgeLint needs */
export interface IFunctionInfo {
    /** w/ `$` */
    name: string
    /** w/ `$` */
    aliases: string[]
    /** `undefined` = no brackets at all, `false` = optional, `true` = required */
    brackets?: boolean
    args: IFunctionArg[]
    /** args resolve before it runs, so bad literals error */
    unwrap: boolean
    deprecated: boolean
    description: string
    /** who adds it: `ForgeScript`, a pkg, a file */
    source: string
    /** args unknown (found by name only), so they aren't checked */
    loose?: boolean
}

/** `forgelint.config.js`. Paths are relative to it */
export interface IForgeLintConfig {
    /** files & dirs to check. Default the cfg's dir */
    include?: string | string[]
    /**
     * Names or paths to skip, e.g. `"tests"`, `"src/legacy"`.
     * `node_modules` & dot-dirs are always skipped, top-level `dist`, `build`, `docs`, `coverage` too
     */
    exclude?: string | string[]
    /** keys holding ForgeScript in .js/.ts. Default `["code"]` */
    properties?: string | string[]
    /** custom fn dir(s), like `ForgeClient`'s `functions`. Compiled .js */
    functions?: string | string[]
    /** dir(s) of your own `NativeFunction`s, compiled .js */
    natives?: string | string[]
    /** pkgs whose fns count. Default every dep that depends on ForgeScript */
    extensions?: string | string[]
    /** fns made at runtime, never reported unknown. `$` optional */
    known?: string | string[]
    rules?: RuleSettings
    /** spaces per level or `"tab"`. Default whatever the code uses, else 4 */
    indent?: number | "tab"
    /** top-level code lines go 1 level deeper than their `code:` line, the closing `` ` `` in line w/ it. Default `true`. `false` = keep each code's own indent */
    alignToKey?: boolean
}

/** `new ForgeLint({ ... })` */
export interface IForgeLintOptions {
    /** lint every cmd, slash cmd & custom fn right before login. Default `true` */
    check?: boolean
    rules?: RuleSettings
}
