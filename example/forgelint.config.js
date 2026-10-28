/** @type {import("forge.lint").IForgeLintConfig} */
module.exports = {
    include: ["commands", "functions"],

    // custom functions, as in ForgeClient's `functions`
    functions: "./functions",

    // your own NativeFunctions, compiled .js, so their args get checked too
    natives: "./natives",

    // made at runtime, so ForgeLint can't see them
    known: ["$dailyReward"],
}
