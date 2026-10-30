import { IFileReport } from "./Project";
/** Prints problems by file, then a summary. */
export declare class Reporter {
    private readonly write;
    private readonly started;
    /** @param write Defaults to `console.log`. */
    constructor(write?: (line: string) => void);
    /**
     * The header, every file, then the summary.
     * @param functions How many are known.
     * @returns How many errors there are.
     */
    print(reports: IFileReport[], functions: number, notes?: string[], formatting?: boolean, fixed?: number): number;
    start(files: number, codes: number, functions: number): void;
    /** @param notes What failed to load. */
    notes(notes: string[]): void;
    /**
     * Prints nothing for a clean file.
     * @param formatting Also say if it isn't formatted.
     */
    file(report: IFileReport, formatting?: boolean): void;
    /**
     * Counts and time.
     * @param formatting Count unformatted files too.
     * @param fixed Files `--fix` formatted.
     * @returns How many errors there are.
     */
    summary(reports: IFileReport[], formatting?: boolean, fixed?: number): number;
}
//# sourceMappingURL=Reporter.d.ts.map