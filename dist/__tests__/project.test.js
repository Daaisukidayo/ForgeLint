"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const __1 = require("..");
const harness_1 = require("./support/harness");
/** a fake extension's native: `$fakeHello[who]` */
const NATIVE = `const { NativeFunction } = require("@tryforge/forgescript")
module.exports.default = new NativeFunction({
    name: "$fakeHello",
    version: "1.0.0",
    description: "",
    unwrap: true,
    brackets: true,
    args: [{ name: "who", description: "", rest: false, required: true, type: 1 }],
    execute() { return this.success() },
})`;
(0, node_test_1.describe)("a project", () => {
    (0, node_test_1.it)("finds code files, skipping node_modules, dist, dot-folders, .d.ts, .fs & excluded ones", () => {
        const root = (0, harness_1.folder)({
            "commands/a.js": "",
            "commands/b.ts": "",
            "commands/c.fs": "",
            "commands/d.d.ts": "",
            "commands/e.json": "",
            "dist/x.js": "",
            "node_modules/y/index.js": "",
            ".cache/z.js": "",
            "legacy/old.js": "",
            "src/legacy/old.js": "",
        });
        const files = new __1.Project({ exclude: ["src/legacy"] }, root).files();
        strict_1.default.deepEqual(files.map((file) => (0, node_path_1.relative)(root, file).split(node_path_1.sep).join("/")), ["commands/a.js", "commands/b.ts", "legacy/old.js"]);
    });
    (0, node_test_1.it)("puts problems on the file's lines & columns", () => {
        const root = (0, harness_1.folder)({
            "commands/a.js": "module.exports = {\n    code: `\n        $sendMesage[hi]\n    `,\n}\n",
        });
        const [a] = new __1.Project({}, root).check();
        strict_1.default.deepEqual(a.problems.map((p) => [p.rule, p.line, p.column]), [[__1.Rule.unknownFunction, 3, 9]]);
    });
    (0, node_test_1.it)("knows functions its files define", () => {
        const root = (0, harness_1.folder)({
            "functions/give.ts": "export default new ForgeFunction({ name: 'give', params: ['user', 'amount'], code: `$ping` })",
            "natives/double.ts": "export default new NativeFunction({ name: '$double', unwrap: true, brackets: true, args: [Arg.requiredNumber('number')], execute() {} })",
            "natives/any.ts": "export default new NativeFunction({ name: '$any', brackets: true, args: ARGS, execute() {} })",
            "commands/a.js": "module.exports = { code: `$give[$authorID] $double[two] $double $any[1;2;3] $any` }",
        });
        const report = new __1.Project({}, root).check().find((r) => r.file === "commands/a.js");
        strict_1.default.deepEqual(report.problems.map((p) => p.message.split(":")[0]), [
            "$give needs at least 2 arguments, got 1",
            'Argument "number" of $double must be a number, not "two"',
            "$double needs brackets",
            "$any needs brackets",
        ]);
        strict_1.default.match(report.problems[2].message, /: \$double\[number\]$/);
        strict_1.default.match(report.problems[3].message, /: \$any\[\.\.\.args\]$/);
    });
    (0, node_test_1.it)("loads the extensions it depends on, & the config's functions", () => {
        const root = (0, harness_1.folder)({
            "package.json": JSON.stringify({ dependencies: { "forge.fake": "1.0.0" } }),
            "node_modules/forge.fake/package.json": JSON.stringify({
                name: "forge.fake",
                peerDependencies: { "@tryforge/forgescript": "*" },
            }),
            "node_modules/forge.fake/dist/native/hello.js": NATIVE,
            "functions/greet.js": "module.exports = { name: 'greet', params: ['who'], code: '' }",
            "commands/a.js": "module.exports = { code: `$fakeHello $greet[a;b] $runtime[x]` }",
        });
        const project = new __1.Project({ include: "commands", functions: "functions", known: ["runtime"] }, root);
        const [report] = project.check();
        strict_1.default.deepEqual(report.problems.map((p) => p.message.split(":")[0]), ["$fakeHello needs brackets", "$greet takes at most 1 argument, got 2"]);
        strict_1.default.deepEqual(project.notes, []);
    });
    (0, node_test_1.it)("notes what it couldn't load & goes on", () => {
        const root = (0, harness_1.folder)({ "commands/a.js": "module.exports = { code: `$ping` }" });
        const project = new __1.Project({ extensions: ["forge.nope"], natives: "missing" }, root);
        strict_1.default.deepEqual(project.check()[0].problems, []);
        strict_1.default.equal(project.notes.length, 2);
        strict_1.default.match(project.notes[0], /forge\.nope isn't installed/);
        strict_1.default.match(project.notes[1], /^Couldn't load missing/);
    });
    (0, node_test_1.it)("formats files & writes them", () => {
        const root = (0, harness_1.folder)({
            "a.js": "module.exports = { code: `\n    $AUTHORID   \n    $if[x==1;\n    $ping\n    ]\n` }\n",
        });
        const project = new __1.Project({ indent: 2 }, root);
        strict_1.default.equal(__1.Project.write(project.check()), 1);
        // top-level lines 1 level under the `code:` line
        strict_1.default.equal((0, node_fs_1.readFileSync)((0, node_path_1.join)(root, "a.js"), "utf8"), "module.exports = { code: `\n  $authorID\n  $if[x==1;\n    $ping\n  ]\n` }\n");
        strict_1.default.equal(project.check()[0].formatted, undefined);
    });
    (0, node_test_1.it)("w/ alignToKey off, keeps each code's own indent", () => {
        const root = (0, harness_1.folder)({
            "a.js": "module.exports = { code: `\n      $ping\n      $if[x==1;\n      $ping\n      ]\n` }\n",
        });
        const [report] = new __1.Project({ indent: 2, alignToKey: false }, root).check();
        strict_1.default.equal(report.formatted, "module.exports = { code: `\n      $ping\n      $if[x==1;\n        $ping\n      ]\n` }\n");
        strict_1.default.throws(() => new __1.Project({ alignToKey: "yes" }), /alignToKey must be true or false/);
    });
    (0, node_test_1.it)("refuses a bad config", () => {
        strict_1.default.throws(() => new __1.Project({ indent: 0 }), /indent must be/);
        strict_1.default.throws(() => new __1.Project({ rules: { nope: "off" } }), /nope is not a rule/);
    });
});
//# sourceMappingURL=project.test.js.map