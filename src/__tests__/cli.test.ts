import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { EXAMPLE, folder } from "./support/harness"

const CLI = join(__dirname, "..", "cli.js")

/** Runs the CLI without colors, in the example bot by default. */
const forgelint = (args: string[], cwd = EXAMPLE) =>
    spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } })

/** `example/commands/messy.js`, formatted. */
const TIDY = `// works, but npx forgelint --fix tidies it
module.exports = {
    name: "dice",
    type: "messageCreate",
    code: \`
        $let[roll;$randomNumber[1;7]]
        $if[$get[roll]==6;
            $title[Six!]
            $color[Gold]
        ;
            $title[You rolled $get[roll]]
        ]
    \`,
}
`

describe("forgelint", () => {
    it("checks the config's files & exits with 1 on errors", () => {
        const run = forgelint([])

        assert.equal(run.status, 1, run.stderr)
        assert.match(
            run.stdout,
            /commands\/typos\.js\n\s+6:16\s+error\s+Unknown function \$sendMesage\. Did you mean \$sendMessage\?\s+unknown-function/
        )
        assert.match(run.stdout, /11 errors, 2 warnings, 2 info/)
        assert.match(run.stdout, /Unknown event guildMemberAd\. Did you mean guildMemberAdd\?/)
        assert.match(run.stdout, /Variable bonus is set but never read/)
        assert.match(run.stdout, /Argument "number" of \$double must be a number, not "two"/)
        assert.doesNotMatch(run.stdout, /ping\.js/)
    })

    it("takes paths, & exits with 0 w/o errors", () => {
        const run = forgelint(["commands/ping.js", "commands/messy.js"])

        assert.equal(run.status, 0, run.stdout + run.stderr)
        assert.match(run.stdout, /2 info/)
    })

    it("prints JSON", () => {
        const files = JSON.parse(forgelint(["--json"]).stdout)
        const typos = files.find((file: { file: string }) => file.file === "commands/typos.js")

        assert.deepEqual(typos.problems[0], {
            rule: "unknown-function",
            severity: "error",
            message: "Unknown function $sendMesage. Did you mean $sendMessage?",
            line: 6,
            column: 16,
        })
    })

    it("--check fails on unformatted files, --fix formats them", () => {
        const root = folder({})
        cpSync(EXAMPLE, root, { recursive: true })

        const check = forgelint(["commands/messy.js", "--check"], root)
        assert.equal(check.status, 1)
        assert.match(check.stdout, /not formatted/)

        const fix = forgelint(["commands/messy.js", "--fix"], root)
        assert.equal(fix.status, 0, fix.stdout + fix.stderr)
        assert.match(fix.stdout, /Formatted 1 file/)
        assert.equal(readFileSync(join(root, "commands", "messy.js"), "utf8"), TIDY)

        assert.equal(forgelint(["commands/messy.js", "--check"], root).status, 0)
    })

    it("--fix-brackets escapes a ] that closes a function too early, --fix leaves it", () => {
        const file = "module.exports = { code: `$description[[Docs](url)]` }"
        const root = folder({ "a.js": file })

        assert.equal(forgelint(["--fix"], root).status, 1)
        assert.equal(readFileSync(join(root, "a.js"), "utf8"), file)

        assert.equal(forgelint(["--fix-brackets"], root).status, 0)
        assert.equal(
            readFileSync(join(root, "a.js"), "utf8"),
            "module.exports = { code: `$description[[Docs\\\\](url)]` }"
        )
    })

    it("init creates a config, & keeps it after", () => {
        const root = folder({})

        assert.equal(forgelint(["init"], root).status, 0)
        assert.ok(existsSync(join(root, "forgelint.config.js")))
        assert.match(forgelint(["init"], root).stdout, /kept/)
    })

    it("init writes export default in an ESM bot, & that config loads", () => {
        const root = folder({
            "package.json": `{ "type": "module" }`,
            "commands/a.js": "export default { code: `$pingms` }",
        })

        assert.equal(forgelint(["init"], root).status, 0)
        const config = readFileSync(join(root, "forgelint.config.js"), "utf8")
        assert.match(config, /^export default config$/m)
        assert.doesNotMatch(config, /module\.exports/)
        assert.equal(forgelint([], root).status, 0)

        // glued-name is a warning by default: failing means the rules got read
        writeFileSync(join(root, "forgelint.config.js"), `export default { rules: { "glued-name": "error" } }`)
        assert.equal(forgelint([], root).status, 1)
    })

    it("finds forgelint.config.cjs", () => {
        const root = folder({
            "forgelint.config.cjs": `module.exports = { rules: { "glued-name": "error" } }`,
            "commands/a.js": "module.exports = { code: `$pingms` }",
        })

        assert.equal(forgelint([], root).status, 1)
        assert.match(forgelint(["init"], root).stdout, /kept {4}forgelint\.config\.cjs/)
    })

    it("refuses unknown options & a missing config", () => {
        assert.match(forgelint(["--watch"]).stderr, /--watch is not an option/)
        assert.match(forgelint(["--config", "nope.js"]).stderr, /There is no config file/)
    })
})
