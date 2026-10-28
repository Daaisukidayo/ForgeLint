// unknown functions
module.exports = [
    {
        name: "hello",
        type: "messageCreate",
        code: `$sendMesage[$channelID;Hi, $username!]`,
    },
    {
        name: "coins",
        type: "messageCreate",
        // $getUserVar comes from ForgeDB, which this bot doesn't have
        code: `You have $getUserVar[coins] coins`,
    },
    {
        name: "legacy",
        type: "messageCreate",
        code: `
            $c[forgelint-disable-next-line unknown-function]
            $oldFunction
        `,
    },
]
