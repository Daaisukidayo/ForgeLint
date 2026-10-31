"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_child_process_1 = require("node:child_process");
const node_test_1 = require("node:test");
const core_1 = require("../core");
const harness_1 = require("./support/harness");
/** Like ForgeScript's `metadata/functions.json`. */
const METADATA = [
    {
        name: "$sendMessage",
        aliases: ["$channelSendMessage"],
        brackets: true,
        unwrap: true,
        args: [
            { name: "channel ID", type: "Channel", required: true, rest: false },
            { name: "content", type: "String", rest: false },
        ],
    },
    { name: "$authorID", unwrap: false },
    {
        name: "$arraySort",
        brackets: true,
        unwrap: true,
        args: [{ name: "order", type: "Enum", required: true, rest: false, enum: ["asc", "desc"] }],
    },
];
const registry = new core_1.FunctionRegistry(METADATA.map((fn) => (0, core_1.fromMetadata)(fn, "ForgeScript")));
(0, node_test_1.describe)("forge.lint/core", () => {
    (0, node_test_1.it)("loads w/o ForgeScript, & dist/... is shut", () => {
        // in the repo, `forge.lint` is this package, through its `exports`
        const run = (code) => (0, node_child_process_1.spawnSync)(process.execPath, ["-e", code], { cwd: harness_1.ROOT, encoding: "utf8" });
        const loaded = run(`require("forge.lint/core")
console.log(String(Object.keys(require.cache).filter((path) => /forgescript|discord\\.js/.test(path)).length))`);
        strict_1.default.equal(loaded.stdout.trim(), "0");
        strict_1.default.match(run(`require("forge.lint/dist/structures/Linter")`).stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
    });
    (0, node_test_1.it)("reads metadata like a NativeFunction", () => {
        strict_1.default.deepEqual((0, core_1.fromMetadata)(METADATA[2], "ForgeScript"), {
            name: "$arraySort",
            aliases: [],
            brackets: true,
            args: [
                { name: "order", required: true, rest: false, condition: false, type: "Enum", enum: ["asc", "desc"] },
            ],
            unwrap: true,
            deprecated: false,
            description: "",
            source: "ForgeScript",
        });
        // FS turns it off w/o args
        strict_1.default.equal((0, core_1.fromMetadata)({ name: "$x", unwrap: true }, "test").unwrap, false);
    });
    (0, node_test_1.it)("checks a file's text, w/ its lines", () => {
        const text = "module.exports = {\n    code: `$sendMesage[hi] $AUTHORID $arraySort[up]`,\n}\n";
        const { problems, edits } = (0, core_1.checkScript)(text, new core_1.Linter(registry), new core_1.Formatter(registry));
        // function-case points at the name after `$`, invalid-argument at the arg
        strict_1.default.deepEqual(problems.map(({ rule, line, column }) => [rule, line, column]), [
            [core_1.Rule.unknownFunction, 2, 12],
            [core_1.Rule.functionCase, 2, 29],
            [core_1.Rule.invalidArgument, 2, 49],
        ]);
        strict_1.default.match(problems[0].message, /Did you mean \$sendMessage\?/);
        strict_1.default.deepEqual(edits.map((edit) => [text.slice(edit.start, edit.end), edit.text]), [["AUTHORID", "authorID"]]);
    });
    (0, node_test_1.it)("fixes brackets, & checks events w/ the ones the Linter got", () => {
        const text = 'module.exports = { type: "messageCreat", code: `$sendMessage[1;[x](y)]` }';
        const linter = new core_1.Linter(registry, {}, new Set(["messageCreate"]));
        const { problems } = (0, core_1.checkScript)(text, linter, new core_1.Formatter(registry));
        // an escape for a JS string, right before each `]`
        const fix = (at) => ({ start: at, end: at, text: "\\\\" });
        strict_1.default.deepEqual(problems.map((problem) => [problem.rule, problem.fix]), [
            [core_1.Rule.unknownEvent, undefined],
            [core_1.Rule.unescapedBracket, fix(text.indexOf("](y)"))],
            [core_1.Rule.strayBracket, fix(text.lastIndexOf("]"))],
        ]);
    });
    (0, node_test_1.it)("takes other keys", () => {
        const text = "module.exports = { setup: `$nope`, code: `$nope` }";
        const { problems } = (0, core_1.checkScript)(text, new core_1.Linter(registry), new core_1.Formatter(registry), { properties: ["setup"] });
        strict_1.default.deepEqual(problems.map((problem) => problem.start), [text.indexOf("$nope")]);
    });
});
//# sourceMappingURL=core.test.js.map