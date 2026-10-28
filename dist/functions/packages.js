"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORGESCRIPT = void 0;
exports.findPackage = findPackage;
exports.projectRoot = projectRoot;
exports.extensionsOf = extensionsOf;
exports.loadNatives = loadNatives;
exports.loadCustomFunctions = loadCustomFunctions;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const convert_1 = require("./convert");
exports.FORGESCRIPT = "@tryforge/forgescript";
/** a file that may export a `NativeFunction` */
const NATIVE = /\bNativeFunction\s*\(\s*\{/;
/** npm's rules, so a name like `../../x` can't send us outside `node_modules` */
const PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;
function readPackage(dir) {
    try {
        return JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(dir, "package.json"), "utf8"));
    }
    catch {
        return null;
    }
}
/**
 * Looks up `node_modules` dirs like `require` does
 * @returns the pkg's dir, `null` if it's not installed or not a valid name
 */
function findPackage(name, from) {
    if (!PACKAGE_NAME.test(name))
        return null;
    for (let dir = from;; dir = (0, node_path_1.dirname)(dir)) {
        const candidate = (0, node_path_1.join)(dir, "node_modules", name);
        if ((0, node_fs_1.existsSync)((0, node_path_1.join)(candidate, "package.json")))
            return candidate;
        if ((0, node_path_1.dirname)(dir) === dir)
            return null;
    }
}
/** @returns nearest dir w/ a package.json, itself incl., or itself if there's none */
function projectRoot(from) {
    for (let dir = from;; dir = (0, node_path_1.dirname)(dir)) {
        if ((0, node_fs_1.existsSync)((0, node_path_1.join)(dir, "package.json")))
            return dir;
        if ((0, node_path_1.dirname)(dir) === dir)
            return from;
    }
}
/** @returns the bot's deps that depend on ForgeScript, aka its extensions */
function extensionsOf(root) {
    const own = readPackage(projectRoot(root));
    if (!own)
        return [];
    const names = Object.keys({ ...own.dependencies, ...own.devDependencies, ...own.optionalDependencies });
    return names.filter((name) => {
        if (name === exports.FORGESCRIPT)
            return false;
        const dir = findPackage(name, root);
        const pkg = dir && readPackage(dir);
        return (!!pkg && [pkg.dependencies, pkg.peerDependencies, pkg.devDependencies].some((deps) => deps?.[exports.FORGESCRIPT]));
    });
}
/** @returns .js files, subdirs incl., `node_modules` & dot-dirs excl. */
function scripts(dir) {
    const found = [];
    for (const entry of (0, node_fs_1.readdirSync)(dir, { withFileTypes: true })) {
        const path = (0, node_path_1.join)(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== "node_modules" && !entry.name.startsWith("."))
                found.push(...scripts(path));
        }
        else if (entry.name.endsWith(".js"))
            found.push(path);
    }
    return found;
}
const failure = (error, file) => `${file}: ${error instanceof Error ? error.message : error}`;
/**
 * Adds every `NativeFunction` in a dir, like `ForgeExtension.load` would, w/o starting the ext
 * @param argTypes the `ArgType` of the FS they're built w/
 * @returns why files failed to load
 * @throws if the dir doesn't exist
 */
function loadNatives(dir, source, registry, argTypes) {
    const failures = [];
    for (const file of scripts(dir)) {
        // reading's way cheaper than running every file of a pkg
        if (!NATIVE.test((0, node_fs_1.readFileSync)(file, "utf8")))
            continue;
        try {
            const exported = require(file);
            const fn = exported?.default ?? exported;
            if (typeof fn?.data?.name === "string" && fn.data.name.startsWith("$")) {
                registry.add((0, convert_1.fromNative)(fn.data, source, argTypes));
            }
        }
        catch (error) {
            failures.push(failure(error, file));
        }
    }
    return failures;
}
/**
 * Adds custom fns like `ForgeClient`'s `functions` does: a .js exports one, an array or `ForgeFunction`s.
 * They replace fns of the same name
 * @returns why files failed to load
 * @throws if the dir doesn't exist
 */
function loadCustomFunctions(dir, source, registry, argTypes) {
    const failures = [];
    for (const file of scripts(dir)) {
        try {
            const exported = require(file);
            if (!Object.keys(exported).length)
                continue;
            for (const item of [exported.default ?? exported].flat(Infinity)) {
                // a `ForgeFunction` keeps it in `data`
                const data = typeof item?.data?.code === "string" ? item.data : item;
                if (typeof data?.name === "string" && typeof data.code === "string") {
                    registry.add((0, convert_1.fromCustom)(data, source, argTypes), true);
                }
            }
        }
        catch (error) {
            failures.push(failure(error, file));
        }
    }
    return failures;
}
//# sourceMappingURL=packages.js.map