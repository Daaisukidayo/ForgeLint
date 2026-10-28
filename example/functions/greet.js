// a custom function: $greet[name]
module.exports = {
    name: "greet",
    params: ["name"],
    code: "Hello, $env[name]!",
}
