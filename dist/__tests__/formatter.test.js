"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const __1 = require("..");
const harness_1 = require("./support/harness");
const code = (...lines) => lines.join("\n");
(0, node_test_1.describe)("the formatter", () => {
    (0, node_test_1.it)("writes names in their declared case", () => {
        strict_1.default.equal((0, harness_1.format)("$AUTHORID $Get[x]"), "$authorID $get[x]");
    });
    (0, node_test_1.it)("indents nested functions, & a function's ; and ] like its line", () => {
        const messy = code("", "    $if[$get[x]==1;", "    $title[Yes]", "        ;", "            $title[No]", "              ]", "");
        strict_1.default.equal((0, harness_1.format)(messy, 4), code("", "    $if[$get[x]==1;", "        $title[Yes]", "    ;", "        $title[No]", "    ]", ""));
    });
    (0, node_test_1.it)("indents by the step the code uses most, else 4 spaces", () => {
        strict_1.default.equal((0, harness_1.format)(code("$if[x==1;", "  $title[a]", "    $color[Red]", "]")), code("$if[x==1;", "  $title[a]", "  $color[Red]", "]"));
        strict_1.default.equal((0, harness_1.format)(code("$if[x==1;", "$title[a]", "]")), code("$if[x==1;", "    $title[a]", "]"));
        strict_1.default.equal((0, harness_1.format)(code("$if[x==1;", "$title[a]", "]"), "tab"), code("$if[x==1;", "\t$title[a]", "]"));
    });
    (0, node_test_1.it)("keeps text lines & whitespace touching text as written", () => {
        const text = code("$title[Hi]", "   Some text", "      $username", "$description[", "  line one", "  $get[x]", "]");
        strict_1.default.equal((0, harness_1.format)(text), text);
    });
    (0, node_test_1.it)("drops trailing whitespace after code & empties blank lines", () => {
        strict_1.default.equal((0, harness_1.format)("$let[a;1]   \n    \n$let[b;2]"), "$let[a;1]\n\n$let[b;2]");
    });
    (0, node_test_1.it)("is stable", () => {
        const once = (0, harness_1.format)(code("$IF[x==1;", "      $title[a]", "   ;", "$title[b]", "  ]"), 2);
        strict_1.default.equal((0, harness_1.format)(once, 2), once);
    });
    (0, node_test_1.it)("only fixes names when brackets don't add up", () => {
        strict_1.default.equal((0, harness_1.format)("$AUTHORID\n      $if[x;"), "$authorID\n      $if[x;");
    });
    (0, node_test_1.it)("leaves line breaks that aren't real alone", () => {
        // like an escaped \n in a JS string
        const same = "$if[x==1;\n$title[a]]";
        strict_1.default.equal(new __1.Formatter(harness_1.registry, 4).format(same, { isLineBreak: () => false }), same);
    });
    (0, node_test_1.it)("indents from the line the code starts on in its file", () => {
        strict_1.default.equal(new __1.Formatter(harness_1.registry, 2).format("$if[x==1;\n$title[a]\n]", { indent: "    " }), "$if[x==1;\n      $title[a]\n    ]");
    });
    (0, node_test_1.it)("w/ alignToKey, puts top-level lines 1 level under the key & the closing line in line w/ it", () => {
        strict_1.default.equal(new __1.Formatter(harness_1.registry, 2).format("\n$if[x==1;\n$title[a]\n]\n", { indent: "    ", alignToKey: true }), "\n      $if[x==1;\n        $title[a]\n      ]\n    ");
        // too deep code gets pulled up to it
        strict_1.default.equal(new __1.Formatter(harness_1.registry).format("\n        $if[x==1;\n          $ping\n        ]\n  ", {
            indent: "  ",
            alignToKey: true,
        }), "\n    $if[x==1;\n      $ping\n    ]\n  ");
    });
    (0, node_test_1.it)("w/ alignToKey, learns the step from the key if nothing nests & leaves text lines alone", () => {
        // `code:` at 2, the code at 4, a text line at 0
        const code = "\n    $addTextDisplay[text===========\ntext---------------]\n  ";
        strict_1.default.equal(new __1.Formatter(harness_1.registry).format(code, { indent: "  ", alignToKey: true }), code);
    });
});
//# sourceMappingURL=formatter.test.js.map