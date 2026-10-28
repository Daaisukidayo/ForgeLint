import assert from "node:assert/strict"
import { relative } from "node:path"
import { after, describe, it } from "node:test"
import { Compiler, ForgeClient, Interpreter } from "@tryforge/forgescript"
import { ForgeLint, Rule } from ".."
import { folder } from "./support/harness"

// discord.js grabs it as the default token, & we never log in for real
delete process.env.DISCORD_TOKEN

const lint = new ForgeLint({ check: false, rules: { "function-case": "off" } })
const client = new ForgeClient({ intents: [], extensions: [lint] })

after(() => client.destroy())

/** Runs code like a cmd would, minus Discord */
const run = (code: string) =>
    Interpreter.run({ client, data: Compiler.compile(code), obj: {} as never, command: null, doNotSend: true })

describe("ForgeLint as an extension", () => {
    it("checks the client's commands & custom functions, w/ its rules", () => {
        client.commands.add({ name: "x", type: "messageCreate", code: "$sendMesage[hi] $AUTHORID" })
        client.functions.add({ name: "greetUser", params: ["name"], code: "Hi $get" })

        assert.deepEqual(
            lint.check(client).map((report) => [report.file, report.problems.map((problem) => problem.rule)]),
            [
                ["messageCreate command x", [Rule.unknownFunction]],
                ["function $greetUser", [Rule.missingBrackets]],
            ]
        )
    })

    it("puts problems on the lines of the command's file", () => {
        const root = folder({
            "ping.js":
                "module.exports = {\n    name: 'ping',\n    type: 'messageCreate',\n    code: `\n        $pnig\n    `,\n}\n",
        })
        // only loaded commands know their file
        client.commands.load(relative(process.cwd(), root))

        const report = lint.check(client).find((candidate) => candidate.file.endsWith("ping.js"))!
        assert.deepEqual(
            report.problems.map((problem) => [problem.line, problem.column]),
            [[5, 9]]
        )
    })

    it("adds $lintCode, $formatCode & $isCodeValid", async () => {
        assert.equal(
            await run("$lintCode[\\$sendMesage;text]"),
            "1:1 error Unknown function $sendMesage. Did you mean $sendMessage? (unknown-function)"
        )
        assert.deepEqual(JSON.parse((await run("$lintCode[\\$get]"))!), [
            {
                rule: "missing-brackets",
                severity: "error",
                message: "$get needs brackets: $get[key]",
                line: 1,
                column: 1,
            },
        ])
        assert.equal(await run("$isCodeValid[\\$ping] $isCodeValid[\\$nope]"), "true false")
        assert.equal(await run("$formatCode[\\$AUTHORID]"), "$authorID")
    })

    it("checks the code right before the bot logs in", async () => {
        const other = new ForgeClient({ intents: [], extensions: [new ForgeLint()] })
        other.commands.add({ name: "y", type: "messageCreate", code: "$fooBar" })
        Object.assign(other, { token: null })

        const lines: string[] = []
        const log = console.log
        console.log = (line: string) => lines.push(line)

        try {
            // fails, there's no token
            await other.login().catch(() => null)
        } finally {
            console.log = log
            await other.destroy()
        }

        assert.ok(lines.some((line) => /Unknown function \$fooBar/.test(line)))
    })
})
