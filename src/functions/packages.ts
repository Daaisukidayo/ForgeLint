import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { FunctionRegistry } from "../structures/FunctionRegistry"
import { ArgTypes, fromCustom, fromNative } from "./convert"

export const FORGESCRIPT = "@tryforge/forgescript"

/** A file that may export a `NativeFunction`. */
const NATIVE = /\bNativeFunction\s*\(\s*\{/

/** A file that may export an event handler, for example `new TimerEventHandler({`. */
const EVENT = /EventHandler\s*\(\s*\{/

/**
 * Code that runs code with the caller's context, which can read the caller's variables.
 * Shortcut: it goes by ForgeScript's `ctx` naming, and a package calling it something else slips through. Widen it if one shows up.
 */
export const CALLER = /\bctx\.clone(?:Runtime|Empty)?\(|\.call\(\s*ctx\b|Interpreter\.run\(\s*ctx\b/

/** The rules of npm: a name like `../../x` can't send us outside `node_modules`. */
const PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i

interface IPackageJson {
    type?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
}

function readPackage(dir: string): IPackageJson | null {
    try {
        return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
    } catch {
        return null
    }
}

/**
 * Looks up `node_modules` folders like `require` does.
 * @returns The package's folder, `null` if it's not installed or not a valid name.
 */
export function findPackage(name: string, from: string): string | null {
    if (!PACKAGE_NAME.test(name)) return null

    for (let dir = from; ; dir = dirname(dir)) {
        const candidate = join(dir, "node_modules", name)
        if (existsSync(join(candidate, "package.json"))) return candidate
        if (dirname(dir) === dir) return null
    }
}

/** @returns The nearest folder with a package.json, itself included, or itself if there's none. */
export function projectRoot(from: string) {
    for (let dir = from; ; dir = dirname(dir)) {
        if (existsSync(join(dir, "package.json"))) return dir
        if (dirname(dir) === dir) return from
    }
}

/** @returns Whether Node runs the folder's `.js` files as ESM. */
export const isModule = (dir: string) => readPackage(projectRoot(dir))?.type === "module"

/** @returns The bot's dependencies that depend on ForgeScript, also known as its extensions. */
export function extensionsOf(root: string): string[] {
    const own = readPackage(projectRoot(root))
    if (!own) return []

    const names = Object.keys({ ...own.dependencies, ...own.devDependencies, ...own.optionalDependencies })
    return names.filter((name) => {
        if (name === FORGESCRIPT) return false

        const dir = findPackage(name, root)
        const pkg = dir && readPackage(dir)
        return (
            !!pkg && [pkg.dependencies, pkg.peerDependencies, pkg.devDependencies].some((deps) => deps?.[FORGESCRIPT])
        )
    })
}

/** @returns The `.js` files, subfolders included, `node_modules` and folders starting with a dot excluded. */
function scripts(dir: string): string[] {
    const found: string[] = []

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name !== "node_modules" && !entry.name.startsWith(".")) found.push(...scripts(path))
        } else if (entry.name.endsWith(".js")) found.push(path)
    }

    return found
}

const failure = (error: unknown, file: string) => `${file}: ${error instanceof Error ? error.message : error}`

/** @returns Whether a `.js` file in the folder runs code with the caller's context. */
export const touchesCaller = (dir: string) => scripts(dir).some((file) => CALLER.test(readFileSync(file, "utf8")))

/**
 * Adds every `NativeFunction` in a folder, like `ForgeExtension.load` would, without starting the extension.
 * @param argTypes The `ArgType` of the ForgeScript they're built with.
 * @param opaque Whether they may run code with the caller's variables, see `touchesCaller`.
 * @returns Why files failed to load.
 * @throws If the folder doesn't exist.
 */
export function loadNatives(
    dir: string,
    source: string,
    registry: FunctionRegistry,
    argTypes?: ArgTypes,
    opaque = false
) {
    const failures: string[] = []

    for (const file of scripts(dir)) {
        // reading's way cheaper than running every file of a pkg
        if (!NATIVE.test(readFileSync(file, "utf8"))) continue

        try {
            const exported = require(file)
            const fn = exported?.default ?? exported
            if (typeof fn?.data?.name === "string" && fn.data.name.startsWith("$")) {
                registry.add({ ...fromNative(fn.data, source, argTypes), opaque })
            }
        } catch (error) {
            failures.push(failure(error, file))
        }
    }

    return failures
}

/**
 * Adds the event of every handler in a folder, the way `EventManager.load` reads them, without listening to any.
 * @returns Why files failed to load.
 * @throws If the folder doesn't exist.
 */
export function loadEvents(dir: string, events: Set<string>) {
    const failures: string[] = []

    for (const file of scripts(dir)) {
        if (!EVENT.test(readFileSync(file, "utf8"))) continue

        try {
            const handler = require(file).default
            // no `instanceof`: an ext w/ its own FS copy has another `BaseEventHandler`
            if (typeof handler?.name === "string" && typeof handler.register === "function") events.add(handler.name)
        } catch (error) {
            failures.push(failure(error, file))
        }
    }

    return failures
}

/**
 * Adds custom functions like the `functions` option of `ForgeClient` does: a `.js` file exports one, an array or `ForgeFunction`s.
 * They replace functions of the same name.
 * @returns Why files failed to load.
 * @throws If the folder doesn't exist.
 */
export function loadCustomFunctions(dir: string, source: string, registry: FunctionRegistry, argTypes?: ArgTypes) {
    const failures: string[] = []

    for (const file of scripts(dir)) {
        try {
            const exported = require(file)
            if (!Object.keys(exported).length) continue

            for (const item of [exported.default ?? exported].flat(Infinity)) {
                // a `ForgeFunction` keeps it in `data`
                const data = typeof item?.data?.code === "string" ? item.data : item
                if (typeof data?.name === "string" && typeof data.code === "string") {
                    registry.add(fromCustom(data, source, argTypes), true)
                }
            }
        } catch (error) {
            failures.push(failure(error, file))
        }
    }

    return failures
}
