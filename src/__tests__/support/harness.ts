import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { after } from "node:test"
import { Formatter, FunctionRegistry, Linter, Project, RuleSettings, fromCustom } from "../.."

/** the repo, tests use its FS */
export const ROOT = join(__dirname, "..", "..", "..")

export const EXAMPLE = join(ROOT, "example")

/** FS's fns + a custom `$greet[name]` */
export const registry = new FunctionRegistry(new Project({}, ROOT).functions.functions)
registry.add(fromCustom({ name: "greet", params: ["name"], code: "" }, "test"))

export const lint = (code: string, rules?: RuleSettings) => new Linter(registry, rules).lint(code)

/** @returns broken rules, in code order */
export const rulesIn = (code: string, rules?: RuleSettings) => lint(code, rules).map((problem) => problem.rule)

export const format = (code: string, indent?: number | "tab") => new Formatter(registry, indent).format(code)

/** temp dirs, nuked after the file */
const made: string[] = []

after(() => {
    for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

/**
 * @param files path → content
 * @returns a temp dir w/ them, inside the repo so its FS gets found
 */
export function folder(files: Record<string, string>) {
    const parent = join(ROOT, ".test-tmp")
    mkdirSync(parent, { recursive: true })

    const root = mkdtempSync(join(parent, "project-"))
    made.push(root)

    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true })
        writeFileSync(join(root, path), content)
    }

    return root
}
