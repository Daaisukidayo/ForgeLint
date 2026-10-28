import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { FunctionRegistry, Linter, Rule, Severity } from ".."
import { lint, registry, rulesIn } from "./support/harness"

describe("unknown functions", () => {
    it("are errors, with the closest name", () => {
        const [problem] = lint("$sendMesage[$channelID;hi]")

        assert.equal(problem.rule, Rule.unknownFunction)
        assert.equal(problem.severity, Severity.error)
        assert.equal(problem.message, "Unknown function $sendMesage. Did you mean $sendMessage?")
        assert.deepEqual([problem.start, problem.end], [0, 11])
    })

    it("say how ForgeScript reads them, & hint at a missing extension", () => {
        assert.deepEqual(rulesIn("$getUserVar[coins]"), [Rule.unknownFunction])
        assert.match(
            lint("$getUserVar[coins]")[0].message,
            /reads it as \$get followed by "UserVar"\. Is the extension that adds it installed\?$/
        )
    })

    it("glued to text ForgeScript runs anyway are a warning", () => {
        const [problem] = lint("Took $pingms")

        assert.equal(problem.rule, Rule.gluedName)
        assert.equal(problem.severity, Severity.warning)
        assert.equal(problem.message.split(".")[0], '$pingms reads as $ping followed by "ms"')
    })

    it("skip escaped $ & prices, & don't guess short names", () => {
        assert.deepEqual(rulesIn("Costs $5, \\$sendMesage stays text"), [])
        assert.equal(lint("$qz")[0].message, "Unknown function $qz. Is the extension that adds it installed?")
    })

    it("don't include known ones: natives, aliases & custom functions", () => {
        assert.deepEqual(rulesIn("$authorID $!#authorID $@[,]authorID $greet[you]"), [])
    })
})

describe("argument counts", () => {
    it("too many: ForgeScript won't compile it", () => {
        const [problem] = lint("$get[a;b]")

        assert.equal(problem.rule, Rule.tooManyArguments)
        assert.equal(problem.message, "$get takes at most 1 argument, got 2: $get[key]")
        assert.equal("$get[a;b]".slice(problem.start, problem.end), ";b")
    })

    it("too few", () => {
        assert.equal(
            lint("$addField[Coins]")[0].message,
            "$addField needs at least 2 arguments, got 1: $addField[name;value;inline?;index?]"
        )
    })

    it("count custom functions' params", () => {
        assert.deepEqual(rulesIn("$greet[a;b]"), [Rule.tooManyArguments])
        assert.deepEqual(rulesIn("$greet"), [Rule.missingBrackets])
    })

    it("let rest args take any number", () => {
        assert.deepEqual(rulesIn("$env[a;b;c;d]"), [])
    })

    it("skip functions whose args are unknown", () => {
        const linter = new Linter(new FunctionRegistry([FunctionRegistry.loose("runtime", "test")]))
        assert.deepEqual(linter.lint("$runtime[a;b;c] $runtime"), [])
    })
})

describe("brackets", () => {
    it("missing", () => {
        assert.equal(lint("$get")[0].message, "$get needs brackets: $get[key]")
    })

    it("missing on a fn w/ unknown args", () => {
        const linter = new Linter(new FunctionRegistry([FunctionRegistry.loose("isOneOf", "test", true)]))
        assert.equal(linter.lint("$isOneOf")[0].message, "$isOneOf needs brackets: $isOneOf[...args]")
    })

    it("after a function that takes none are text", () => {
        const [problem] = lint("$ping[x]")

        assert.equal(problem.rule, Rule.unexpectedBrackets)
        assert.equal(problem.severity, Severity.warning)
    })

    it("unclosed, at the function", () => {
        const [problem] = lint("Hi\n$if[$get[x]==1;yes")

        assert.equal(problem.rule, Rule.unclosedBracket)
        assert.deepEqual([problem.line, problem.column], [2, 1])
    })

    it("a ] meant for text closes the function", () => {
        assert.deepEqual(rulesIn("$description[[Docs](https://x.y)]"), [Rule.unescapedBracket, Rule.strayBracket])
    })

    it("an escaped ] closes a text [", () => {
        assert.deepEqual(rulesIn("$description[[Docs\\](https://x.y)]"), [])
        assert.deepEqual(rulesIn("[1] and [2]"), [])
    })

    it("a top-level ] closing nothing is stray", () => {
        const [problem] = lint("Done]")

        assert.equal(problem.rule, Rule.strayBracket)
        assert.equal(problem.column, 5)
        // plain code, like $lintCode gets: 1 `\`
        assert.ok(problem.message.endsWith("escape it: \\]"))
    })
})

describe("argument values", () => {
    it("check plain numbers, booleans & enums", () => {
        assert.equal(lint("$round[abc]")[0].message, 'Argument "number" of $round must be a number, not "abc"')
        assert.equal(
            lint("$addField[a;b;maybe]")[0].message,
            'Argument "inline" of $addField must be true or false, not "maybe"'
        )
        assert.match(
            lint("$addButton[id;label;Big]")[0].message,
            /^Argument "style" of \$addButton must be one of Primary, /
        )
        assert.equal(lint("$sendMessage[]")[0].message, 'Argument "channel ID" of $sendMessage is required but empty')
    })

    it("skip what isn't plain text, empty optional args & functions reading their own", () => {
        assert.deepEqual(rulesIn("$round[$get[x]] $addField[a;b;] $if[maybe==1;x]"), [])
    })
})

describe("style", () => {
    it("deprecated functions warn", () => {
        // older FS has no deprecated fns, so bring our own
        const old = { ...FunctionRegistry.loose("old", "test"), deprecated: true }
        assert.deepEqual(
            new Linter(new FunctionRegistry([old])).lint("$old").map((problem) => problem.rule),
            [Rule.deprecated]
        )
    })

    it("names in another case are info, --fix fixes them", () => {
        const [problem] = lint("$AUTHORID")

        assert.equal(problem.rule, Rule.functionCase)
        assert.equal(problem.severity, Severity.info)
        assert.equal(problem.message, "Write $authorID, not $AUTHORID")
    })
})

describe("$c[forgelint-...]", () => {
    it("disable-next-line, for some rules or all", () => {
        const code = "$c[forgelint-disable-next-line unknown-function]\n$fooBar $get\n$bazQux"
        assert.deepEqual(rulesIn(code), [Rule.missingBrackets, Rule.unknownFunction])
        assert.deepEqual(rulesIn("$c[forgelint-disable-next-line]\n$fooBar $get"), [])
    })

    it("disable-line", () => {
        assert.equal(lint("$fooBar $c[forgelint-disable-line]\n$bazQux")[0].line, 2)
    })

    it("disable & enable a stretch", () => {
        const problems = lint("$c[forgelint-disable]$fooBar\n$bazQux$c[forgelint-enable] $quxFoo")
        assert.deepEqual(
            problems.map((problem) => problem.message.split(".")[0]),
            ["Unknown function $quxFoo"]
        )
    })
})

describe("rules", () => {
    it("can be turned off or changed", () => {
        assert.deepEqual(rulesIn("$fooBar", { "unknown-function": "off" }), [])
        assert.equal(lint("$fooBar", { "unknown-function": "warning" })[0].severity, Severity.warning)
    })

    it("refuse unknown names & settings", () => {
        assert.throws(() => new Linter(registry, { nope: "off" } as never), /nope is not a rule/)
        assert.throws(() => new Linter(registry, { "unknown-function": "warn" } as never), /can't be "warn"/)
    })

    it("give 1-based lines & columns", () => {
        const [problem] = lint("Hi\n  $fooBar")
        assert.deepEqual([problem.line, problem.column, problem.start], [2, 3, 5])
    })
})
