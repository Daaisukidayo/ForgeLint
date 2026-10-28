import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Formatter } from ".."
import { format, registry } from "./support/harness"

const code = (...lines: string[]) => lines.join("\n")

describe("the formatter", () => {
    it("writes names in their declared case", () => {
        assert.equal(format("$AUTHORID $Get[x]"), "$authorID $get[x]")
    })

    it("indents nested functions, & a function's ; and ] like its line", () => {
        const messy = code(
            "",
            "    $if[$get[x]==1;",
            "    $title[Yes]",
            "        ;",
            "            $title[No]",
            "              ]",
            ""
        )

        assert.equal(
            format(messy, 4),
            code("", "    $if[$get[x]==1;", "        $title[Yes]", "    ;", "        $title[No]", "    ]", "")
        )
    })

    it("indents by the step the code uses most, else 4 spaces", () => {
        assert.equal(
            format(code("$if[x==1;", "  $title[a]", "    $color[Red]", "]")),
            code("$if[x==1;", "  $title[a]", "  $color[Red]", "]")
        )
        assert.equal(format(code("$if[x==1;", "$title[a]", "]")), code("$if[x==1;", "    $title[a]", "]"))
        assert.equal(format(code("$if[x==1;", "$title[a]", "]"), "tab"), code("$if[x==1;", "\t$title[a]", "]"))
    })

    it("keeps text lines & whitespace touching text as written", () => {
        const text = code(
            "$title[Hi]",
            "   Some text",
            "      $username",
            "$description[",
            "  line one",
            "  $get[x]",
            "]"
        )
        assert.equal(format(text), text)
    })

    it("drops trailing whitespace after code & empties blank lines", () => {
        assert.equal(format("$let[a;1]   \n    \n$let[b;2]"), "$let[a;1]\n\n$let[b;2]")
    })

    it("is stable", () => {
        const once = format(code("$IF[x==1;", "      $title[a]", "   ;", "$title[b]", "  ]"), 2)
        assert.equal(format(once, 2), once)
    })

    it("only fixes names when brackets don't add up", () => {
        assert.equal(format("$AUTHORID\n      $if[x;"), "$authorID\n      $if[x;")
    })

    it("leaves line breaks that aren't real alone", () => {
        // like an escaped \n in a JS string
        const same = "$if[x==1;\n$title[a]]"
        assert.equal(new Formatter(registry, 4).format(same, { isLineBreak: () => false }), same)
    })

    it("indents from the line the code starts on in its file", () => {
        assert.equal(
            new Formatter(registry, 2).format("$if[x==1;\n$title[a]\n]", { indent: "    " }),
            "$if[x==1;\n      $title[a]\n    ]"
        )
    })

    it("w/ alignToKey, puts top-level lines 1 level under the key & the closing line in line w/ it", () => {
        assert.equal(
            new Formatter(registry, 2).format("\n$if[x==1;\n$title[a]\n]\n", { indent: "    ", alignToKey: true }),
            "\n      $if[x==1;\n        $title[a]\n      ]\n    "
        )
        // too deep code gets pulled up to it
        assert.equal(
            new Formatter(registry).format("\n        $if[x==1;\n          $ping\n        ]\n  ", {
                indent: "  ",
                alignToKey: true,
            }),
            "\n    $if[x==1;\n      $ping\n    ]\n  "
        )
    })

    it("w/ alignToKey, learns the step from the key if nothing nests & leaves text lines alone", () => {
        // `code:` at 2, the code at 4, a text line at 0
        const code = "\n    $addTextDisplay[text===========\ntext---------------]\n  "
        assert.equal(new Formatter(registry).format(code, { indent: "  ", alignToKey: true }), code)
    })
})
