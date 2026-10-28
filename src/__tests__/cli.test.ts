import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cpSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { EXAMPLE, folder } from "./support/harness"

const CLI = join(__dirname, "..", "cli.js")

/** Runs the CLI w/o colors, in the example bot by default */
const forgelint = (args: string[], cwd = EXAMPLE) =>
    spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } })

/** example/commands/messy.js, formatted */
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
        assert.match(run.stdout, /10 errors, 1 warning, 2 info/)
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

    it("init creates a config, & keeps it after", () => {
        const root = folder({})

        assert.equal(forgelint(["init"], root).status, 0)
        assert.ok(existsSync(join(root, "forgelint.config.js")))
        assert.match(forgelint(["init"], root).stdout, /kept/)
    })

    it("refuses unknown options & a missing config", () => {
        assert.match(forgelint(["--watch"]).stderr, /--watch is not an option/)
        assert.match(forgelint(["--config", "nope.js"]).stderr, /There is no config file/)
    })
})
