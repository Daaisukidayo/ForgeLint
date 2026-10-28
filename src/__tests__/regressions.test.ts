import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join, relative, sep } from "node:path"
import { describe, it } from "node:test"
import { Project, Rule } from ".."
import { HOLE, cook } from "../functions/embedded"
import { scanScript } from "../functions/script"
import { EXAMPLE, folder, rulesIn } from "./support/harness"

/** `\`, spelled out so editors & tools don't mangle the escapes below */
const BS = String.fromCharCode(92)

describe("fixed bugs", () => {
    it("a broken \\u{ escape doesn't hang or throw", () => {
        for (const escape of [`${BS}u{12`, `${BS}u{FFFFFFF}`]) {
            const source = `x = { code: \`a${escape}\` }`
            const [literal] = scanScript(source, new Set(["code"])).literals
            assert.equal(cook(source, literal).code[0], "a")
        }
    })

    it("in $c[...] only stuff that breaks compiling counts", () => {
        assert.deepEqual(rulesIn("$c[todo: $fooBar, $round[abc], $AUTHORID]"), [])
        assert.deepEqual(rulesIn("$c[$get[a;b]]"), [Rule.tooManyArguments])
        assert.deepEqual(rulesIn("$c[$getUserVar]"), [Rule.unknownFunction])
    })

    it("a ${...} isn't checked as a literal or counted as 1 arg", () => {
        assert.deepEqual(rulesIn(`$round[${HOLE}] $addField[${HOLE}]`), [])
    })

    it("cfg lists can be 1 string", () => {
        const root = folder({
            "commands/a.js": "module.exports = { setup: `$runtime[x]`, code: `$nope` }",
        })
        const [report] = new Project({ known: "runtime", properties: "setup", extensions: "forge.nope" }, root).check()

        assert.deepEqual(report.problems, [])
    })

    it("only skips dist & co. at the top", () => {
        const root = folder({ "commands/docs/help.js": "", "docs/x.js": "" })
        const files = new Project({}, root).files().map((file) => relative(root, file).split(sep).join("/"))

        assert.deepEqual(files, ["commands/docs/help.js"])
    })

    it("won't look outside node_modules for a pkg", () => {
        const root = folder({ "commands/a.js": "" })
        const project = new Project({ extensions: ["../../evil"] }, root)
        project.check()

        assert.match(project.notes[0], /\.\.\/\.\.\/evil isn't installed/)
    })

    it("--config needs a file", () => {
        const run = spawnSync(process.execPath, [join(__dirname, "..", "cli.js"), "--config"], {
            cwd: EXAMPLE,
            encoding: "utf8",
        })

        assert.equal(run.status, 1)
        assert.match(run.stderr, /--config needs a file/)
    })
})
