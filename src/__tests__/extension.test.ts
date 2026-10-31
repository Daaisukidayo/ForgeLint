import assert from "node:assert/strict"
import { relative } from "node:path"
import { after, describe, it } from "node:test"
import { Compiler, ForgeClient, Interpreter, Logger } from "@tryforge/forgescript"
import { ForgeLint, Rule } from ".."
import { folder } from "./support/harness"

// discord.js grabs it as the default token, & we never log in for real
delete process.env.DISCORD_TOKEN

/**
 * A client with the extension. Each new one makes ForgeScript load its native functions again and list them all as overridden,
 * which is muted, like in the harness of ForgeClass. It listens to `messageCreate`, the commands' event, for ForgeScript not to warn.
 */
function clientOf(extension: ForgeLint) {
    const warn = Logger.warn
    Logger.warn = (...args: unknown[]) => {
        if (!args.map(String).join(" ").includes("Attempted to override")) warn.apply(Logger, args)
    }

    try {
        return new ForgeClient({ intents: [], events: ["messageCreate"], extensions: [extension] })
    } finally {
        Logger.warn = warn
    }
}

const lint = new ForgeLint({ check: false, rules: { "function-case": "off" } })
const client = clientOf(lint)

after(() => client.destroy())

/** Runs code like a command would, minus Discord. */
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
        const other = clientOf(new ForgeLint())
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

    it("won't log in w/ stopOnError when the code has errors, warnings don't count", async () => {
        const make = (code: string) => {
            const other = clientOf(new ForgeLint({ stopOnError: true }))
            other.commands.add({ name: "z", type: "messageCreate", code })
            Object.assign(other, { token: null })
            return other
        }
        const broken = make("$fooBar")
        // a glued name is only a warning: this one gets to the real login, which fails w/o a token
        const warned = make("$pingms")

        const log = console.log
        console.log = () => {}

        try {
            await assert.rejects(broken.login(), /ForgeLint found 1 error\. The bot won't log in/)
            await assert.rejects(warned.login(), (error: Error) => !/ForgeLint/.test(error.message))
        } finally {
            console.log = log
            await broken.destroy()
            await warned.destroy()
        }
    })

    it("warns that stopOnError does nothing w/ check off", () => {
        const warn = console.warn
        const warnings: string[] = []
        console.warn = (line: string) => warnings.push(line)

        try {
            new ForgeLint({ check: false, stopOnError: true })
            new ForgeLint({ stopOnError: true })
        } finally {
            console.warn = warn
        }

        assert.deepEqual(warnings, [
            "ForgeLint: stopOnError does nothing while check is false, the bot logs in anyway.",
        ])
    })

    it("checks commands' events against what their manager listens to", async () => {
        const other = clientOf(new ForgeLint({ check: false }))
        // FS warns it isn't listening to it
        const log = console.log
        console.log = () => {}

        try {
            other.commands.add({ name: "w", type: "guildMemberAd" as never, code: "hi" })
        } finally {
            console.log = log
        }

        assert.deepEqual(
            lint.check(other).map((report) => [report.file, report.problems.map((problem) => problem.message)]),
            [["guildMemberAd command w", ["Unknown event guildMemberAd. Did you mean guildMemberAdd?"]]]
        )
        await other.destroy()
    })
})
