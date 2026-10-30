// a bot imports "forge.lint", the example lives inside the package
/** @type {import("../src").IForgeLintConfig} */
const config = {
    include: ["commands", "functions"],

    // custom functions, as in ForgeClient's `functions`
    functions: "./functions",

    // your own NativeFunctions, compiled .js: their args get checked too
    natives: "./natives",

    // ForgeLint can't find these in the files, e.g. their names are built in code
    known: ["$dailyReward"],
}

module.exports = config
