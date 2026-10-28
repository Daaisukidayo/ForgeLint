"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Formatter = void 0;
exports.applyEdits = applyEdits;
const text_1 = require("../functions/text");
const types_1 = require("../types");
const Parser_1 = require("./Parser");
/** w/ these, nesting is a guess, so only names get fixed */
const BROKEN = new Set([types_1.Rule.unclosedBracket, types_1.Rule.unescapedBracket, types_1.Rule.strayBracket, types_1.Rule.missingBrackets]);
/** @param edits mustn't overlap */
function applyEdits(text, edits) {
    let out = "";
    let at = 0;
    for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
        out += text.slice(at, edit.start) + edit.text;
        at = edit.end;
    }
    return out + text.slice(at);
}
/**
 * Formats ForgeScript w/o changing what it does: names get their declared case,
 * lines starting w/ a fn, `;` or `]` get indented by nesting. Text lines stay as written
 */
class Formatter {
    registry;
    indent;
    /** @param indent spaces per level or `"tab"`. Default whatever the code uses, else 4 */
    constructor(registry, indent) {
        this.registry = registry;
        this.indent = indent;
    }
    format(code, options = {}) {
        return applyEdits(code, this.edits(code, options));
    }
    /** @returns the edits, in code order */
    edits(code, options = {}) {
        const { calls, findings } = Parser_1.Parser.parse(code, this.registry);
        const edits = [];
        for (const call of (0, Parser_1.flatten)(calls)) {
            const name = call.spelling.slice(1);
            if (code.slice(call.nameStart, call.nameEnd) !== name) {
                edits.push({ start: call.nameStart, end: call.nameEnd, text: name });
            }
        }
        if (!findings.some((finding) => BROKEN.has(finding.rule))) {
            edits.push(...new Layout(code, calls, options, this.indent).edits());
        }
        return edits.sort((a, b) => a.start - b.start);
    }
}
exports.Formatter = Formatter;
class Layout {
    code;
    /** offsets right after a `[`, `;`, `]` or bracketless name */
    after = new Set();
    /** offset of a fn's `$`, a `;` or a `]` → what it is */
    tokens = new Map();
    /** line start → its indentation once formatted */
    indents = new Map();
    isLineBreak;
    starts;
    /** indentation of line 0 */
    first;
    /** 1 level */
    unit;
    /** indentation of top-level lines */
    base;
    /** `alignToKey` */
    align;
    constructor(code, calls, options, indent) {
        this.code = code;
        this.isLineBreak = options.isLineBreak ?? ((index) => code[index] === "\n");
        this.starts = (0, text_1.lineStarts)(code, this.isLineBreak);
        this.first = options.indent ?? "";
        this.align = !!options.alignToKey;
        this.collect(calls, null);
        // nothing nested to learn the step from? the gap between `code:` & the 1st code line is one too
        const step = this.align ? this.keyStep() : undefined;
        this.unit = indent === "tab" ? "\t" : indent ? " ".repeat(indent) : (this.guessUnit() ?? step ?? "    ");
        this.base = this.align ? this.first + this.unit : this.guessBase();
    }
    /** @returns edits for every whitespace run between code on 2 lines */
    edits() {
        const edits = [];
        for (let index = 0; index < this.code.length;) {
            if (!this.blank(index)) {
                index++;
                continue;
            }
            const start = index;
            while (index < this.code.length && this.blank(index))
                index++;
            edits.push(...this.run(start, index));
        }
        return edits;
    }
    collect(calls, parent) {
        for (const call of calls) {
            this.tokens.set(call.start, { kind: "call", call: parent });
            this.after.add(call.end);
            if (call.open !== null)
                this.after.add(call.open + 1);
            if (call.close !== null)
                this.tokens.set(call.close, { kind: "close", call });
            for (const separator of call.separators) {
                this.tokens.set(separator, { kind: "separator", call });
                this.after.add(separator + 1);
            }
            for (const field of call.fields)
                this.collect(field.calls, call);
        }
    }
    /**
     * Kills trailing whitespace, empties blank lines & indents the next line.
     * Skips the run if text touches it, b/c FS prints that whitespace
     * @param end where the next non-whitespace is
     */
    run(start, end) {
        const token = this.tokens.get(end);
        // w/ `alignToKey`, the code's 1st & last lines count too: they touch the quotes, not text
        const opens = this.after.has(start) || (this.align && start === 0);
        const closes = !!token || (this.align && end === this.code.length);
        if (!opens || !closes)
            return [];
        const breaks = [];
        for (let i = start; i < end; i++)
            if (this.isLineBreak(i))
                breaks.push(i);
        if (!breaks.length)
            return [];
        const edits = [];
        const edit = (from, to, text) => {
            if (this.code.slice(from, to) !== text)
                edits.push({ start: from, end: to, text });
        };
        let from = start;
        for (const at of breaks) {
            // keep `\r\n` whole
            edit(from, this.code[at - 1] === "\r" && at - 1 >= from ? at - 1 : at, "");
            from = at + 1;
        }
        // no token = the closing line
        const indent = token ? this.indentFor(token) : this.first;
        edit(from, end, indent);
        this.indents.set(from, indent);
        return edits;
    }
    indentFor(token) {
        if (token.kind !== "call")
            return this.indentOf(token.call.start);
        return token.call ? this.indentOf(token.call.start) + this.unit : this.base;
    }
    /** @returns indentation of the offset's line, once formatted */
    indentOf(offset) {
        const start = this.lineStart(offset);
        return this.indents.get(start) ?? this.written(start);
    }
    /** @returns a line's indentation as written */
    written(start) {
        if (start === 0)
            return this.first;
        let end = start;
        while (this.code[end] === " " || this.code[end] === "\t")
            end++;
        return this.code.slice(start, end);
    }
    lineStart(offset) {
        return this.starts[(0, text_1.locate)(this.starts, offset).line - 1];
    }
    /** @returns space, tab, real line break or its `\r`? */
    blank(index) {
        const char = this.code[index];
        return (char === " " || char === "\t" || this.isLineBreak(index) || (char === "\r" && this.isLineBreak(index + 1)));
    }
    /** @returns how much deeper than the `code:` line the 1st code line sits, `undefined` if it doesn't */
    keyStep() {
        const base = this.guessBase();
        return base.length > this.first.length && base.startsWith(this.first)
            ? base.slice(this.first.length)
            : undefined;
    }
    /** @returns the 1st code line's indentation, line 0's if the code starts there */
    guessBase() {
        for (let index = 0; index < this.code.length; index++) {
            if (!this.blank(index))
                return this.written(this.lineStart(index));
        }
        return this.first;
    }
    /** @returns the step nested fns are indented by most, `undefined` if they never are */
    guessUnit() {
        const counts = new Map();
        for (const [offset, token] of this.tokens) {
            if (token.kind !== "call" || !token.call)
                continue;
            const line = this.lineStart(offset);
            const parent = this.lineStart(token.call.start);
            if (line === parent || this.code.slice(line, offset).trim())
                continue;
            const own = this.written(line);
            const outer = this.written(parent);
            if (own.length <= outer.length || !own.startsWith(outer))
                continue;
            const step = own.slice(outer.length);
            counts.set(step, (counts.get(step) ?? 0) + 1);
        }
        let best;
        let most = 0;
        for (const [step, count] of counts) {
            if (count > most || (count === most && step.length < best.length)) {
                best = step;
                most = count;
            }
        }
        return best;
    }
}
//# sourceMappingURL=Formatter.js.map