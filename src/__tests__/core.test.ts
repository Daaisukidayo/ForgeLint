import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { describe, it } from "node:test"
import { Formatter, FunctionRegistry, Linter, Rule, checkScript, fromMetadata } from "../core"
import { ROOT } from "./support/harness"

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
]

const registry = new FunctionRegistry(METADATA.map((fn) => fromMetadata(fn, "ForgeScript")))

describe("forge.lint/core", () => {
    it("loads w/o ForgeScript, & dist/... is shut", () => {
        // in the repo, `forge.lint` is this package, through its `exports`
        const run = (code: string) => spawnSync(process.execPath, ["-e", code], { cwd: ROOT, encoding: "utf8" })

        const loaded = run(`require("forge.lint/core")
console.log(String(Object.keys(require.cache).filter((path) => /forgescript|discord\\.js/.test(path)).length))`)
        assert.equal(loaded.stdout.trim(), "0")
        assert.match(run(`require("forge.lint/dist/structures/Linter")`).stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/)
    })

    it("reads metadata like a NativeFunction", () => {
        assert.deepEqual(fromMetadata(METADATA[2], "ForgeScript"), {
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
        })
        // FS turns it off w/o args
        assert.equal(fromMetadata({ name: "$x", unwrap: true }, "test").unwrap, false)
    })

    it("checks a file's text, w/ its lines", () => {
        const text = "module.exports = {\n    code: `$sendMesage[hi] $AUTHORID $arraySort[up]`,\n}\n"
        const { problems, edits } = checkScript(text, new Linter(registry), new Formatter(registry))

        // function-case points at the name after `$`, invalid-argument at the arg
        assert.deepEqual(
            problems.map(({ rule, line, column }) => [rule, line, column]),
            [
                [Rule.unknownFunction, 2, 12],
                [Rule.functionCase, 2, 29],
                [Rule.invalidArgument, 2, 49],
            ]
        )
        assert.match(problems[0].message, /Did you mean \$sendMessage\?/)
        assert.deepEqual(
            edits.map((edit) => [text.slice(edit.start, edit.end), edit.text]),
            [["AUTHORID", "authorID"]]
        )
    })

    it("fixes brackets, & checks events w/ the ones the Linter got", () => {
        const text = 'module.exports = { type: "messageCreat", code: `$sendMessage[1;[x](y)]` }'
        const linter = new Linter(registry, {}, new Set(["messageCreate"]))
        const { problems } = checkScript(text, linter, new Formatter(registry))

        // an escape for a JS string, right before each `]`
        const fix = (at: number) => ({ start: at, end: at, text: "\\\\" })
        assert.deepEqual(
            problems.map((problem) => [problem.rule, problem.fix]),
            [
                [Rule.unknownEvent, undefined],
                [Rule.unescapedBracket, fix(text.indexOf("](y)"))],
                [Rule.strayBracket, fix(text.lastIndexOf("]"))],
            ]
        )
    })

    it("takes other keys", () => {
        const text = "module.exports = { setup: `$nope`, code: `$nope` }"
        const { problems } = checkScript(text, new Linter(registry), new Formatter(registry), { properties: ["setup"] })

        assert.deepEqual(
            problems.map((problem) => problem.start),
            [text.indexOf("$nope")]
        )
    })
})
