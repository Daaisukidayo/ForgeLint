<div align="center">

# ForgeLint

Lints and formats ForgeScript code. Catches unknown functions, wrong argument counts and unbalanced brackets before your bot runs them.

<a href="https://github.com/Daaisukidayo/ForgeLint/"><img src="https://img.shields.io/github/package-json/v/Daaisukidayo/ForgeLint/main?label=forge.lint&color=5c16d4" alt="forge.lint"></a>
<a href="https://github.com/tryforge/ForgeScript/"><img src="https://img.shields.io/github/package-json/v/tryforge/ForgeScript/main?label=@tryforge/forgescript&color=5c16d4" alt="@tryforge/forgescript"></a>
<a href="https://discord.gg/yFW5Ju6JP8"><img src="https://img.shields.io/discord/997899472610795580?logo=discord" alt="Discord"></a>

</div>

---

## Contents

1. [Installation](#installation)
2. [Rules](#rules)
3. [Formatting](#formatting)
4. [Where it looks](#where-it-looks)
5. [Turning rules off](#turning-rules-off)
6. [Config](#config)
7. [As an extension](#as-an-extension)
8. [Gotchas](#gotchas)

<h3 align="center">Installation</h3><hr>

```bash
npm i -D forge.lint
# or
npm i -D github:Daaisukidayo/ForgeLint#main
```

It needs **ForgeScript** and **Node.js 22** or newer. Run it in your bot's folder:

```bash
npx forgelint
```

```
ForgeLint  8 codes in 6 files, 1125 functions known

commands/arguments.js
  6:28   error    $let takes at most 2 arguments, got 3: $let[key;value]  too-many-arguments
  8:9    error    $addField needs at least 2 arguments, got 1: $addField[name;value;inline?;index?]  too-few-arguments
  12:17  error    Argument "number" of $double must be a number, not "two"  invalid-argument

commands/brackets.js
  7:27  error    This ] closes $description, not the [ before it. Escape it: \]  unescaped-bracket
  8:9   error    $footer[ is never closed. Add a ]  unclosed-bracket

commands/typos.js
  6:16   error    Unknown function $sendMesage. Did you mean $sendMessage?  unknown-function
  12:25  error    Unknown function $getUserVar: ForgeScript reads it as $get followed by "UserVar". Is the extension that adds it installed?  unknown-function

✗ 7 errors (0.68 s)
```

If it finds an error, it exits with code 1. Run it before your bot starts, and a broken bot won't start:

```json
"scripts": { "start": "forgelint && node index.js" }
```

`npx forgelint init` creates a config file. You only need one to change the defaults.

<h3 align="center">Rules</h3><hr>

| Rule | Default | |
|---|---|---|
| **`unknown-function`** | error | `$sendMesage`, or `$getUserVar` without ForgeDB installed. Suggests the closest name. |
| **`glued-name`** | warning | `$pingms` runs `$ping` and prints `ms`. Often done on purpose. |
| **`too-many-arguments`** | error | `$get[a;b]`. The code won't compile. |
| **`too-few-arguments`** | error | `$addField[Coins]`. |
| **`missing-brackets`** | error | `$get` without brackets. The code won't compile. |
| **`unexpected-brackets`** | warning | `$ping[x]`: `$ping` takes no arguments, so `[x]` is printed as text. |
| **`unclosed-bracket`** | error | `$footer[text` without a closing `]`. The code won't compile. |
| **`unescaped-bracket`** | error | `$description[[Docs](url)]`: the first `]` closes `$description`. Escape it as `\]`. |
| **`stray-bracket`** | warning | A top-level `]` that closes nothing, usually left over after an unescaped `]`. |
| **`invalid-argument`** | error | Text that can't be the argument's type: `$round[abc]`, `$addField[a;b;maybe]`, a wrong enum value, an empty required channel. |
| **`deprecated`** | warning | A deprecated function. |
| **`function-case`** | info | `$authorid` instead of `$authorID`. `--fix` fixes it. |

<h3 align="center">Formatting</h3><hr>

```bash
npx forgelint --fix     # formats files in place, then checks them
npx forgelint --check   # also fails on unformatted files
```

The formatter only:

- writes function names in their declared case: `$AUTHORID` → `$authorID`,
- indents lines that start with a function, `;` or `]` by nesting depth, lining up a function's `;` and `]` with the function itself,
- removes trailing whitespace after code and spaces on blank lines between code.

Lines that start with text stay as written, so your messages don't change. In code with broken brackets, only the names get fixed.

```
$LET[roll;$randomNumber[1;7]]         $let[roll;$randomNumber[1;7]]
$if[$get[roll]==6;                    $if[$get[roll]==6;
$title[Six!]                    →         $title[Six!]
    $COLOR[Gold]                          $color[Gold]
  ;                                   ;
        $title[You rolled]                $title[You rolled]
      ]                               ]
```

Top-level lines are indented one level deeper than their `code:` line, and the closing `` ` `` lines up with it. With `alignToKey: false`, each code keeps its own indent instead. The `indent` option sets the size of one level.

<h3 align="center">Where it looks</h3><hr>

ForgeLint checks the `code:` strings in `.js` and `.ts` files (and `.cjs`, `.mjs`, `.cts`, `.mts`) in the config's folder. It skips `node_modules` and folders whose names start with a dot, as well as `dist`, `build`, `docs` and `coverage` at the top level. The `${...}` parts of template strings aren't checked.

Functions it knows about:

- **ForgeScript**, the version your bot has installed,
- **extensions**: dependencies in your `package.json` that depend on ForgeScript. They aren't started, so no database connects,
- **your files**: functions created with `new ForgeFunction`, `new NativeFunction` or `{ name, params, code }`,
- the config's `functions`, `natives` and `known`.

<h3 align="center">Turning rules off</h3><hr>

For every file, in the config:

```js
rules: { "function-case": "off", "glued-name": "error" }
```

In code, with `$c`:

```
$c[forgelint-disable-next-line unknown-function]
$runtimeFunction

$c[forgelint-disable]
...all rules off until...
$c[forgelint-enable]

$pingms $c[forgelint-disable-line glued-name]
```

Without rule names, a directive applies to every rule. Separate several rule names with spaces or commas.

<h3 align="center">Config</h3><hr>

Put `forgelint.config.js` next to your `package.json`. Paths in it are relative to its folder. Every option is optional, and options that take a list also accept a single string.

| Option | |
|---|---|
| **`include`** | Files and folders to check. Defaults to the config's folder. |
| **`exclude`** | Names or paths to skip, such as `["tests", "src/legacy"]`. |
| **`properties`** | Keys that hold ForgeScript code. Defaults to `["code"]`. |
| **`functions`** | Folders with custom functions, like the `functions` option of `ForgeClient`. They must be compiled `.js`. |
| **`natives`** | Folders with your `NativeFunction`s, as compiled `.js`. Use it for native functions outside `include`, arguments built in code, and enum values. |
| **`extensions`** | Packages whose functions are known. Defaults to every dependency that depends on ForgeScript. |
| **`known`** | Functions created at runtime, such as `["$myFunction"]`. They are never reported as unknown. |
| **`rules`** | `"error"`, `"warning"`, `"info"` or `"off"` for each rule. |
| **`indent`** | Spaces per indent level, or `"tab"`. Defaults to the indent the code already uses. |
| **`alignToKey`** | Indents top-level code lines one level under `code:` and lines the closing `` ` `` up with it. Defaults to `true`. |

```bash
npx forgelint [paths...] [--fix] [--check] [--json] [--config <file>]
npx forgelint init
```

<h3 align="center">As an extension</h3><hr>

Checks every command, slash command and custom function right before the bot logs in, with exactly the functions your client loaded.

```js
const { ForgeClient } = require("@tryforge/forgescript")
const { ForgeLint } = require("forge.lint")

const forgeLint = new ForgeLint({
    rules: { 
        "function-case": "off" 
    },
})

const client = new ForgeClient({
    extensions: [forgeLint],
    // ...
})
```

| Option | |
|---|---|
| **`check`** | Checks the code before logging in. Defaults to `true`. |
| **`rules`** | Same as in the config. |

| Function | |
|---|---|
| **`$lintCode[code;output?]`** | Returns the problems as JSON, or as lines of text when `output` is `text`. |
| **`$formatCode[code;indent?]`** | Returns the formatted code. |
| **`$isCodeValid[code]`** | Returns `true` if the code has no errors. |

The code argument is resolved before the function runs, so pass it through `$message` or a variable, or escape each `$` as `\$`. For example, `!lint $sendMesage[hi]` → `$lintCode[$message]`.

<h3 align="center">Gotchas</h3><hr>

- **`]` closes a function.** In text, escape it as `\]`, which is `\\]` inside a JavaScript template string. `[` needs no escape.
- **In `$c[...]` comments**, only errors that stop the bot from starting are reported, for example `$get` without brackets.
- **Code built at runtime isn't checked**, and functions created at runtime are unknown: add them to `known`.
- **Native functions read from your `.js`/`.ts` source files:** enum values and arguments built in code (`args: makeArgs()`) aren't checked. Point `natives` at the compiled `.js` to check them.
