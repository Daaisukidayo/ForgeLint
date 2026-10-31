"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkText = checkText;
exports.checkScript = checkScript;
const Formatter_1 = require("../structures/Formatter");
const embedded_1 = require("./embedded");
const script_1 = require("./script");
const text_1 = require("./text");
/** Lints and formats a file's codes. Offsets, lines and columns are the file's. */
function checkText(text, codes, linter, formatter, alignToKey = true) {
    const starts = (0, text_1.lineStarts)(text);
    const problems = [];
    const edits = [];
    for (const embedded of codes) {
        problems.push(...(0, embedded_1.problemsInFile)(linter.lint(embedded.code, embedded.escapedBracket), embedded, starts));
        edits.push(...(0, embedded_1.editsInFile)(text, embedded, formatter.edits(embedded.code, { ...embedded, alignToKey })));
        const { event } = embedded;
        const found = event && linter.lintEvent(event.name);
        if (event && found)
            problems.push({ ...found, start: event.start, end: event.end, ...(0, text_1.locate)(starts, event.start) });
    }
    const formatted = (0, Formatter_1.applyEdits)(text, edits);
    return {
        problems: problems.sort((a, b) => a.start - b.start || a.end - b.end),
        edits,
        /** The file with its codes formatted, if that changes something. */
        formatted: formatted === text ? undefined : formatted,
    };
}
/** Lints and formats the ForgeScript in a JavaScript or TypeScript file's text, saved or not, for example in an editor. */
function checkScript(text, linter, formatter, options = {}) {
    const { literals } = (0, script_1.scanScript)(text, new Set(options.properties ?? ["code"]));
    const codes = literals.map((literal) => (0, embedded_1.cook)(text, literal));
    return checkText(text, codes, linter, formatter, options.alignToKey);
}
//# sourceMappingURL=check.js.map