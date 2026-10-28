/** What `$lintCode` returns */
export enum LintOutput {
    /** `[{ rule, severity, message, line, column }]`. Default */
    json = "json",
    /** a line per problem: `1:5 error Unknown function $x (unknown-function)` */
    text = "text",
}
