/** What `$lintCode` returns. */
export enum LintOutput {
    /** The default: `[{ rule, severity, message, line, column }]`. */
    json = "json",
    /** A line per problem: `1:5 error Unknown function $x (unknown-function)`. */
    text = "text",
}
