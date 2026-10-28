#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const structures_1 = require("./structures");
const types_1 = require("./types");
const CONFIG = "forgelint.config.js";
const HELP = `Usage: forgelint [paths...] [--fix] [--check] [--json] [--config <file>]
       forgelint init

Checks the ForgeScript in your bot w/o running it: unknown functions,
wrong argument counts, unbalanced brackets & more.
Paths default to the config's include, else the config's folder.

  --fix            Formats the code in place, then checks it
  --check          Also fails if a file isn't formatted
  --json           Prints the problems as JSON
  --config <file>  Config file, default ${CONFIG}
  init             Creates ${CONFIG}
  --help           Shows this`;
const EXAMPLE_CONFIG = `/** @type {import("forge.lint").IForgeLintConfig} */
module.exports = {
    // files & folders w/ your commands, events & custom functions
    include: ["."],

    // custom function folders, like ForgeClient's \`functions\`. Compiled .js
    // functions: "./functions",

    // functions your bot makes at runtime, never reported unknown
    // known: ["$myRuntimeFunction"],

    // "error", "warning", "info" or "off"
    // rules: { "function-case": "off" },
}
`;
/** `forgelint init` */
function init() {
    if ((0, node_fs_1.existsSync)(CONFIG)) {
        console.log(`  kept    ${CONFIG}, it already exists`);
    }
    else {
        (0, node_fs_1.writeFileSync)(CONFIG, EXAMPLE_CONFIG, "utf8");
        console.log(`  created ${CONFIG}`);
    }
    console.log("\nThen run: npx forgelint");
    return 0;
}
/** @returns files w/ problems or unformatted, as JSON */
const toJSON = (reports) => JSON.stringify(reports
    .filter((report) => report.problems.length || report.formatted !== undefined)
    .map(({ file, problems, formatted }) => ({
    file,
    formatted: formatted === undefined,
    problems: problems.map(({ rule, severity, message, line, column }) => ({
        rule,
        severity,
        message,
        line,
        column,
    })),
})), null, 2);
/**
 * @returns exit code: 1 on an error, or an unformatted file w/ `--check`
 * @throws on a bad option or a missing config/path
 */
async function main(args) {
    if (args.includes("--help") || args.includes("-h")) {
        console.log(HELP);
        return 0;
    }
    if (args[0] === "init")
        return init();
    const paths = [];
    const flags = new Set();
    let option;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--config" || arg.startsWith("--config=")) {
            option = arg === "--config" ? args[++i] : arg.slice("--config=".length);
            if (!option)
                throw new Error("--config needs a file. See forgelint --help.");
        }
        else if (["--fix", "--check", "--json"].includes(arg))
            flags.add(arg);
        else if (arg.startsWith("--"))
            throw new Error(`${arg} is not an option. See forgelint --help.`);
        // resolved before the cwd changes
        else
            paths.push((0, node_path_1.resolve)(arg));
    }
    const path = (0, node_path_1.resolve)(option ?? CONFIG);
    if (option && !(0, node_fs_1.existsSync)(path))
        throw new Error(`There is no config file at ${path}.`);
    // like the bot started from its own dir, for relative paths in custom fns
    const root = (0, node_fs_1.existsSync)(path) ? (0, node_path_1.dirname)(path) : process.cwd();
    process.chdir(root);
    let config = {};
    if ((0, node_fs_1.existsSync)(path)) {
        const loaded = require(path);
        config = loaded.default ?? loaded;
    }
    // timed from here
    const reporter = new structures_1.Reporter();
    const project = new structures_1.Project(config, root);
    const check = flags.has("--check");
    let reports = project.check(paths);
    let fixed = 0;
    if (flags.has("--fix")) {
        fixed = structures_1.Project.write(reports);
        // positions moved
        if (fixed)
            reports = project.check(paths);
    }
    const failed = reports.some((report) => report.problems.some((problem) => problem.severity === types_1.Severity.error)) ||
        (check && reports.some((report) => report.formatted !== undefined));
    if (flags.has("--json")) {
        console.log(toJSON(reports));
        return failed ? 1 : 0;
    }
    reporter.start(reports.length, reports.reduce((sum, report) => sum + report.codes, 0), project.functions.functions.length);
    reporter.notes(project.notes);
    for (const report of reports)
        reporter.file(report, check);
    reporter.summary(reports, check, fixed);
    return failed ? 1 : 0;
}
function crash(err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
}
main(process.argv.slice(2)).then((code) => process.exit(code), crash);
//# sourceMappingURL=cli.js.map