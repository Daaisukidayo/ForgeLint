"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOLE = void 0;
exports.indentAt = indentAt;
exports.cook = cook;
exports.problemsInFile = problemsInFile;
exports.editsInFile = editsInFile;
const types_1 = require("../types");
const text_1 = require("./text");
/** Rules an escape before the `]` fixes. */
const ESCAPABLE = new Set([types_1.Rule.unescapedBracket, types_1.Rule.strayBracket]);
/** What a `${...}` reads as: no `$`, `[`, `]`, `;` or `\` to trip anything. */
exports.HOLE = String.fromCharCode(0xfffc);
const ESCAPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v" };
/** LS and PS: a `\` before them is a line continuation too. */
const SEPARATORS = String.fromCharCode(0x2028, 0x2029);
/** @returns The character of a hex code point, nothing if it's broken. */
const charOf = (hex) => {
    const point = parseInt(hex, 16);
    return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
};
/** @returns The indentation of the offset's line. */
function indentAt(source, offset) {
    let start = offset;
    while (start > 0 && source[start - 1] !== "\n")
        start--;
    let end = start;
    while (source[end] === " " || source[end] === "\t")
        end++;
    return source.slice(start, end);
}
/** @returns The string JavaScript makes of a literal, with each `${...}` as one `HOLE`. */
function cook(source, literal) {
    let code = "";
    const map = [];
    /** @param at The file offset `text` comes from. */
    const push = (text, at) => {
        for (let i = 0; i < text.length; i++)
            map.push(at);
        code += text;
    };
    const holes = [...literal.holes];
    let i = literal.start;
    while (i < literal.end) {
        if (holes[0]?.[0] === i) {
            push(exports.HOLE, i);
            i = holes.shift()[1];
            continue;
        }
        const char = source[i];
        // JS reads template line breaks as `\n`
        if (char === "\r") {
            push("\n", i);
            i += source[i + 1] === "\n" ? 2 : 1;
            continue;
        }
        if (char !== "\\" || literal.raw) {
            push(char, i);
            i++;
            continue;
        }
        const next = source[i + 1];
        if (next in ESCAPES) {
            push(ESCAPES[next], i);
            i += 2;
        }
        else if (next === "\r") {
            // line continuation = nothing
            i += source[i + 2] === "\n" ? 3 : 2;
        }
        else if (next === "\n" || (next && SEPARATORS.includes(next))) {
            i += 2;
        }
        else if (next === "x") {
            push(charOf(source.slice(i + 2, i + 4)), i);
            i += 4;
        }
        else if (next === "u" && source[i + 2] === "{") {
            // a `}` past the literal = broken escape, don't jump there
            const close = source.indexOf("}", i);
            const end = close === -1 || close >= literal.end ? literal.end : close;
            push(charOf(source.slice(i + 3, end)), i);
            i = end + 1;
        }
        else if (next === "u") {
            push(charOf(source.slice(i + 2, i + 6)), i);
            i += 6;
        }
        else if (next === "0" && !/\d/.test(source[i + 2] ?? "")) {
            push("\0", i);
            i += 2;
        }
        else {
            // `\\`, `` \` ``, `\$`, quotes
            push(next ?? "", i);
            i += 2;
        }
    }
    map.push(literal.end);
    return {
        code,
        map,
        isLineBreak: (index) => code[index] === "\n" && (source[map[index]] === "\n" || source[map[index]] === "\r"),
        indent: indentAt(source, literal.start),
        escapedBracket: literal.raw ? "\\]" : "\\\\]",
        event: literal.event,
    };
}
/** @returns The problems with the file's offsets, lines and columns, and a `fix` for each `]` an escape fixes. */
function problemsInFile(problems, embedded, starts) {
    // as the file writes it, w/o the `]`
    const escape = embedded.escapedBracket.slice(0, -1);
    return problems.map((problem) => {
        const start = embedded.map[problem.start];
        const fix = ESCAPABLE.has(problem.rule) ? { fix: { start, end: start, text: escape } } : {};
        return { ...problem, start, end: embedded.map[problem.end], ...(0, text_1.locate)(starts, start), ...fix };
    });
}
/** @returns The code's edits as file edits. Ones that would touch an escape are dropped. */
function editsInFile(source, embedded, edits) {
    return edits.flatMap((edit) => {
        const start = embedded.map[edit.start];
        const end = embedded.map[edit.end];
        const same = source.slice(start, end) === embedded.code.slice(edit.start, edit.end);
        return same ? [{ start, end, text: edit.text }] : [];
    });
}
//# sourceMappingURL=embedded.js.map