import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, it } from "node:test"
import { Project, Rule } from ".."
import { folder } from "./support/harness"

/** A fake extension's native function: `$fakeHello[who]`. */
const NATIVE = `const { NativeFunction } = require("@tryforge/forgescript")
module.exports.default = new NativeFunction({
    name: "$fakeHello",
    version: "1.0.0",
    description: "",
    unwrap: true,
    brackets: true,
    args: [{ name: "who", description: "", rest: false, required: true, type: 1 }],
    execute() { return this.success() },
})`

/** A fake extension's event handler, like the ones of ForgeTimers. */
const EVENT = `class FakeEventHandler { constructor(data) { this.data = data } get name() { return this.data.name } register() {} }
module.exports.default = new FakeEventHandler({ name: "fakeEvent" })`

describe("a project", () => {
    it("finds code files, skipping node_modules, dist, dot-folders, .d.ts, .fs & excluded ones", () => {
        const root = folder({
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
        })

        const files = new Project({ exclude: ["src/legacy"] }, root).files()
        assert.deepEqual(
            files.map((file) => relative(root, file).split(sep).join("/")),
            ["commands/a.js", "commands/b.ts", "legacy/old.js"]
        )
    })

    it("puts problems on the file's lines & columns", () => {
        const root = folder({
            "commands/a.js": "module.exports = {\n    code: `\n        $sendMesage[hi]\n    `,\n}\n",
        })

        const [a] = new Project({}, root).check()
        assert.deepEqual(
            a.problems.map((p) => [p.rule, p.line, p.column]),
            [[Rule.unknownFunction, 3, 9]]
        )
    })

    it("tells how to escape a ] in the file: \\\\] in a JS string, \\] in String.raw", () => {
        const root = folder({
            "commands/a.js": "module.exports = [{ code: `$title[[x](y)]` }, { code: String.raw`$title[[x](y)]` }]\n",
        })

        const [a] = new Project({}, root).check()
        assert.deepEqual(
            a.problems.filter((p) => p.rule === Rule.unescapedBracket).map((p) => p.message.split(": ")[1]),
            ["\\\\]", "\\]"]
        )
    })

    it("knows functions its files define", () => {
        const root = folder({
            "functions/give.ts":
                "export default new ForgeFunction({ name: 'give', params: ['user', 'amount'], code: `$ping` })",
            "natives/double.ts":
                "export default new NativeFunction({ name: '$double', unwrap: true, brackets: true, args: [Arg.requiredNumber('number')], execute() {} })",
            "natives/any.ts":
                "export default new NativeFunction({ name: '$any', brackets: true, args: ARGS, execute() {} })",
            "commands/a.js": "module.exports = { code: `$give[$authorID] $double[two] $double $any[1;2;3] $any` }",
        })

        const report = new Project({}, root).check().find((r) => r.file === "commands/a.js")!
        assert.deepEqual(
            report.problems.map((p) => p.message.split(":")[0]),
            [
                "$give needs at least 2 arguments, got 1. Usage",
                'Argument "number" of $double must be a number, not "two"',
                "$double needs brackets",
                "$any needs brackets",
            ]
        )
        assert.match(report.problems[2].message, /: \$double\[number\]$/)
        assert.match(report.problems[3].message, /: \$any\[\.\.\.args\]$/)
    })

    it("loads the extensions it depends on, & the config's functions", () => {
        const root = folder({
            "package.json": JSON.stringify({ dependencies: { "forge.fake": "1.0.0" } }),
            "node_modules/forge.fake/package.json": JSON.stringify({
                name: "forge.fake",
                peerDependencies: { "@tryforge/forgescript": "*" },
            }),
            "node_modules/forge.fake/dist/native/hello.js": NATIVE,
            "functions/greet.js": "module.exports = { name: 'greet', params: ['who'], code: '' }",
            "commands/a.js": "module.exports = { code: `$fakeHello $greet[a;b] $runtime[x]` }",
        })

        const project = new Project({ include: "commands", functions: "functions", known: ["runtime"] }, root)
        const [report] = project.check()

        assert.deepEqual(
            report.problems.map((p) => p.message.split(":")[0]),
            ["$fakeHello needs brackets", "$greet takes at most 1 argument, got 2. Usage"]
        )
        assert.deepEqual(project.notes, [])
    })

    it("warns about an unread variable, unless an extension running code w/ the caller's ctx may read it", () => {
        const rules = (helper: string) => {
            const root = folder({
                "package.json": JSON.stringify({ dependencies: { "forge.fake": "1.0.0" } }),
                "node_modules/forge.fake/package.json": JSON.stringify({
                    name: "forge.fake",
                    peerDependencies: { "@tryforge/forgescript": "*" },
                }),
                "node_modules/forge.fake/dist/native/hello.js": NATIVE,
                // like ForgeClass, whose natives run methods through a helper
                "node_modules/forge.fake/dist/run.js": helper,
                "a.js": "module.exports = { code: `$let[a;1] $fakeHello[x]` }",
            })
            return new Project({ include: "a.js" }, root).check()[0].problems.map((problem) => problem.rule)
        }

        assert.deepEqual(rules("module.exports = (ctx) => ctx"), [Rule.unusedVariable])
        assert.deepEqual(rules("module.exports = (ctx) => ctx.clone()"), [])
    })

    it("checks commands' events, ForgeScript's & its extensions', but not slash commands' type", () => {
        const root = folder({
            "package.json": JSON.stringify({ dependencies: { "forge.fake": "1.0.0" } }),
            "node_modules/forge.fake/package.json": JSON.stringify({
                name: "forge.fake",
                peerDependencies: { "@tryforge/forgescript": "*" },
            }),
            "node_modules/forge.fake/dist/events/fakeEvent.js": EVENT,
            "commands/a.js": [
                "module.exports = [",
                '    { type: "messageCreat", code: "hi" },',
                '    { type: "fakeEvent", code: "hi" },',
                '    { type: "messageCreate", code: "hi" },',
                '    { data: {}, type: "guild", code: "hi" },',
                "]",
            ].join("\n"),
        })

        const [report] = new Project({ include: "commands" }, root).check()
        assert.deepEqual(
            report.problems.map((problem) => [problem.rule, problem.line, problem.column, problem.message]),
            [[Rule.unknownEvent, 2, 14, "Unknown event messageCreat. Did you mean messageCreate?"]]
        )
    })

    it("w/ brackets, escapes 1 ] at a time, as the file writes it", () => {
        const root = folder({
            "a.js": "module.exports = [{ code: `$title[[a](b) [c](d)]` }, { code: String.raw`$title[[x](y)] ]` }]",
        })
        const [report] = new Project({}, root).check(undefined, true)

        // the ] after a closed $title, then the one after c did. The ones they left stray close it now
        assert.equal(
            report.formatted,
            "module.exports = [{ code: `$title[[a\\\\](b) [c\\\\](d)]` }, { code: String.raw`$title[[x\\](y)] \\]` }]"
        )
        assert.deepEqual(report.problems, [])
        assert.equal(new Project({}, root).check()[0].formatted, undefined)
    })

    it("notes what it couldn't load & goes on", () => {
        const root = folder({ "commands/a.js": "module.exports = { code: `$ping` }" })
        const project = new Project({ extensions: ["forge.nope"], natives: "missing" }, root)

        assert.deepEqual(project.check()[0].problems, [])
        assert.equal(project.notes.length, 2)
        assert.match(project.notes[0], /forge\.nope isn't installed/)
        assert.match(project.notes[1], /^Couldn't load missing/)
    })

    it("formats files & writes them", () => {
        const root = folder({
            "a.js": "module.exports = { code: `\n    $AUTHORID   \n    $if[x==1;\n    $ping\n    ]\n` }\n",
        })
        const project = new Project({ indent: 2 }, root)

        assert.equal(Project.write(project.check()), 1)
        // top-level lines 1 level under the `code:` line
        assert.equal(
            readFileSync(join(root, "a.js"), "utf8"),
            "module.exports = { code: `\n  $authorID\n  $if[x==1;\n    $ping\n  ]\n` }\n"
        )
        assert.equal(project.check()[0].formatted, undefined)
    })

    it("w/ alignToKey off, keeps each code's own indent", () => {
        const root = folder({
            "a.js": "module.exports = { code: `\n      $ping\n      $if[x==1;\n      $ping\n      ]\n` }\n",
        })
        const [report] = new Project({ indent: 2, alignToKey: false }, root).check()

        assert.equal(
            report.formatted,
            "module.exports = { code: `\n      $ping\n      $if[x==1;\n        $ping\n      ]\n` }\n"
        )
        assert.throws(() => new Project({ alignToKey: "yes" as never }), /alignToKey must be true or false/)
    })

    it("refuses a bad config", () => {
        assert.throws(() => new Project({ indent: 0 }), /indent must be/)
        assert.throws(() => new Project({ rules: { nope: "off" } as never }), /nope is not a rule/)
    })
})
