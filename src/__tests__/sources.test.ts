import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { HOLE, cook } from "../functions/embedded"
import { scanScript } from "../functions/script"

const CODE = new Set(["code"])

const codesOf = (source: string, keys = CODE) =>
    scanScript(source, keys).literals.map((literal) => cook(source, literal).code)

describe("JS & TS files", () => {
    it("give the strings of code keys, as JS reads them", () => {
        const source = [
            "module.exports = [",
            "    { name: 'a', code: `$ping` },",
            '    { name: "b", \'code\': "$authorID" },',
            "    { code: 'it\\'s' },",
            "]",
        ].join("\n")

        assert.deepEqual(codesOf(source), ["$ping", "$authorID", "it's"])
    })

    it("resolve escapes: \\\\] reaches ForgeScript as \\]", () => {
        assert.deepEqual(codesOf("x = { code: `$get[a\\\\]] \\` \\${x} \\n` }"), ["$get[a\\]] ` ${x} \n"])
    })

    it("keep String.raw as written", () => {
        assert.deepEqual(codesOf("x = { code: String.raw`$get[a\\]]` }"), ["$get[a\\]]"])
    })

    it("read a ${...} as one placeholder", () => {
        assert.deepEqual(codesOf("x = { code: `Hi ${user.name}! $ping` }"), [`Hi ${HOLE}! $ping`])
    })

    it("skip comments, types, regexes & keys outside objects", () => {
        const source = [
            "// { code: `$commented` }",
            "/* { code: `$blocked` } */",
            "interface Cmd { code: string }",
            "const re = /`{ code: `/g",
            "const pick = ok ? code : `$ternary`",
            "export default { code: `$real` }",
        ].join("\n")

        assert.deepEqual(codesOf(source), ["$real"])
    })

    it("take other keys from the config", () => {
        assert.deepEqual(codesOf("x = { setup: `$ping`, code: `$authorID` }", new Set(["setup"])), ["$ping"])
    })

    it("map each char back to the file, CRLF incl.", () => {
        const source = "x = { code: `a\\n\r\n  $ping` }"
        const embedded = cook(source, scanScript(source, CODE).literals[0])

        assert.equal(embedded.code, "a\n\n  $ping")
        assert.equal(source[embedded.map[embedded.code.indexOf("$")]], "$")
        // the escaped \n isn't a real line break
        assert.equal(embedded.isLineBreak(1), false)
        assert.equal(embedded.isLineBreak(2), true)
    })
})

describe("functions a file defines", () => {
    it("custom ones, w/ their params", () => {
        const source = `
            export default new ForgeFunction({
                name: "give",
                params: ["user", { name: "amount", type: ArgType.Number, required: false }],
                code: \`$ping\`,
            })
            module.exports = { name: "plain", params: [], brackets: false, code: "" }
            module.exports = { name: "ping", type: "messageCreate", code: "" }
        `

        assert.deepEqual(scanScript(source, CODE).definitions, [
            {
                name: "give",
                kind: "custom",
                brackets: undefined,
                params: ["user", { name: "amount", type: "Number", required: false }],
                firstParamCondition: false,
            },
            { name: "plain", kind: "custom", brackets: false, params: [], firstParamCondition: false },
        ])
    })

    it("natives w/ their args, as objects or `Arg.*` calls", () => {
        const source = `export default new NativeFunction({
            name: "$isOneOf",
            aliases: ["$oneOf"],
            unwrap: true,
            brackets: true,
            deprecated: true,
            args: [
                { name: "string", description: "x", type: ArgType.String, required: true, rest: false, check: (v) => !!v },
                Arg.restString("matches", "y", true),
                forgescript_1.Arg.optionalEnum(Style, "style"),
            ],
            execute() {},
        })`

        assert.deepEqual(scanScript(source, CODE).definitions, [
            {
                name: "$isOneOf",
                kind: "native",
                brackets: true,
                params: null,
                firstParamCondition: false,
                args: [
                    { name: "string", type: "String", required: true, rest: false, condition: false },
                    { method: "restString", values: ["matches", "y", true] },
                    { method: "optionalEnum", values: [undefined, "style"] },
                ],
                unwrap: true,
                aliases: ["$oneOf"],
                deprecated: true,
            },
        ])
    })

    it("native args it can't read as null", () => {
        for (const args of ["ARGS", "[...ARGS]", "[makeArg()]", "[{ name }]"]) {
            const source = `new NativeFunction({ name: "$x", brackets: true, args: ${args} })`
            assert.equal(scanScript(source, CODE).definitions[0].args, null, args)
        }
    })

    it("params it can't read as null", () => {
        const source = "new ForgeFunction({ name: 'x', params: PARAMS, code: '' })"
        assert.equal(scanScript(source, CODE).definitions[0].params, null)
    })
})
