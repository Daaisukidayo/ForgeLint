"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bold = exports.grey = exports.cyan = exports.yellow = exports.red = exports.green = void 0;
/**
 * @param codes ANSI SGR codes.
 * @returns A colorizer, which does nothing when `NO_COLOR` is set.
 */
const paint = (codes) => (text) => (process.env.NO_COLOR ? text : `\u001b[${codes}m${text}\u001b[0m`);
exports.green = paint("32");
exports.red = paint("31");
exports.yellow = paint("33");
exports.cyan = paint("36");
exports.grey = paint("90");
exports.bold = paint("1");
//# sourceMappingURL=paint.js.map