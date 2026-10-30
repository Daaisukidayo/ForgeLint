#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { isModule } from "./functions/packages"
import { brief } from "./functions/text"
import { IFileReport, Project, Reporter } from "./structures"
import { IForgeLintConfig, Severity } from "./types"

const CONFIG = "forgelint.config.js"

/** Looked for in this order. */
const CONFIGS = [CONFIG, "forgelint.config.cjs", "forgelint.config.mjs"]

const HELP = `Usage: forgelint [paths...] [--fix] [--fix-brackets] [--check] [--json] [--config <file>]
       forgelint init

Checks the ForgeScript in your bot w/o running it: unknown functions,
wrong argument counts, unbalanced brackets & more.
Paths default to the config's include, else the config's folder.

  --fix            Formats the code in place, then checks it
  --fix-brackets   Like --fix, & escapes each ] that closes a function too early or closes nothing
  --check          Also fails if a file isn't formatted
  --json           Prints the problems as JSON
  --config <file>  Config file, default ${CONFIG}, .cjs or .mjs
  init             Creates ${CONFIG}
  --help           Shows this`

const EXAMPLE_CONFIG = `/** @type {import("forge.lint").IForgeLintConfig} */
const config = {
    // files & folders w/ your commands, events & custom functions
    include: ["."],

    // custom function folders, like ForgeClient's \`functions\`. Compiled .js
    // functions: "./functions",

    // functions ForgeLint can't find in your files, e.g. names built in code. Never reported unknown
    // known: ["$swordPrice"],

    // "error", "warning", "info" or "off"
    // rules: { "function-case": "off" },
}

module.exports = config
`

/** Runs `forgelint init`. */
function init() {
    const existing = CONFIGS.find((name) => existsSync(name))
    if (existing) {
        console.log(`  kept    ${existing}, it already exists`)
    } else {
        // ESM has no `module.exports`
        const text = isModule(process.cwd())
            ? EXAMPLE_CONFIG.replace("module.exports =", "export default")
            : EXAMPLE_CONFIG
        writeFileSync(CONFIG, text, "utf8")
        console.log(`  created ${CONFIG}`)
    }

    console.log("\nThen run: npx forgelint")
    return 0
}

/** @returns Files with problems or unformatted ones, as JSON. */
const toJSON = (reports: IFileReport[]) =>
    JSON.stringify(
        reports
            .filter((report) => report.problems.length || report.formatted !== undefined)
            .map(({ file, problems, formatted }) => ({
                file,
                formatted: formatted === undefined,
                problems: problems.map(brief),
            })),
        null,
        2
    )

/**
 * @returns The exit code: 1 on an error, or on an unformatted file with `--check`.
 * @throws On a bad option or a missing config or path.
 */
async function main(args: string[]) {
    if (args.includes("--help") || args.includes("-h")) {
        console.log(HELP)
        return 0
    }

    if (args[0] === "init") return init()

    const paths: string[] = []
    const flags = new Set<string>()
    let option: string | undefined

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]

        if (arg === "--config" || arg.startsWith("--config=")) {
            option = arg === "--config" ? args[++i] : arg.slice("--config=".length)
            if (!option) throw new Error("--config needs a file. See forgelint --help.")
        } else if (["--fix", "--fix-brackets", "--check", "--json"].includes(arg)) flags.add(arg)
        else if (arg.startsWith("--")) throw new Error(`${arg} is not an option. See forgelint --help.`)
        // resolved before the cwd changes
        else paths.push(resolve(arg))
    }

    const path = resolve(option ?? CONFIGS.find((name) => existsSync(name)) ?? CONFIG)
    if (option && !existsSync(path)) throw new Error(`There is no config file at ${path}.`)

    // like the bot started from its own dir, for relative paths in custom fns
    const root = existsSync(path) ? dirname(path) : process.cwd()
    process.chdir(root)

    let config: IForgeLintConfig = {}
    if (existsSync(path)) {
        // `import`, not `require`: ESM loads on every Node 22 too. A CJS cfg comes as `default`
        const imported = await import(pathToFileURL(path).href)
        const loaded = imported.default ?? imported
        config = loaded.default ?? loaded
    }

    // timed from here
    const reporter = new Reporter()
    const project = new Project(config, root)
    const check = flags.has("--check")
    const brackets = flags.has("--fix-brackets")
    let reports = project.check(paths, brackets)
    let fixed = 0

    if (brackets || flags.has("--fix")) {
        fixed = Project.write(reports)
        // positions moved
        if (fixed) reports = project.check(paths)
    }

    const failed =
        reports.some((report) => report.problems.some((problem) => problem.severity === Severity.error)) ||
        (check && reports.some((report) => report.formatted !== undefined))

    if (flags.has("--json")) console.log(toJSON(reports))
    else reporter.print(reports, project.functions.functions.length, project.notes, check, fixed)

    return failed ? 1 : 0
}

function crash(err: unknown) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
}

main(process.argv.slice(2)).then((code) => process.exit(code), crash)
