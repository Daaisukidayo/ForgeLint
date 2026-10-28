"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const __1 = require("..");
const harness_1 = require("./support/harness");
(0, node_test_1.describe)("unknown functions", () => {
    (0, node_test_1.it)("are errors, with the closest name", () => {
        const [problem] = (0, harness_1.lint)("$sendMesage[$channelID;hi]");
        strict_1.default.equal(problem.rule, __1.Rule.unknownFunction);
        strict_1.default.equal(problem.severity, __1.Severity.error);
        strict_1.default.equal(problem.message, "Unknown function $sendMesage. Did you mean $sendMessage?");
        strict_1.default.deepEqual([problem.start, problem.end], [0, 11]);
    });
    (0, node_test_1.it)("say how ForgeScript reads them, & hint at a missing extension", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$getUserVar[coins]"), [__1.Rule.unknownFunction]);
        strict_1.default.match((0, harness_1.lint)("$getUserVar[coins]")[0].message, /reads it as \$get followed by "UserVar"\. Is the extension that adds it installed\?$/);
    });
    (0, node_test_1.it)("glued to text ForgeScript runs anyway are a warning", () => {
        const [problem] = (0, harness_1.lint)("Took $pingms");
        strict_1.default.equal(problem.rule, __1.Rule.gluedName);
        strict_1.default.equal(problem.severity, __1.Severity.warning);
        strict_1.default.equal(problem.message.split(".")[0], '$pingms reads as $ping followed by "ms"');
    });
    (0, node_test_1.it)("skip escaped $ & prices, & don't guess short names", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)("Costs $5, \\$sendMesage stays text"), []);
        strict_1.default.equal((0, harness_1.lint)("$qz")[0].message, "Unknown function $qz. Is the extension that adds it installed?");
    });
    (0, node_test_1.it)("don't include known ones: natives, aliases & custom functions", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$authorID $!#authorID $@[,]authorID $greet[you]"), []);
    });
});
(0, node_test_1.describe)("argument counts", () => {
    (0, node_test_1.it)("too many: ForgeScript won't compile it", () => {
        const [problem] = (0, harness_1.lint)("$get[a;b]");
        strict_1.default.equal(problem.rule, __1.Rule.tooManyArguments);
        strict_1.default.equal(problem.message, "$get takes at most 1 argument, got 2: $get[key]");
        strict_1.default.equal("$get[a;b]".slice(problem.start, problem.end), ";b");
    });
    (0, node_test_1.it)("too few", () => {
        strict_1.default.equal((0, harness_1.lint)("$addField[Coins]")[0].message, "$addField needs at least 2 arguments, got 1: $addField[name;value;inline?;index?]");
    });
    (0, node_test_1.it)("count custom functions' params", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$greet[a;b]"), [__1.Rule.tooManyArguments]);
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$greet"), [__1.Rule.missingBrackets]);
    });
    (0, node_test_1.it)("let rest args take any number", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$env[a;b;c;d]"), []);
    });
    (0, node_test_1.it)("skip functions whose args are unknown", () => {
        const linter = new __1.Linter(new __1.FunctionRegistry([__1.FunctionRegistry.loose("runtime", "test")]));
        strict_1.default.deepEqual(linter.lint("$runtime[a;b;c] $runtime"), []);
    });
});
(0, node_test_1.describe)("brackets", () => {
    (0, node_test_1.it)("missing", () => {
        strict_1.default.equal((0, harness_1.lint)("$get")[0].message, "$get needs brackets: $get[key]");
    });
    (0, node_test_1.it)("missing on a fn w/ unknown args", () => {
        const linter = new __1.Linter(new __1.FunctionRegistry([__1.FunctionRegistry.loose("isOneOf", "test", true)]));
        strict_1.default.equal(linter.lint("$isOneOf")[0].message, "$isOneOf needs brackets: $isOneOf[...args]");
    });
    (0, node_test_1.it)("after a function that takes none are text", () => {
        const [problem] = (0, harness_1.lint)("$ping[x]");
        strict_1.default.equal(problem.rule, __1.Rule.unexpectedBrackets);
        strict_1.default.equal(problem.severity, __1.Severity.warning);
    });
    (0, node_test_1.it)("unclosed, at the function", () => {
        const [problem] = (0, harness_1.lint)("Hi\n$if[$get[x]==1;yes");
        strict_1.default.equal(problem.rule, __1.Rule.unclosedBracket);
        strict_1.default.deepEqual([problem.line, problem.column], [2, 1]);
    });
    (0, node_test_1.it)("a ] meant for text closes the function", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$description[[Docs](https://x.y)]"), [__1.Rule.unescapedBracket, __1.Rule.strayBracket]);
    });
    (0, node_test_1.it)("an escaped ] closes a text [", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$description[[Docs\\](https://x.y)]"), []);
        strict_1.default.deepEqual((0, harness_1.rulesIn)("[1] and [2]"), []);
    });
    (0, node_test_1.it)("a top-level ] closing nothing is stray", () => {
        const [problem] = (0, harness_1.lint)("Done]");
        strict_1.default.equal(problem.rule, __1.Rule.strayBracket);
        strict_1.default.equal(problem.column, 5);
        // plain code, like $lintCode gets: 1 `\`
        strict_1.default.ok(problem.message.endsWith("escape it: \\]"));
    });
});
(0, node_test_1.describe)("argument values", () => {
    (0, node_test_1.it)("check plain numbers, booleans & enums", () => {
        strict_1.default.equal((0, harness_1.lint)("$round[abc]")[0].message, 'Argument "number" of $round must be a number, not "abc"');
        strict_1.default.equal((0, harness_1.lint)("$addField[a;b;maybe]")[0].message, 'Argument "inline" of $addField must be true or false, not "maybe"');
        strict_1.default.match((0, harness_1.lint)("$addButton[id;label;Big]")[0].message, /^Argument "style" of \$addButton must be one of Primary, /);
        strict_1.default.equal((0, harness_1.lint)("$sendMessage[]")[0].message, 'Argument "channel ID" of $sendMessage is required but empty');
    });
    (0, node_test_1.it)("skip what isn't plain text, empty optional args & functions reading their own", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$round[$get[x]] $addField[a;b;] $if[maybe==1;x]"), []);
    });
});
(0, node_test_1.describe)("style", () => {
    (0, node_test_1.it)("deprecated functions warn", () => {
        // older FS has no deprecated fns, so bring our own
        const old = { ...__1.FunctionRegistry.loose("old", "test"), deprecated: true };
        strict_1.default.deepEqual(new __1.Linter(new __1.FunctionRegistry([old])).lint("$old").map((problem) => problem.rule), [__1.Rule.deprecated]);
    });
    (0, node_test_1.it)("names in another case are info, --fix fixes them", () => {
        const [problem] = (0, harness_1.lint)("$AUTHORID");
        strict_1.default.equal(problem.rule, __1.Rule.functionCase);
        strict_1.default.equal(problem.severity, __1.Severity.info);
        strict_1.default.equal(problem.message, "Write $authorID, not $AUTHORID");
    });
});
(0, node_test_1.describe)("$c[forgelint-...]", () => {
    (0, node_test_1.it)("disable-next-line, for some rules or all", () => {
        const code = "$c[forgelint-disable-next-line unknown-function]\n$fooBar $get\n$bazQux";
        strict_1.default.deepEqual((0, harness_1.rulesIn)(code), [__1.Rule.missingBrackets, __1.Rule.unknownFunction]);
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$c[forgelint-disable-next-line]\n$fooBar $get"), []);
    });
    (0, node_test_1.it)("disable-line", () => {
        strict_1.default.equal((0, harness_1.lint)("$fooBar $c[forgelint-disable-line]\n$bazQux")[0].line, 2);
    });
    (0, node_test_1.it)("disable & enable a stretch", () => {
        const problems = (0, harness_1.lint)("$c[forgelint-disable]$fooBar\n$bazQux$c[forgelint-enable] $quxFoo");
        strict_1.default.deepEqual(problems.map((problem) => problem.message.split(".")[0]), ["Unknown function $quxFoo"]);
    });
});
(0, node_test_1.describe)("rules", () => {
    (0, node_test_1.it)("can be turned off or changed", () => {
        strict_1.default.deepEqual((0, harness_1.rulesIn)("$fooBar", { "unknown-function": "off" }), []);
        strict_1.default.equal((0, harness_1.lint)("$fooBar", { "unknown-function": "warning" })[0].severity, __1.Severity.warning);
    });
    (0, node_test_1.it)("refuse unknown names & settings", () => {
        strict_1.default.throws(() => new __1.Linter(harness_1.registry, { nope: "off" }), /nope is not a rule/);
        strict_1.default.throws(() => new __1.Linter(harness_1.registry, { "unknown-function": "warn" }), /can't be "warn"/);
    });
    (0, node_test_1.it)("give 1-based lines & columns", () => {
        const [problem] = (0, harness_1.lint)("Hi\n  $fooBar");
        strict_1.default.deepEqual([problem.line, problem.column, problem.start], [2, 3, 5]);
    });
});
//# sourceMappingURL=linter.test.js.map