// works, but npx forgelint --fix tidies it
module.exports = {
    name: "dice",
    type: "messageCreate",
    code: `
        $LET[roll;$randomNumber[1;7]]
        $if[$get[roll]==6;
        $title[Six!]
            $COLOR[Gold]
        ;
                $title[You rolled $get[roll]]
              ]
    `,
}
