// a variable nothing reads
module.exports = {
    name: "balance",
    type: "messageCreate",
    code: `
        $let[coins;100]
        $let[bonus;5]
        You have $get[coins] coins
    `,
}
