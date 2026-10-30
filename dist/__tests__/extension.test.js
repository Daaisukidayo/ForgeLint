"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const forgescript_1 = require("@tryforge/forgescript");
const __1 = require("..");
const harness_1 = require("./support/harness");
// discord.js grabs it as the default token, & we never log in for real
delete process.env.DISCORD_TOKEN;
/**
 * A client with the extension. Each new one makes ForgeScript load its native functions again and list them all as overridden,
 * which is muted, like in the harness of ForgeClass. It listens to `messageCreate`, the commands' event, for ForgeScript not to warn.
 */
function clientOf(extension) {
    const warn = forgescript_1.Logger.warn;
    forgescript_1.Logger.warn = (...args) => {
        if (!args.map(String).join(" ").includes("Attempted to override"))
            warn.apply(forgescript_1.Logger, args);
    };
    try {
        return new forgescript_1.ForgeClient({ intents: [], events: ["messageCreate"], extensions: [extension] });
    }
    finally {
        forgescript_1.Logger.warn = warn;
    }
}
const lint = new __1.ForgeLint({ check: false, rules: { "function-case": "off" } });
const client = clientOf(lint);
(0, node_test_1.after)(() => client.destroy());
/** Runs code like a command would, minus Discord. */
const run = (code) => forgescript_1.Interpreter.run({ client, data: forgescript_1.Compiler.compile(code), obj: {}, command: null, doNotSend: true });
(0, node_test_1.describe)("ForgeLint as an extension", () => {
    (0, node_test_1.it)("checks the client's commands & custom functions, w/ its rules", () => {
        client.commands.add({ name: "x", type: "messageCreate", code: "$sendMesage[hi] $AUTHORID" });
        client.functions.add({ name: "greetUser", params: ["name"], code: "Hi $get" });
        strict_1.default.deepEqual(lint.check(client).map((report) => [report.file, report.problems.map((problem) => problem.rule)]), [
            ["messageCreate command x", [__1.Rule.unknownFunction]],
            ["function $greetUser", [__1.Rule.missingBrackets]],
        ]);
    });
    (0, node_test_1.it)("puts problems on the lines of the command's file", () => {
        const root = (0, harness_1.folder)({
            "ping.js": "module.exports = {\n    name: 'ping',\n    type: 'messageCreate',\n    code: `\n        $pnig\n    `,\n}\n",
        });
        // only loaded commands know their file
        client.commands.load((0, node_path_1.relative)(process.cwd(), root));
        const report = lint.check(client).find((candidate) => candidate.file.endsWith("ping.js"));
        strict_1.default.deepEqual(report.problems.map((problem) => [problem.line, problem.column]), [[5, 9]]);
    });
    (0, node_test_1.it)("adds $lintCode, $formatCode & $isCodeValid", async () => {
        strict_1.default.equal(await run("$lintCode[\\$sendMesage;text]"), "1:1 error Unknown function $sendMesage. Did you mean $sendMessage? (unknown-function)");
        strict_1.default.deepEqual(JSON.parse((await run("$lintCode[\\$get]"))), [
            {
                rule: "missing-brackets",
                severity: "error",
                message: "$get needs brackets: $get[key]",
                line: 1,
                column: 1,
            },
        ]);
        strict_1.default.equal(await run("$isCodeValid[\\$ping] $isCodeValid[\\$nope]"), "true false");
        strict_1.default.equal(await run("$formatCode[\\$AUTHORID]"), "$authorID");
    });
    (0, node_test_1.it)("checks the code right before the bot logs in", async () => {
        const other = clientOf(new __1.ForgeLint());
        other.commands.add({ name: "y", type: "messageCreate", code: "$fooBar" });
        Object.assign(other, { token: null });
        const lines = [];
        const log = console.log;
        console.log = (line) => lines.push(line);
        try {
            // fails, there's no token
            await other.login().catch(() => null);
        }
        finally {
            console.log = log;
            await other.destroy();
        }
        strict_1.default.ok(lines.some((line) => /Unknown function \$fooBar/.test(line)));
    });
    (0, node_test_1.it)("won't log in w/ stopOnError when the code has errors, warnings don't count", async () => {
        const make = (code) => {
            const other = clientOf(new __1.ForgeLint({ stopOnError: true }));
            other.commands.add({ name: "z", type: "messageCreate", code });
            Object.assign(other, { token: null });
            return other;
        };
        const broken = make("$fooBar");
        // a glued name is only a warning: this one gets to the real login, which fails w/o a token
        const warned = make("$pingms");
        const log = console.log;
        console.log = () => { };
        try {
            await strict_1.default.rejects(broken.login(), /ForgeLint found 1 error\. The bot won't log in/);
            await strict_1.default.rejects(warned.login(), (error) => !/ForgeLint/.test(error.message));
        }
        finally {
            console.log = log;
            await broken.destroy();
            await warned.destroy();
        }
    });
    (0, node_test_1.it)("warns that stopOnError does nothing w/ check off", () => {
        const warn = console.warn;
        const warnings = [];
        console.warn = (line) => warnings.push(line);
        try {
            new __1.ForgeLint({ check: false, stopOnError: true });
            new __1.ForgeLint({ stopOnError: true });
        }
        finally {
            console.warn = warn;
        }
        strict_1.default.deepEqual(warnings, [
            "ForgeLint: stopOnError does nothing while check is false, the bot logs in anyway.",
        ]);
    });
    (0, node_test_1.it)("checks commands' events against what their manager listens to", async () => {
        const other = clientOf(new __1.ForgeLint({ check: false }));
        // FS warns it isn't listening to it
        const log = console.log;
        console.log = () => { };
        try {
            other.commands.add({ name: "w", type: "guildMemberAd", code: "hi" });
        }
        finally {
            console.log = log;
        }
        strict_1.default.deepEqual(lint.check(other).map((report) => [report.file, report.problems.map((problem) => problem.message)]), [["guildMemberAd command w", ["Unknown event guildMemberAd. Did you mean guildMemberAdd?"]]]);
        await other.destroy();
    });
});
//# sourceMappingURL=extension.test.js.map