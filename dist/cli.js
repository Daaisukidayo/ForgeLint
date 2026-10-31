#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const packages_1 = require("./functions/packages");
const text_1 = require("./functions/text");
const structures_1 = require("./structures");
const types_1 = require("./types");
const CONFIG = "forgelint.config.js";
/** Looked for in this order. */
const CONFIGS = [CONFIG, "forgelint.config.cjs", "forgelint.config.mjs"];
const HELP = `Usage: forgelint [paths...] [--fix] [--fix-brackets] [--check] [--json] [--config <file>]
       forgelint init

Checks the ForgeScript in your bot without running it: unknown functions,
wrong argument counts, unbalanced brackets and more.
Paths default to the config's include, else the config's folder.

  --fix            Formats the code in place, then checks it
  --fix-brackets   Like --fix, and escapes each ] that closes a function too early or closes nothing
  --check          Also fails if a file isn't formatted
  --json           Prints the problems as JSON
  --config <file>  Config file, default ${CONFIG}, .cjs or .mjs here or in a folder above
  init             Creates ${CONFIG}
  --help           Shows this`;
const EXAMPLE_CONFIG = `/** @type {import("forge.lint").IForgeLintConfig} */
const config = {
    // files and folders with your commands, events and custom functions
    include: ["."],

    // folders with custom functions, like the \`functions\` option of ForgeClient. They must be compiled .js
    // functions: "./functions",

    // functions ForgeLint can't find in your files, for example ones whose names are built in code.
    // They are never reported as unknown
    // known: ["$swordPrice"],

    // "error", "warning", "info" or "off" for each rule
    // rules: { "function-case": "off" },
}

`;
/** @returns The first config from `from` up to its project's root, the folder with its package.json. */
function findConfig(from) {
    const top = (0, packages_1.projectRoot)(from);
    for (let dir = from;; dir = (0, node_path_1.dirname)(dir)) {
        const found = CONFIGS.map((name) => (0, node_path_1.join)(dir, name)).find((path) => (0, node_fs_1.existsSync)(path));
        if (found || dir === top || (0, node_path_1.dirname)(dir) === dir)
            return found;
    }
}
/**
 * Runs `forgelint init`.
 * @param option The `--config` path. Defaults to `forgelint.config.js` in the current folder.
 */
function init(option) {
    const path = (0, node_path_1.resolve)(option ?? CONFIG);
    const existing = option ? ((0, node_fs_1.existsSync)(path) ? path : undefined) : findConfig(process.cwd());
    if (existing) {
        console.log(`  kept    ${(0, node_path_1.relative)(process.cwd(), existing)}, it already exists`);
    }
    else {
        // ESM has no `module.exports`. A .mjs is always ESM, a .cjs never
        const esm = path.endsWith(".mjs") || (!path.endsWith(".cjs") && (0, packages_1.isModule)((0, node_path_1.dirname)(path)));
        (0, node_fs_1.writeFileSync)(path, EXAMPLE_CONFIG + (esm ? "export default config\n" : "module.exports = config\n"), "utf8");
        console.log(`  created ${(0, node_path_1.relative)(process.cwd(), path)}`);
    }
    console.log("\nThen run: npx forgelint");
    return 0;
}
/** @returns Files with problems or unformatted ones, as JSON. */
const toJSON = (reports) => JSON.stringify(reports
    .filter((report) => report.problems.length || report.formatted !== undefined)
    .map(({ file, problems, formatted }) => ({
    file,
    formatted: formatted === undefined,
    problems: problems.map(text_1.brief),
})), null, 2);
/**
 * @returns The exit code: 1 on an error, or on an unformatted file with `--check`.
 * @throws On a bad option or a missing config or path.
 */
async function main(args) {
    if (args.includes("--help") || args.includes("-h")) {
        console.log(HELP);
        return 0;
    }
    const positional = [];
    const flags = new Set();
    let option;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--config" || arg.startsWith("--config=")) {
            option = arg === "--config" ? args[++i] : arg.slice("--config=".length);
            if (!option || option.startsWith("--"))
                throw new Error("--config needs a file. See forgelint --help.");
        }
        else if (["--fix", "--fix-brackets", "--check", "--json"].includes(arg))
            flags.add(arg);
        else if (arg.startsWith("--"))
            throw new Error(`${arg} is not an option. See forgelint --help.`);
        else
            positional.push(arg);
    }
    if (positional[0] === "init")
        return init(option);
    // resolved before the cwd changes
    const paths = positional.map((path) => (0, node_path_1.resolve)(path));
    const path = option ? (0, node_path_1.resolve)(option) : findConfig(process.cwd());
    if (path && !(0, node_fs_1.existsSync)(path))
        throw new Error(`There is no config file at ${path}.`);
    // like the bot started from its own dir, for relative paths in custom fns
    const root = path ? (0, node_path_1.dirname)(path) : process.cwd();
    process.chdir(root);
    let config = {};
    if (path) {
        // `import` instead of `require`. ESM loads on every Node 22 too. A CJS cfg comes as `default`
        const imported = await import((0, node_url_1.pathToFileURL)(path).href);
        const loaded = imported.default ?? imported;
        config = loaded.default ?? loaded;
    }
    // timed from here
    const reporter = new structures_1.Reporter();
    const project = new structures_1.Project(config, root);
    const check = flags.has("--check");
    const brackets = flags.has("--fix-brackets");
    let reports = project.check(paths, brackets);
    let fixed = 0;
    if (brackets || flags.has("--fix")) {
        fixed = structures_1.Project.write(reports);
        // positions moved
        if (fixed)
            reports = project.check(paths);
    }
    const failed = reports.some((report) => report.problems.some((problem) => problem.severity === types_1.Severity.error)) ||
        (check && reports.some((report) => report.formatted !== undefined));
    if (flags.has("--json")) {
        // stdout stays plain JSON
        for (const note of project.notes)
            console.error(note);
        console.log(toJSON(reports));
    }
    else
        reporter.print(reports, project.functions.functions.length, project.notes, check, fixed);
    return failed ? 1 : 0;
}
/** Exits once stdout and stderr are flushed. A loaded file can keep the process alive, and exiting right away can cut off piped output. */
function exit(code) {
    process.stdout.write("", () => process.stderr.write("", () => process.exit(code)));
}
function crash(err) {
    console.error(err instanceof Error ? err.message : err);
    exit(1);
}
main(process.argv.slice(2)).then(exit, crash);
//# sourceMappingURL=cli.js.map