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
8. [In an editor](#in-an-editor)
9. [Caveats](#caveats)

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

Example output:

```
ForgeLint  1 code in 1 file, 1122 functions known

commands/daily.js
  3:12  error    Unknown event messageCreat. Did you mean messageCreate?  unknown-event
  5:40  error    $let takes at most 2 arguments, got 3. Usage: $let[key;value]  too-many-arguments
  6:9   error    Unknown function $sendMesage. Did you mean $sendMessage?  unknown-function
  7:45  error    This ] closes $description, not the [ before it. Escape it: \\]  unescaped-bracket
  7:67  warning  This ] closes nothing and is printed as text. If that's intended, escape it: \\]  stray-bracket

✗ 4 errors, 1 warning (0.75 s)
```

On an error it exits with code 1, which keeps a broken bot from starting:

```json
"scripts": { "start": "forgelint && node index.js" }
```

`npx forgelint init` creates a config file. You only need one to change the defaults.

<h3 align="center">Rules</h3><hr>

| Rule | Default | |
|---|---|---|
| **`unknown-function`** | error | `$sendMesage`, or `$getUserVar` without ForgeDB installed. Suggests the closest name. |
| **`unknown-event`** | error | `type: "messageCreat"`: the command never runs. Suggests the closest name. Slash commands' `type` isn't checked. |
| **`glued-name`** | warning | `$pingms` runs `$ping` and prints `ms`. Often done on purpose. |
| **`too-many-arguments`** | error | `$get[a;b]`. The code won't compile. |
| **`too-few-arguments`** | error | `$addField[Coins]`. |
| **`missing-brackets`** | error | `$get` without brackets. The code won't compile. |
| **`unexpected-brackets`** | warning | `$ping[x]`: `$ping` takes no arguments, and `[x]` is printed as text. |
| **`unclosed-bracket`** | error | `$footer[text` without a closing `]`. The code won't compile. |
| **`unescaped-bracket`** | error | `$description[[Docs](url)]`: the first `]` closes `$description`. Escape it as `\\]` in a JavaScript string. `--fix-brackets` escapes it. |
| **`stray-bracket`** | warning | A top-level `]` that closes nothing, usually left over after an unescaped `]`. `--fix-brackets` escapes it. |
| **`invalid-argument`** | error | Text that can't be the argument's type: `$round[abc]`, `$addField[a;b;maybe]`, a wrong enum value, an empty required argument: `$sendMessage[;hi]`. |
| **`unused-variable`** | warning | `$let[coins;5]` that no `$get`, `$has` or `$letSum` reads. Skipped in code that calls a custom function, `$eval`, `$callFunction` or an extension that runs code with the caller's variables: they could read it. |
| **`deprecated`** | warning | A deprecated function. |
| **`function-case`** | info | `$authorid` instead of `$authorID`. `--fix` fixes it. |

<h3 align="center">Formatting</h3><hr>

```bash
npx forgelint --fix            # formats files in place, then checks them
npx forgelint --fix-brackets   # also escapes each ] that closes a function too early or closes nothing
npx forgelint --check          # also fails on unformatted files
```

The formatter only:

- writes function names in their declared case: `$AUTHORID` → `$authorID`,
- indents lines that start with a function, `;` or `]` by nesting depth, lining up a function's `;` and `]` with the function itself,
- removes trailing whitespace after code and spaces on blank lines between code.

Lines that start with text stay as written: your messages don't change. In code with broken brackets, only the names get fixed. `--fix-brackets` has its own flag because it changes what the bot prints.

```
$LET[roll;$randomNumber[1;7]]         $let[roll;$randomNumber[1;7]]
$if[$get[roll]==6;                    $if[$get[roll]==6;
$title[Six!]                    →         $title[Six!]
    $COLOR[Gold]                          $color[Gold]
  ;                                   ;
        $title[You rolled]                $title[You rolled]
      ]                               ]
```

<h3 align="center">Where it looks</h3><hr>

ForgeLint checks the `code:` strings in `.js` and `.ts` files (and `.cjs`, `.mjs`, `.cts`, `.mts`) in the config's folder, or in the current folder if there is no config. It skips `node_modules` and folders whose names start with a dot, as well as `dist`, `build`, `docs` and `coverage` at the top level. The `${...}` parts of template strings aren't checked.

Functions it knows about:

- **ForgeScript**, the version your bot has installed,
- **extensions**: dependencies in your `package.json` that depend on ForgeScript. They aren't started, and no database connects,
- **your files**: functions created with `new ForgeFunction`, `new NativeFunction` or `{ name, params, code }`,
- the config's `functions`, `natives` and `known`.

A command's `type` is checked against the events of ForgeScript and of those extensions.

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

ForgeLint looks for `forgelint.config.js` (or `.cjs`, `.mjs`) in the current folder and the ones above it, up to the folder with `package.json`. Paths in it are relative to its folder. Every option is optional, and a list option also takes a single string. In a bot with `"type": "module"`, export it with `export default`, as `npx forgelint init` does.

| Option | |
|---|---|
| **`include`** | Files and folders to check. Defaults to the config's folder. |
| **`exclude`** | File or folder names to skip anywhere, or paths from the config's folder, such as `["tests", "src/legacy"]`. |
| **`properties`** | Keys that hold ForgeScript code. Defaults to `["code"]`. |
| **`functions`** | Folders with custom functions, like the `functions` option of `ForgeClient`. They must be compiled `.js`. |
| **`natives`** | Folders with your `NativeFunction`s, as compiled `.js`, including ones outside `include`. |
| **`extensions`** | Extensions to load functions and events from, by package name. Defaults to every dependency that depends on ForgeScript. |
| **`known`** | Functions ForgeLint can't find in your files, such as ones whose names are built in code: `["$swordPrice"]`. They are never reported as unknown. |
| **`rules`** | `"error"`, `"warning"`, `"info"` or `"off"` for each rule. |
| **`indent`** | Spaces per indent level, or `"tab"`. Defaults to the indent the code already uses. |
| **`alignToKey`** | Indents top-level code lines one level under `code:` and lines the closing `` ` `` up with it. With `false`, they keep the indent of the first code line. Defaults to `true`. |

```bash
npx forgelint [paths...] [--fix] [--fix-brackets] [--check] [--json] [--config <file>]
npx forgelint init
```

<h3 align="center">As an extension</h3><hr>

Checks every command, slash command and custom function right before the bot logs in, with exactly the functions your client loaded.

```js
const { ForgeClient } = require("@tryforge/forgescript")
const { ForgeLint } = require("forge.lint")

const forgeLint = new ForgeLint({
    rules: { "function-case": "off" },
})

const client = new ForgeClient({
    extensions: [forgeLint],
    // ...
})
```

| Option | |
|---|---|
| **`check`** | Checks the code before logging in. Defaults to `true`. |
| **`stopOnError`** | On errors, `client.login()` rejects instead of logging in. Warnings don't count. Needs `check`. Defaults to `false`. |
| **`rules`** | Same as in the config. |

| Function | |
|---|---|
| **`$lintCode[code;output?]`** | Returns the problems as JSON, or as lines of text when `output` is `text`. |
| **`$formatCode[code;indent?]`** | Returns the formatted code. |
| **`$isCodeValid[code]`** | Returns `true` if the code has no errors. |

These functions get their arguments already run: code typed straight into `$lintCode[...]` runs instead of being checked. Pass it through a variable or `$message`, like a `!lint` command with `$lintCode[$message]`, or wrap it in `$escapeCode`: `$lintCode[$escapeCode[$let[a;1]]]`. There, escape a `]` that closes an unknown function, like a typo, and a `;` outside every function.

<h3 align="center">In an editor</h3><hr>

`forge.lint/core` lints and formats without ForgeScript and without reading files, which lets it run in an editor extension or a browser. It knows no functions by itself: give it the ones from the `metadata/functions.json` of ForgeScript and of each extension.

```js
const { Formatter, FunctionRegistry, Linter, checkScript, fromMetadata } = require("forge.lint/core")

const functions = new FunctionRegistry(metadata.map((data) => fromMetadata(data, "ForgeScript")))
const { problems, edits } = checkScript(text, new Linter(functions), new Formatter(functions))
```

`text` is a JavaScript or TypeScript file's content, saved or not. `problems` and `edits` use offsets in it, and problems also have a line and a column. A fourth argument takes `properties` and `alignToKey`, as in the config.

A bracket problem has a `fix`: an edit escaping the `]` the way the file writes it. To check commands' `type`, give the event names to `Linter` as its third argument: `new Linter(functions, rules, new Set(events))`. Set `opaque: true` on functions that run code with the caller's variables, such as custom functions, for `unused-variable` to skip the code calling them.

<h3 align="center">Caveats</h3><hr>

- **`]` closes a function.** In text, escape it as `\]`, which is `\\]` in a JavaScript string. `[` needs no escape.
- **In `$c[...]` comments**, only errors that stop the bot from starting are reported, for example `$get` without brackets.
- **Only code written as a string is checked.** A `code:` built in JavaScript, like `code: makeCode()`, is skipped. Functions whose names are built in code aren't found either: add them to `known`.
- **Native functions read from your `.js`/`.ts` source files:** enum values and arguments built in code (`args: makeArgs()`) aren't checked. Point `natives` at the compiled `.js` to check them.
