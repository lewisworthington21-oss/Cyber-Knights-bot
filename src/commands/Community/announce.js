import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
} from 'discord.js';

const ANNOUNCEMENT_COLOUR = 0x2f80ed;

const CYBER_KNIGHTS_LOGO =
    'https://cdn.discordapp.com/attachments/1551328297055682692/1554627911926161469/FF973EB2-E985-4773-9333-D6D7DEB19C42.png?backend=b2&ex=6ac57c91&is=6ac42b11&hm=14e26b83ea58b8631ac8ff3b91fb829589b2bdb298e4c734f295a7df5ea518be';

const TYPE_CONFIG = {
    tournament: {
        emoji: '🏆',
        title: 'TOURNAMENT UPDATE',
    },

    match: {
        emoji: '⚔️',
        title: 'MATCH UPDATE',
    },

    team: {
        emoji: '🛡️',
        title: 'TEAM UPDATE',
    },

    roster: {
        emoji: '👥',
        title: 'ROSTER UPDATE',
    },

    practice: {
        emoji: '🎯',
        title: 'PRACTICE SESSION',
    },

    general: {
        emoji: '📢',
        title: 'CYBER KNIGHTS UPDATE',
    },
};

const data = new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Create a professional Cyber Knights announcement')

    // Required options MUST come before optional options.
    .addStringOption(option =>
        option
            .setName('type')
            .setDescription('Type of announcement')
            .setRequired(true)
            .addChoices(
                {
                    name: '🏆 Tournament',
                    value: 'tournament',
                },
                {
                    name: '⚔️ Match',
                    value: 'match',
                },
                {
                    name: '🛡️ Team',
                    value: 'team',
                },
                {
                    name: '👥 Roster',
                    value: 'roster',
                },
                {
                    name: '🎯 Practice',
                    value: 'practice',
                },
                {
                    name: '📢 General',
                    value: 'general',
                }
            )
    )

    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('Channel where the announcement will be posted')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
    )

    .addStringOption(option =>
        option
            .setName('message')
            .setDescription('The main information you want to announce')
            .setRequired(true)
    )

    .addRoleOption(option =>
        option
            .setName('role')
            .setDescription('Optional role to mention')
            .setRequired(false)
    )

    .addStringOption(option =>
        option
            .setName('date')
            .setDescription('Optional date, e.g. 2026-10-12')
            .setRequired(false)
    )

    .addStringOption(option =>
        option
            .setName('time')
            .setDescription('Optional time, e.g. 20:30')
            .setRequired(false)
    )

    .addStringOption(option =>
        option
            .setName('timezone')
            .setDescription('Optional timezone, e.g. Europe/London')
            .setRequired(false)
    )

    .addStringOption(option =>
        option
            .setName('link')
            .setDescription('Optional tournament or information link')
            .setRequired(false)
    )

    .addStringOption(option =>
        option
            .setName('format')
            .setDescription('Optional format, e.g. 5v5 TH18')
            .setRequired(false)
    )

    .addStringOption(option =>
        option
            .setName('prize')
            .setDescription('Optional prize information')
            .setRequired(false)
    );

function cleanText(value) {
    if (!value) {
        return null;
    }

    const cleaned = String(value).trim();

    return cleaned.length > 0
        ? cleaned
        : null;
}

function isValidTimezone(timezone) {
    if (!timezone) {
        return false;
    }

    try {
        Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
        });

        return true;
    } catch {
        return false;
    }
}

function convertDateTimeToUnix(
    date,
    time,
    timezone
) {
    if (!date || !time || !timezone) {
        return null;
    }

    if (!isValidTimezone(timezone)) {
        return null;
    }

    const dateMatch =
        /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    const timeMatch =
        /^(\d{2}):(\d{2})$/.exec(time);

    if (!dateMatch || !timeMatch) {
        return null;
    }

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);

    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);

    if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {
        return null;
    }

    const initialUtc = Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute
    );

    const formatter =
        new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });

    const parts = formatter.formatToParts(
        new Date(initialUtc)
    );

    const values = {};

    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = Number(
                part.value
            );
        }
    }

    const timezoneAsUtc = Date.UTC(
        values.year,
        values.month - 1,
        values.day,
        values.hour,
        values.minute
    );

    const offset =
        timezoneAsUtc - initialUtc;

    return Math.floor(
        (initialUtc - offset) / 1000
    );
}

function buildDiscordTimestamp(
    date,
    time,
    timezone
) {
    const unix =
        convertDateTimeToUnix(
            date,
            time,
            timezone
        );

    if (!unix) {
        return null;
    }

    return `<t:${unix}:F>\n<t:${unix}:R>`;
}

function buildWhenField(
    date,
    time,
    timezone
) {
    if (!date && !time) {
        return null;
    }

    if (
        date &&
        time &&
        timezone
    ) {
        return buildDiscordTimestamp(
            date,
            time,
            timezone
        );
    }

    if (date && !time) {
        return `📅 ${date}\n🕐 Time TBC`;
    }

    if (time && !date) {
        return `🕐 ${time}\n📅 Date TBC`;
    }

    return '📅 Date/time TBC';
}

function buildTournamentEmbed({
    message,
    date,
    time,
    timezone,
    format,
    prize,
    link,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(ANNOUNCEMENT_COLOUR)
            .setAuthor({
                name: 'CYBER KNIGHTS',
                iconURL: CYBER_KNIGHTS_LOGO,
            })
            .setTitle('🏆 TOURNAMENT UPDATE')
            .setThumbnail(
                CYBER_KNIGHTS_LOGO
            )
            .setDescription(message);

    if (format) {
        embed.addFields({
            name: '⚔️ FORMAT',
            value: format,
            inline: true,
        });
    }

    if (prize) {
        embed.addFields({
            name: '💰 PRIZE',
            value: prize,
            inline: true,
        });
    }

    const when =
        buildWhenField(
            date,
            time,
            timezone
        );

    if (when) {
        embed.addFields({
            name: '📅 WHEN',
            value: when,
            inline: false,
        });
    }

    if (link) {
        embed.addFields({
            name: '🔗 TOURNAMENT LINK',
            value: `[Open Tournament Information](${link})`,
            inline: false,
        });
    }

    embed.addFields({
        name: '➡️ NEXT STEP',
        value:
            'Keep an eye on the server for further tournament and match information.',
        inline: false,
    });

    return embed;
}

function buildMatchEmbed({
    message,
    date,
    time,
    timezone,
    format,
    link,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(ANNOUNCEMENT_COLOUR)
            .setAuthor({
                name: 'CYBER KNIGHTS',
                iconURL: CYBER_KNIGHTS_LOGO,
            })
            .setTitle('⚔️ MATCH UPDATE')
            .setThumbnail(
                CYBER_KNIGHTS_LOGO
            )
            .setDescription(message);

    if (format) {
        embed.addFields({
            name: '⚔️ FORMAT',
            value: format,
            inline: true,
        });
    }

    const when =
        buildWhenField(
            date,
            time,
            timezone
        );

    if (when) {
        embed.addFields({
            name: '📅 WHEN',
            value: when,
            inline: false,
        });
    }

    if (link) {
        embed.addFields({
            name: '🔗 MATCH INFORMATION',
            value: `[Open Match Information](${link})`,
            inline: false,
        });
    }

    embed.addFields({
        name: '➡️ TEAM PREPARATION',
        value:
            'Players involved should be available and ready at the required time.',
        inline: false,
    });

    return embed;
}

function buildPracticeEmbed({
    message,
    date,
    time,
    timezone,
    format,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(ANNOUNCEMENT_COLOUR)
            .setAuthor({
                name: 'CYBER KNIGHTS',
                iconURL: CYBER_KNIGHTS_LOGO,
            })
            .setTitle('🎯 PRACTICE SESSION')
            .setThumbnail(
                CYBER_KNIGHTS_LOGO
            )
            .setDescription(message);

    const when =
        buildWhenField(
            date,
            time,
            timezone
        );

    if (when) {
        embed.addFields({
            name: '📅 WHEN',
            value: when,
            inline: false,
        });
    }

    if (format) {
        embed.addFields({
            name: '🎮 SESSION',
            value: format,
            inline: true,
        });
    }

    embed.addFields({
        name: '➡️ PREPARATION',
        value:
            'Please be ready to join and prepared for the session.',
        inline: false,
    });

    return embed;
}

function buildRosterEmbed({
    message,
    link,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(ANNOUNCEMENT_COLOUR)
            .setAuthor({
                name: 'CYBER KNIGHTS',
                iconURL: CYBER_KNIGHTS_LOGO,
            })
            .setTitle('👥 ROSTER UPDATE')
            .setThumbnail(
                CYBER_KNIGHTS_LOGO
            )
            .setDescription(message);

    if (link) {
        embed.addFields({
            name: '🔗 MORE INFORMATION',
            value: `[Open Information](${link})`,
            inline: false,
        });
    }

    embed.addFields({
        name: '➡️ NEXT STEP',
        value:
            'Please check the current team channels for any further information.',
        inline: false,
    });

    return embed;
}

function buildTeamEmbed({
    message,
    link,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(ANNOUNCEMENT_COLOUR)
            .setAuthor({
                name: 'CYBER KNIGHTS',
                iconURL: CYBER_KNIGHTS_LOGO,
            })
            .setTitle('🛡️ TEAM UPDATE')
            .setThumbnail(
                CYBER_KNIGHTS_LOGO
            )
            .setDescription(message);

    if (link) {
        embed.addFields({
            name: '🔗 MORE INFORMATION',
            value: `[Open Information](${link})`,
            inline: false,
        });
    }

    embed.addFields({
        name: '➡️ NEXT STEP',
        value:
            'Please make sure you have read and understood the information above.',
        inline: false,
    });

    return embed;
}

function buildGeneralEmbed({
    message,
    link,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(ANNOUNCEMENT_COLOUR)
            .setAuthor({
                name: 'CYBER KNIGHTS',
                iconURL: CYBER_KNIGHTS_LOGO,
            })
            .setTitle('📢 CYBER KNIGHTS UPDATE')
            .setThumbnail(
                CYBER_KNIGHTS_LOGO
            )
            .setDescription(message);

    if (link) {
        embed.addFields({
            name: '🔗 MORE INFORMATION',
            value: `[Open Information](${link})`,
            inline: false,
        });
    }

    return embed;
}

function buildAnnouncementEmbed({
    type,
    message,
    date,
    time,
    timezone,
    link,
    format,
    prize,
}) {
    switch (type) {
        case 'tournament':
            return buildTournamentEmbed({
                message,
                date,
                time,
                timezone,
                format,
                prize,
                link,
            });

        case 'match':
            return buildMatchEmbed({
                message,
                date,
                time,
                timezone,
                format,
                link,
            });

        case 'practice':
            return buildPracticeEmbed({
                message,
                date,
                time,
                timezone,
                format,
            });

        case 'roster':
            return buildRosterEmbed({
                message,
                link,
            });

        case 'team':
            return buildTeamEmbed({
                message,
                link,
            });

        case 'general':
        default:
            return buildGeneralEmbed({
                message,
                link,
            });
    }
}

async function execute(interaction) {
    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        return interaction.reply({
            content:
                '❌ You need the **Manage Server** permission to use this command.',
            ephemeral: true,
        });
    }

    await interaction.deferReply({
        ephemeral: true,
    });

    try {
        const type =
            interaction.options.getString(
                'type',
                true
            );

        const channel =
            interaction.options.getChannel(
                'channel',
                true
            );

        const message =
            cleanText(
                interaction.options.getString(
                    'message',
                    true
                )
            );

        const role =
            interaction.options.getRole(
                'role'
            );

        const date =
            cleanText(
                interaction.options.getString(
                    'date'
                )
            );

        const time =
            cleanText(
                interaction.options.getString(
                    'time'
                )
            );

        const timezone =
            cleanText(
                interaction.options.getString(
                    'timezone'
                )
            );

        const link =
            cleanText(
                interaction.options.getString(
                    'link'
                )
            );

        const format =
            cleanText(
                interaction.options.getString(
                    'format'
                )
            );

        const prize =
            cleanText(
                interaction.options.getString(
                    'prize'
                )
            );

        if (!channel.isTextBased()) {
            return interaction.editReply({
                content:
                    '❌ The selected channel is not a text channel.',
            });
        }

        if (!message) {
            return interaction.editReply({
                content:
                    '❌ Your announcement message cannot be empty.',
            });
        }

        if (
            timezone &&
            !isValidTimezone(timezone)
        ) {
            return interaction.editReply({
                content:
                    `❌ **${timezone}** is not a valid timezone.\n\nExample: \`Europe/London\`, \`Europe/Athens\`, or \`Asia/Kolkata\`.`,
            });
        }

        if (
            (date || time || timezone) &&
            (!date || !time || !timezone)
        ) {
            return interaction.editReply({
                content:
                    '❌ To add a scheduled time, please provide **date, time and timezone** together.',
            });
        }

        if (date && time && timezone) {
            const unix =
                convertDateTimeToUnix(
                    date,
                    time,
                    timezone
                );

            if (!unix) {
                return interaction.editReply({
                    content:
                        '❌ I could not understand that date/time combination.\n\nUse:\n`date: 2026-10-12`\n`time: 20:30`\n`timezone: Europe/London`',
                });
            }
        }

        if (link) {
            try {
                new URL(link);
            } catch {
                return interaction.editReply({
                    content:
                        '❌ The link provided is not a valid URL.',
                });
            }
        }

        const embed =
            buildAnnouncementEmbed({
                type,
                message,
                date,
                time,
                timezone,
                link,
                format,
                prize,
            });

        const content = role
            ? `${role}`
            : undefined;

        const sentMessage =
            await channel.send({
                content,
                embeds: [embed],
                allowedMentions: role
                    ? {
                          roles: [role.id],
                      }
                    : {
                          parse: [],
                      },
            });

        return interaction.editReply({
            content:
                `✅ **Announcement posted successfully.**\n\n📍 ${channel}\n🔗 [Jump to announcement](${sentMessage.url})`,
        });
    } catch (error) {
        console.error(
            '[ANNOUNCE] Failed:',
            error
        );

        return interaction.editReply({
            content:
                '❌ Something went wrong while creating the announcement. Check the Railway logs for details.',
        });
    }
}

export default {
    data,
    execute,
};
