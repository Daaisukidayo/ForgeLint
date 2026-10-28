# Contributing to ForgeLint

Thanks for helping out. Bug reports, ideas and pull requests are all welcome.

## Bugs

Open an issue with:

- your ForgeScript, ForgeLint and Node.js versions,
- the smallest piece of code that reproduces the bug,
- what ForgeLint reported, and what ForgeScript actually does with that code.

## Setup

You need **Node.js 22** or newer.

```bash
git clone https://github.com/Daaisukidayo/ForgeLint.git
cd ForgeLint
npm i
```

| Script | |
|---|---|
| `npm test` | Builds the project and runs every test. |
| `npm run example` | Runs the CLI on the example bot. The bot has one mistake for each rule, so the command exits with code 1. |
| `npm run lint` | Checks the code with ESLint and Prettier. |
| `npm run tidy` | Fixes everything ESLint and Prettier can fix. |
| `npm run build` | Builds `dist` without the tests. |
| `npm run commit` | Regenerates `dist`, `docs` and `metadata`, adds the commit message to the changelog, then commits and pushes. |

## Layout

| Folder | |
|---|---|
| `src/structures` | `Parser` (reads code the same way ForgeScript's compiler does), `Linter` (the rules), `Formatter`, `FunctionRegistry`, `Project` (files and config), `Reporter`. |
| `src/functions` | Finding ForgeScript code in JavaScript and TypeScript files (`script`, `embedded`) and loading functions from packages. |
| `src/native` | `$lintCode`, `$formatCode`, `$isCodeValid`. |
| `src/__tests__` | Tests and their helpers. |
| `example` | A bot with one mistake for each rule. The CLI tests run on it. |
| `scripts` | `checkpack.js` fails if `npm pack` would include unexpected files or leave out required ones. It runs before publishing. |

## Adding a rule

1. Add it to `Rule` in `src/types.ts` and to `DefaultSeverities` in `src/structures/Linter.ts`.
2. Syntax problems belong in `Parser`, everything else in `Linter.check`.
3. First check what ForgeScript really does with the code: report what the bot will do, not what merely looks odd.
4. Add tests to `src/__tests__/linter.test.ts` and a row to the rule table in the README.
