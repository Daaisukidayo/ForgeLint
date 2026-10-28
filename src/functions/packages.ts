import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { FunctionRegistry } from "../structures/FunctionRegistry"
import { ArgTypes, fromCustom, fromNative } from "./convert"

export const FORGESCRIPT = "@tryforge/forgescript"

/** a file that may export a `NativeFunction` */
const NATIVE = /\bNativeFunction\s*\(\s*\{/

/** npm's rules, so a name like `../../x` can't send us outside `node_modules` */
const PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i

interface IPackageJson {
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
 * Looks up `node_modules` dirs like `require` does
 * @returns the pkg's dir, `null` if it's not installed or not a valid name
 */
export function findPackage(name: string, from: string): string | null {
    if (!PACKAGE_NAME.test(name)) return null

    for (let dir = from; ; dir = dirname(dir)) {
        const candidate = join(dir, "node_modules", name)
        if (existsSync(join(candidate, "package.json"))) return candidate
        if (dirname(dir) === dir) return null
    }
}

/** @returns nearest dir w/ a package.json, itself incl., or itself if there's none */
export function projectRoot(from: string) {
    for (let dir = from; ; dir = dirname(dir)) {
        if (existsSync(join(dir, "package.json"))) return dir
        if (dirname(dir) === dir) return from
    }
}

/** @returns the bot's deps that depend on ForgeScript, aka its extensions */
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

/** @returns .js files, subdirs incl., `node_modules` & dot-dirs excl. */
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

/**
 * Adds every `NativeFunction` in a dir, like `ForgeExtension.load` would, w/o starting the ext
 * @param argTypes the `ArgType` of the FS they're built w/
 * @returns why files failed to load
 * @throws if the dir doesn't exist
 */
export function loadNatives(dir: string, source: string, registry: FunctionRegistry, argTypes?: ArgTypes) {
    const failures: string[] = []

    for (const file of scripts(dir)) {
        // reading's way cheaper than running every file of a pkg
        if (!NATIVE.test(readFileSync(file, "utf8"))) continue

        try {
            const exported = require(file)
            const fn = exported?.default ?? exported
            if (typeof fn?.data?.name === "string" && fn.data.name.startsWith("$")) {
                registry.add(fromNative(fn.data, source, argTypes))
            }
        } catch (error) {
            failures.push(failure(error, file))
        }
    }

    return failures
}

/**
 * Adds custom fns like `ForgeClient`'s `functions` does: a .js exports one, an array or `ForgeFunction`s.
 * They replace fns of the same name
 * @returns why files failed to load
 * @throws if the dir doesn't exist
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
