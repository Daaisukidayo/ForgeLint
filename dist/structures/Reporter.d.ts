import { IFileReport } from "./Project";
/** Prints problems by file, then a summary */
export declare class Reporter {
    private readonly write;
    private readonly started;
    /** @param write default `console.log` */
    constructor(write?: (line: string) => void);
    start(files: number, codes: number, functions: number): void;
    /** @param notes stuff that failed to load */
    notes(notes: string[]): void;
    /**
     * Prints nothing for a clean file
     * @param formatting say if it isn't formatted too
     */
    file(report: IFileReport, formatting?: boolean): void;
    /**
     * Counts & time
     * @param formatting count unformatted files too
     * @param fixed files `--fix` formatted
     */
    summary(reports: IFileReport[], formatting?: boolean, fixed?: number): void;
}
//# sourceMappingURL=Reporter.d.ts.map