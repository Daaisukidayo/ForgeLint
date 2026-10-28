"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const harness_1 = require("./support/harness");
const CLI = (0, node_path_1.join)(__dirname, "..", "cli.js");
/** Runs the CLI w/o colors, in the example bot by default */
const forgelint = (args, cwd = harness_1.EXAMPLE) => (0, node_child_process_1.spawnSync)(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
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
`;
(0, node_test_1.describe)("forgelint", () => {
    (0, node_test_1.it)("checks the config's files & exits with 1 on errors", () => {
        const run = forgelint([]);
        strict_1.default.equal(run.status, 1, run.stderr);
        strict_1.default.match(run.stdout, /commands\/typos\.js\n\s+6:16\s+error\s+Unknown function \$sendMesage\. Did you mean \$sendMessage\?\s+unknown-function/);
        strict_1.default.match(run.stdout, /10 errors, 1 warning, 2 info/);
        strict_1.default.match(run.stdout, /Argument "number" of \$double must be a number, not "two"/);
        strict_1.default.doesNotMatch(run.stdout, /ping\.js/);
    });
    (0, node_test_1.it)("takes paths, & exits with 0 w/o errors", () => {
        const run = forgelint(["commands/ping.js", "commands/messy.js"]);
        strict_1.default.equal(run.status, 0, run.stdout + run.stderr);
        strict_1.default.match(run.stdout, /2 info/);
    });
    (0, node_test_1.it)("prints JSON", () => {
        const files = JSON.parse(forgelint(["--json"]).stdout);
        const typos = files.find((file) => file.file === "commands/typos.js");
        strict_1.default.deepEqual(typos.problems[0], {
            rule: "unknown-function",
            severity: "error",
            message: "Unknown function $sendMesage. Did you mean $sendMessage?",
            line: 6,
            column: 16,
        });
    });
    (0, node_test_1.it)("--check fails on unformatted files, --fix formats them", () => {
        const root = (0, harness_1.folder)({});
        (0, node_fs_1.cpSync)(harness_1.EXAMPLE, root, { recursive: true });
        const check = forgelint(["commands/messy.js", "--check"], root);
        strict_1.default.equal(check.status, 1);
        strict_1.default.match(check.stdout, /not formatted/);
        const fix = forgelint(["commands/messy.js", "--fix"], root);
        strict_1.default.equal(fix.status, 0, fix.stdout + fix.stderr);
        strict_1.default.match(fix.stdout, /Formatted 1 file/);
        strict_1.default.equal((0, node_fs_1.readFileSync)((0, node_path_1.join)(root, "commands", "messy.js"), "utf8"), TIDY);
        strict_1.default.equal(forgelint(["commands/messy.js", "--check"], root).status, 0);
    });
    (0, node_test_1.it)("init creates a config, & keeps it after", () => {
        const root = (0, harness_1.folder)({});
        strict_1.default.equal(forgelint(["init"], root).status, 0);
        strict_1.default.ok((0, node_fs_1.existsSync)((0, node_path_1.join)(root, "forgelint.config.js")));
        strict_1.default.match(forgelint(["init"], root).stdout, /kept/);
    });
    (0, node_test_1.it)("refuses unknown options & a missing config", () => {
        strict_1.default.match(forgelint(["--watch"]).stderr, /--watch is not an option/);
        strict_1.default.match(forgelint(["--config", "nope.js"]).stderr, /There is no config file/);
    });
});
//# sourceMappingURL=cli.test.js.map