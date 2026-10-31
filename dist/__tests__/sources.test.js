"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const embedded_1 = require("../functions/embedded");
const script_1 = require("../functions/script");
const CODE = new Set(["code"]);
const codesOf = (source, keys = CODE) => (0, script_1.scanScript)(source, keys).literals.map((literal) => (0, embedded_1.cook)(source, literal).code);
(0, node_test_1.describe)("JS & TS files", () => {
    (0, node_test_1.it)("give the strings of code keys, as JS reads them", () => {
        const source = [
            "module.exports = [",
            "    { name: 'a', code: `$ping` },",
            '    { name: "b", \'code\': "$authorID" },',
            "    { code: 'it\\'s' },",
            "]",
        ].join("\n");
        strict_1.default.deepEqual(codesOf(source), ["$ping", "$authorID", "it's"]);
    });
    (0, node_test_1.it)("resolve escapes: \\\\] reaches ForgeScript as \\]", () => {
        strict_1.default.deepEqual(codesOf("x = { code: `$get[a\\\\]] \\` \\${x} \\n` }"), ["$get[a\\]] ` ${x} \n"]);
    });
    (0, node_test_1.it)("keep String.raw as written", () => {
        strict_1.default.deepEqual(codesOf("x = { code: String.raw`$get[a\\]]` }"), ["$get[a\\]]"]);
    });
    (0, node_test_1.it)("read a ${...} as one placeholder", () => {
        strict_1.default.deepEqual(codesOf("x = { code: `Hi ${user.name}! $ping` }"), [`Hi ${embedded_1.HOLE}! $ping`]);
    });
    (0, node_test_1.it)("skip comments, types, regexes & keys outside objects", () => {
        const source = [
            "// { code: `$commented` }",
            "/* { code: `$blocked` } */",
            "interface Cmd { code: string }",
            "const re = /`{ code: `/g",
            "const pick = ok ? code : `$ternary`",
            "export default { code: `$real` }",
        ].join("\n");
        strict_1.default.deepEqual(codesOf(source), ["$real"]);
    });
    (0, node_test_1.it)("take other keys from the config", () => {
        strict_1.default.deepEqual(codesOf("x = { setup: `$ping`, code: `$authorID` }", new Set(["setup"])), ["$ping"]);
    });
    (0, node_test_1.it)("map each char back to the file, CRLF incl.", () => {
        const source = "x = { code: `a\\n\r\n  $ping` }";
        const embedded = (0, embedded_1.cook)(source, (0, script_1.scanScript)(source, CODE).literals[0]);
        strict_1.default.equal(embedded.code, "a\n\n  $ping");
        strict_1.default.equal(source[embedded.map[embedded.code.indexOf("$")]], "$");
        // the escaped \n isn't a real line break
        strict_1.default.equal(embedded.isLineBreak(1), false);
        strict_1.default.equal(embedded.isLineBreak(2), true);
    });
});
(0, node_test_1.describe)("functions a file defines", () => {
    (0, node_test_1.it)("custom ones, w/ their params", () => {
        const source = `
            export default new ForgeFunction({
                name: "give",
                params: ["user", { name: "amount", type: ArgType.Number, required: false }],
                code: \`$ping\`,
            })
            module.exports = { name: "plain", params: [], brackets: false, code: "" }
            module.exports = { name: "ping", type: "messageCreate", code: "" }
        `;
        strict_1.default.deepEqual((0, script_1.scanScript)(source, CODE).definitions, [
            {
                name: "give",
                kind: "custom",
                brackets: undefined,
                params: ["user", { name: "amount", type: "Number", required: false }],
                firstParamCondition: false,
            },
            { name: "plain", kind: "custom", brackets: false, params: [], firstParamCondition: false },
        ]);
    });
    (0, node_test_1.it)("natives w/ their args, as objects or `Arg.*` calls", () => {
        const source = `export default new NativeFunction({
            name: "$isOneOf",
            aliases: ["$oneOf"],
            unwrap: true,
            brackets: true,
            deprecated: true,
            args: [
                { name: "string", description: "x", type: ArgType.String, required: true, rest: false, check: (v) => !!v },
                Arg.restString("matches", "y", true),
                forgescript_1.Arg.optionalEnum(Style, "style"),
            ],
            execute() {},
        })`;
        strict_1.default.deepEqual((0, script_1.scanScript)(source, CODE).definitions, [
            {
                name: "$isOneOf",
                kind: "native",
                brackets: true,
                params: null,
                firstParamCondition: false,
                args: [
                    { name: "string", type: "String", required: true, rest: false, condition: false },
                    { method: "restString", values: ["matches", "y", true] },
                    { method: "optionalEnum", values: [undefined, "style"] },
                ],
                unwrap: true,
                aliases: ["$oneOf"],
                deprecated: true,
            },
        ]);
    });
    (0, node_test_1.it)("native args it can't read as null", () => {
        for (const args of ["ARGS", "[...ARGS]", "[makeArg()]", "[{ name }]"]) {
            const source = `new NativeFunction({ name: "$x", brackets: true, args: ${args} })`;
            strict_1.default.equal((0, script_1.scanScript)(source, CODE).definitions[0].args, null, args);
        }
    });
    (0, node_test_1.it)("params it can't read as null", () => {
        const source = "new ForgeFunction({ name: 'x', params: PARAMS, code: '' })";
        strict_1.default.equal((0, script_1.scanScript)(source, CODE).definitions[0].params, null);
    });
});
//# sourceMappingURL=sources.test.js.map