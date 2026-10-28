// no problems
module.exports = {
    name: "ping",
    type: "messageCreate",
    code: `
        $greet[$username]
        Pong! Took $ping ms, twice that is $double[$ping]
        $dailyReward
    `,
}
