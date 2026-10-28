// wrong argument counts & values
module.exports = {
    name: "profile",
    type: "messageCreate",
    code: `
        $let[name;$username;unused]
        $title[Profile of $get[name]]
        $addField[Coins]
        $addField[Level;5;maybe]
        $addButton[shop;Shop;Big]
        $greet
        $double[two]
    `,
}
