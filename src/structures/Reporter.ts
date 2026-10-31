import { bold, cyan, green, grey, red, yellow } from "../functions/paint"
import { plural } from "../functions/text"
import { Rule, Severity } from "../types"
import { IFileReport } from "./Project"

const COLORS: Record<Severity, (text: string) => string> = {
    [Severity.error]: red,
    [Severity.warning]: yellow,
    [Severity.info]: cyan,
}

/** Prints problems by file, then a summary. */
export class Reporter {
    private readonly started = performance.now()

    /** @param write Defaults to `console.log`. */
    public constructor(private readonly write: (line: string) => void = (line) => console.log(line)) {}

    /**
     * The header, every file, then the summary.
     * @param functions How many are known.
     * @returns How many errors there are.
     */
    public print(reports: IFileReport[], functions: number, notes: string[] = [], formatting = false, fixed = 0) {
        const codes = reports.reduce((sum, report) => sum + report.codes, 0)
        this.start(reports.length, codes, functions)
        this.notes(notes)
        for (const report of reports) this.file(report, formatting)
        return this.summary(reports, formatting, fixed)
    }

    public start(files: number, codes: number, functions: number) {
        this.write(
            `${bold(cyan("ForgeLint"))}  ${plural(codes, "code")} in ${plural(files, "file")}, ${plural(functions, "function")} known`
        )
    }

    /** @param notes What failed to load. */
    public notes(notes: string[]) {
        for (const note of notes) this.write(grey(`  ${note}`))
    }

    /**
     * Prints nothing for a clean file.
     * @param formatting Also say if it isn't formatted.
     */
    public file(report: IFileReport, formatting = false) {
        const unformatted = formatting && report.formatted !== undefined
        if (!report.problems.length && !unformatted) return

        this.write("")
        this.write(bold(report.file))

        const width = Math.max(0, ...report.problems.map((problem) => `${problem.line}:${problem.column}`.length))
        for (const { line, column, severity, message, rule } of report.problems) {
            const at = `${line}:${column}`.padEnd(width)
            this.write(`  ${grey(at)}  ${COLORS[severity](severity.padEnd(7))}  ${message}  ${grey(rule)}`)
        }

        if (unformatted) this.write(`  ${yellow("not formatted")}  ${grey("forgelint --fix formats it")}`)
    }

    /**
     * Counts and time.
     * @param formatting Count unformatted files too.
     * @param fixed Files `--fix` formatted.
     * @returns How many errors there are.
     */
    public summary(reports: IFileReport[], formatting = false, fixed = 0) {
        const problems = reports.flatMap((report) => report.problems)
        const count = (severity: Severity) => problems.filter((problem) => problem.severity === severity).length
        const [errors, warnings, infos] = [count(Severity.error), count(Severity.warning), count(Severity.info)]
        const unformatted = formatting ? reports.filter((report) => report.formatted !== undefined).length : 0
        const seconds = grey(`(${((performance.now() - this.started) / 1000).toFixed(2)} s)`)

        this.write("")
        if (fixed) this.write(green(`Formatted ${plural(fixed, "file")}.`))

        if (!problems.length && !unformatted) {
            this.write(`${green("✓ No problems")} ${seconds}`)
            return 0
        }

        const parts: string[] = []
        if (errors) parts.push(red(plural(errors, "error")))
        if (warnings) parts.push(yellow(plural(warnings, "warning")))
        if (infos) parts.push(cyan(`${infos} info`))
        if (unformatted) parts.push(yellow(`${plural(unformatted, "file")} not formatted`))

        this.write(`${errors || unformatted ? red("✗") : yellow("!")} ${parts.join(", ")} ${seconds}`)
        // of the rules, `--fix` only fixes the case of names
        if (!fixed && problems.some((problem) => problem.rule === Rule.functionCase)) {
            this.write(grey("forgelint --fix fixes the function-case ones"))
        }
        return errors
    }
}
