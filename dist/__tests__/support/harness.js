"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.format = exports.rulesIn = exports.lint = exports.registry = exports.EXAMPLE = exports.ROOT = void 0;
exports.folder = folder;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const __1 = require("../..");
/** the repo, tests use its FS */
exports.ROOT = (0, node_path_1.join)(__dirname, "..", "..", "..");
exports.EXAMPLE = (0, node_path_1.join)(exports.ROOT, "example");
/** FS's fns + a custom `$greet[name]` */
exports.registry = new __1.FunctionRegistry(new __1.Project({}, exports.ROOT).functions.functions);
exports.registry.add((0, __1.fromCustom)({ name: "greet", params: ["name"], code: "" }, "test"));
const lint = (code, rules) => new __1.Linter(exports.registry, rules).lint(code);
exports.lint = lint;
/** @returns broken rules, in code order */
const rulesIn = (code, rules) => (0, exports.lint)(code, rules).map((problem) => problem.rule);
exports.rulesIn = rulesIn;
const format = (code, indent) => new __1.Formatter(exports.registry, indent).format(code);
exports.format = format;
/** temp dirs, nuked after the file */
const made = [];
(0, node_test_1.after)(() => {
    for (const dir of made)
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
});
/**
 * @param files path → content
 * @returns a temp dir w/ them, inside the repo so its FS gets found
 */
function folder(files) {
    const parent = (0, node_path_1.join)(exports.ROOT, ".test-tmp");
    (0, node_fs_1.mkdirSync)(parent, { recursive: true });
    const root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)(parent, "project-"));
    made.push(root);
    for (const [path, content] of Object.entries(files)) {
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)((0, node_path_1.join)(root, path)), { recursive: true });
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(root, path), content);
    }
    return root;
}
//# sourceMappingURL=harness.js.map