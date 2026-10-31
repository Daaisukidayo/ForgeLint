"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reporter = void 0;
const paint_1 = require("../functions/paint");
const text_1 = require("../functions/text");
const types_1 = require("../types");
const COLORS = {
    [types_1.Severity.error]: paint_1.red,
    [types_1.Severity.warning]: paint_1.yellow,
    [types_1.Severity.info]: paint_1.cyan,
};
/** Prints problems by file, then a summary. */
class Reporter {
    write;
    started = performance.now();
    /** @param write Defaults to `console.log`. */
    constructor(write = (line) => console.log(line)) {
        this.write = write;
    }
    /**
     * The header, every file, then the summary.
     * @param functions How many are known.
     * @returns How many errors there are.
     */
    print(reports, functions, notes = [], formatting = false, fixed = 0) {
        const codes = reports.reduce((sum, report) => sum + report.codes, 0);
        this.start(reports.length, codes, functions);
        this.notes(notes);
        for (const report of reports)
            this.file(report, formatting);
        return this.summary(reports, formatting, fixed);
    }
    start(files, codes, functions) {
        this.write(`${(0, paint_1.bold)((0, paint_1.cyan)("ForgeLint"))}  ${(0, text_1.plural)(codes, "code")} in ${(0, text_1.plural)(files, "file")}, ${(0, text_1.plural)(functions, "function")} known`);
    }
    /** @param notes What failed to load. */
    notes(notes) {
        for (const note of notes)
            this.write((0, paint_1.grey)(`  ${note}`));
    }
    /**
     * Prints nothing for a clean file.
     * @param formatting Also say if it isn't formatted.
     */
    file(report, formatting = false) {
        const unformatted = formatting && report.formatted !== undefined;
        if (!report.problems.length && !unformatted)
            return;
        this.write("");
        this.write((0, paint_1.bold)(report.file));
        const width = Math.max(0, ...report.problems.map((problem) => `${problem.line}:${problem.column}`.length));
        for (const { line, column, severity, message, rule } of report.problems) {
            const at = `${line}:${column}`.padEnd(width);
            this.write(`  ${(0, paint_1.grey)(at)}  ${COLORS[severity](severity.padEnd(7))}  ${message}  ${(0, paint_1.grey)(rule)}`);
        }
        if (unformatted)
            this.write(`  ${(0, paint_1.yellow)("not formatted")}  ${(0, paint_1.grey)("forgelint --fix formats it")}`);
    }
    /**
     * Counts and time.
     * @param formatting Count unformatted files too.
     * @param fixed Files `--fix` formatted.
     * @returns How many errors there are.
     */
    summary(reports, formatting = false, fixed = 0) {
        const problems = reports.flatMap((report) => report.problems);
        const count = (severity) => problems.filter((problem) => problem.severity === severity).length;
        const [errors, warnings, infos] = [count(types_1.Severity.error), count(types_1.Severity.warning), count(types_1.Severity.info)];
        const unformatted = formatting ? reports.filter((report) => report.formatted !== undefined).length : 0;
        const seconds = (0, paint_1.grey)(`(${((performance.now() - this.started) / 1000).toFixed(2)} s)`);
        this.write("");
        if (fixed)
            this.write((0, paint_1.green)(`Formatted ${(0, text_1.plural)(fixed, "file")}.`));
        if (!problems.length && !unformatted) {
            this.write(`${(0, paint_1.green)("✓ No problems")} ${seconds}`);
            return 0;
        }
        const parts = [];
        if (errors)
            parts.push((0, paint_1.red)((0, text_1.plural)(errors, "error")));
        if (warnings)
            parts.push((0, paint_1.yellow)((0, text_1.plural)(warnings, "warning")));
        if (infos)
            parts.push((0, paint_1.cyan)(`${infos} info`));
        if (unformatted)
            parts.push((0, paint_1.yellow)(`${(0, text_1.plural)(unformatted, "file")} not formatted`));
        this.write(`${errors || unformatted ? (0, paint_1.red)("✗") : (0, paint_1.yellow)("!")} ${parts.join(", ")} ${seconds}`);
        // of the rules, `--fix` only fixes the case of names
        if (!fixed && problems.some((problem) => problem.rule === types_1.Rule.functionCase)) {
            this.write((0, paint_1.grey)("forgelint --fix fixes the function-case ones"));
        }
        return errors;
    }
}
exports.Reporter = Reporter;
//# sourceMappingURL=Reporter.js.map