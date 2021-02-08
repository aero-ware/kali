import { Command } from "@aeroware/aeroclient/dist/types";
import { GuildMember } from "discord.js";
import prefix from "..";
import Embed from "../utils/Embed";
import getFlags from "../utils/getFlags";

const options: {
    [flag: string]: {
        alias: string;
        message: string;
    };
} = {
    "--name": {
        alias: "-n",
        message: "Bans all users with a specific nickname",
    },
    "--regex": {
        alias: "-r",
        message: "Bans all users whose nickname match the regex",
    },
    "--silent": {
        alias: "-s",
        message: "Bans users silently; does not DM them or displays result",
    },
    "--soft": {
        alias: "-S",
        message: "Effectively kicks users and clears their messages",
    },
    "--hard": {
        alias: "-H",
        message: "Bans users and appends your custom message to the DM",
    },
    "--help": {
        alias: "-h",
        message: "Displays this nice little help message",
    },
    "--dev": {
        alias: "-d",
        message: "For testing purposes; does not ban",
    },
};

export default {
    name: "ban",
    args: true,
    usage: "[options] <arguments>",
    async callback(this: Command, { message, args, client }) {
        const flags = getFlags(args);
        const flagNames = flags.map((f) => f.flag);
        const booleanFlags = new Set(
            flags.map(({ flag }) => options[`--${flag}`]?.alias || `-${flag}`)
        );

        const members: GuildMember[] = [];

        for (const arg of args) {
            if (/^<@!?\d{18}>$/.test(arg)) {
                const member = message.guild!.members.cache.get(arg.match(/(\d{18})/)![0]);
                if (member && member.id !== client.user?.id) members.push(member);
            } else if (/^\d{18}$/.test(arg)) {
                const member = message.guild!.members.cache.get(arg);
                if (member && member.id !== client.user?.id) members.push(member);
            } else break;
        }

        for (const { flag, index } of flags) {
            switch (flag) {
                case "help":
                case "h":
                    return message.channel.send(`
\`\`\`
${prefix}${this.name}

    SYNTAX:
        ${prefix}${this.name} ${this.usage}

    OPTIONS:${Object.keys(options).map(
        (flag) =>
            `\n        ${`${flag}, ${options[flag].alias}`.padEnd(16, " ")}${
                options[flag].message
            }`
    )}
    
    DEFAULT:
        Bans users by mention or id with an optional reason
\`\`\`
`);
                case "regex":
                case "r":
                    if (!args[index + 1])
                        return message.channel.send(
                            `A regex is required when using the \`regex\` flag.`
                        );

                    if (args[index + 1].length > 12 || args[index + 1].length < 3)
                        return message.channel.send(
                            `Regex must be between 3 and 12 characters long.`
                        );

                    const regex = new RegExp(args[index + 1] || "");

                    members.length = 0;

                    members.push(
                        ...message.guild?.members.cache
                            .filter((m) => regex.test(m.displayName))
                            .array()!
                    );
                    break;
            }
        }

        const reason =
            args
                .slice(
                    members.length +
                        (flagNames.includes("r") || flagNames.includes("regex")
                            ? flags[
                                  flagNames.lastIndexOf("r") < 0
                                      ? flagNames.lastIndexOf("regex")
                                      : flagNames.lastIndexOf("r")
                              ].index
                            : 0),
                    flagNames.includes("H") || flagNames.includes("hard")
                        ? args.lastIndexOf([...args].reverse().find((a) => a.startsWith("-"))!)
                        : undefined
                )
                .filter((arg) => !/--?\w+/.test(arg))
                .join(" ") || "No reason specified";

        await Promise.all(
            members.map(async (m, i) => {
                try {
                    if (!booleanFlags.has("-d")) await m.ban({ reason });

                    if (booleanFlags.has("-S")) await message.guild?.members.unban(m.user);

                    if (!booleanFlags.has("-s"))
                        try {
                            const dm = await m.createDM(true);
                            await client.users.cache.get(m.id)?.createDM();
                            await dm.send(
                                `You have been banned from **${
                                    message.guild?.name
                                }** for \`${reason}\`${
                                    booleanFlags.has("-H")
                                        ? `\n**${message.author.tag}**'s comment: ${args
                                              .slice(
                                                  flags[
                                                      flagNames.indexOf("H") < 0
                                                          ? flagNames.indexOf("hard")
                                                          : flagNames.indexOf("H")
                                                  ].index + 1
                                              )
                                              .join(" ")}`
                                        : ""
                                }`.slice(0, 2000)
                            );
                        } catch (e) {
                            console.log(e);
                            await message.channel.send(
                                `Could not send DM to **${m.user.tag}**`
                            );
                        }
                } catch {
                    members.splice(i, 1);
                    if (!booleanFlags.has("-s"))
                        await message.channel.send(`Could not ban **${m.user.tag}**`);
                }
            })
        );

        if (!members.length) return;

        if (booleanFlags.has("-s")) return;

        return message.channel.send(
            new Embed()
                .setTitle(`Banned ${members.length} user${members.length !== 1 ? "s" : ""}`)
                .addField("Reason", `\`${reason}\``)
                .setDescription(
                    `**Banned users:**\n${members.map((m) => `${m.user.tag}`).join("\n")}`
                )
        );
    },
} as Command;