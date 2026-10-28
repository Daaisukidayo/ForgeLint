"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_child_process_1 = require("node:child_process");
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const __1 = require("..");
const embedded_1 = require("../functions/embedded");
const script_1 = require("../functions/script");
const harness_1 = require("./support/harness");
/** `\`, spelled out so editors & tools don't mangle the escapes below */
const BS = String.fromCharCode(92);
(0, node_test_1.describe)("fixed bugs", () => {
    (0, node_test_1.it)("a broken \\u{ escape doesn't hang or throw", () => {
        for (const escape of [`${BS}u{12`, `${BS}u{FFFFFFF}`]) {
            const source = `x = { code: \`a${escape}\` }`;
            const [literal] = (0, script_1.scanScript)(source, new Set(["code"])).literals;
            strict_1.default.equal((0, embedded_1.cook)(source, literal).code[0], "a");
        }
    });
    (0, node_test_1.it)("in $c[...] only stuff that breaks compiling counts", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$c[todo: $fooBar, $round[abc], $AUTHORID]"), []);
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$c[$get[a;b]]"), [__1.Rule.tooManyArguments]);
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$c[$getUserVar]"), [__1.Rule.unknownFunction]);
    });
    (0, node_test_1.it)("a ${...} isn't checked as a literal or counted as 1 arg", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)(`$round[${embedded_1.HOLE}] $addField[${embedded_1.HOLE}]`), []);
    });
    (0, node_test_1.it)("cfg lists can be 1 string", () => {
        const root = (0, harness_1.folder)({
            "commands/a.js": "module.exports = { setup: `$runtime[x]`, code: `$nope` }",
        });
        const [report] = new __1.Project({ known: "runtime", properties: "setup", extensions: "forge.nope" }, root).check();
        strict_1.default.deepEqual(report.problems, []);
    });
    (0, node_test_1.it)("only skips dist & co. at the top", () => {
        const root = (0, harness_1.folder)({ "commands/docs/help.js": "", "docs/x.js": "" });
        const files = new __1.Project({}, root).files().map((file) => (0, node_path_1.relative)(root, file).split(node_path_1.sep).join("/"));
        strict_1.default.deepEqual(files, ["commands/docs/help.js"]);
    });
    (0, node_test_1.it)("won't look outside node_modules for a pkg", () => {
        const root = (0, harness_1.folder)({ "commands/a.js": "" });
        const project = new __1.Project({ extensions: ["../../evil"] }, root);
        project.check();
        strict_1.default.match(project.notes[0], /\.\.\/\.\.\/evil isn't installed/);
    });
    (0, node_test_1.it)("--config needs a file", () => {
        const run = (0, node_child_process_1.spawnSync)(process.execPath, [(0, node_path_1.join)(__dirname, "..", "cli.js"), "--config"], {
            cwd: harness_1.EXAMPLE,
            encoding: "utf8",
        });
        strict_1.default.equal(run.status, 1);
        strict_1.default.match(run.stderr, /--config needs a file/);
    });
});
//# sourceMappingURL=regressions.test.js.map