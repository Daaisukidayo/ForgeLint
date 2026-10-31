import { ForgeClient, FunctionManager, NativeFunction } from "@tryforge/forgescript"
import { dirname, join, sep } from "node:path"
import { FunctionRegistry } from "../structures/FunctionRegistry"
import { IForgeLintOptions } from "../types"
import { fromNative } from "./convert"
import { projectRoot, touchesCaller } from "./packages"

/** The last registry and the functions it was built from. */
let cache: { functions: NativeFunction[]; registry: FunctionRegistry } | null = null

/** Where ForgeScript loads its own native functions from. */
const NATIVES = join(dirname(require.resolve("@tryforge/forgescript")), "native") + sep

/** Maps a package folder to whether it runs code with the caller's context. */
const callers = new Map<string, boolean>()

/** @returns Whether a loaded function may run code ForgeLint can't see with the caller's variables. */
function opaque(fn: NativeFunction) {
    // custom fns have no `path`
    if (!fn.path) return true
    if (fn.path.startsWith(NATIVES)) return false

    const dir = projectRoot(dirname(fn.path))
    if (!callers.has(dir)) callers.set(dir, touchesCaller(dir))
    return callers.get(dir)!
}

/** @returns Every function ForgeScript has loaded right now: its own, the extensions' and custom ones. It's rebuilt when they change. */
export function loadedFunctions() {
    const functions = [...(FunctionManager["Functions"] as Map<string, NativeFunction>).values()]

    if (!cache || cache.functions.length !== functions.length || cache.functions.some((fn, i) => fn !== functions[i])) {
        const infos = functions.map((fn) => ({ ...fromNative(fn.data, "loaded"), opaque: opaque(fn) }))
        cache = { functions, registry: new FunctionRegistry(infos) }
    }

    return cache.registry
}

/** @returns The rules of the client's ForgeLint, if it has one. */
export function rulesOf(client: ForgeClient) {
    const extension = client.options.extensions?.find((ext) => ext.name === "ForgeLint")
    return (extension as { options?: IForgeLintOptions } | undefined)?.options?.rules
}
