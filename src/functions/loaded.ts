import { ForgeClient, FunctionManager, NativeFunction } from "@tryforge/forgescript"
import { FunctionRegistry } from "../structures/FunctionRegistry"
import { IForgeLintOptions } from "../types"
import { fromNative } from "./convert"

/** last registry & the fns it's built from */
let cache: { functions: NativeFunction[]; registry: FunctionRegistry } | null = null

/** @returns every fn FS has loaded rn: its own, exts', custom ones. Rebuilt when they change */
export function loadedFunctions() {
    const functions = [...(FunctionManager["Functions"] as Map<string, NativeFunction>).values()]

    if (!cache || cache.functions.length !== functions.length || cache.functions.some((fn, i) => fn !== functions[i])) {
        cache = { functions, registry: new FunctionRegistry(functions.map((fn) => fromNative(fn.data, "loaded"))) }
    }

    return cache.registry
}

/** @returns the rules the client's ForgeLint got, if it has one */
export function rulesOf(client: ForgeClient) {
    const extension = client.options.extensions?.find((ext) => ext.name === "ForgeLint")
    return (extension as { options?: IForgeLintOptions } | undefined)?.options?.rules
}
