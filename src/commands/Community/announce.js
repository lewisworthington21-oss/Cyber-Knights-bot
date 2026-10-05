import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
} from 'discord.js';

const ANNOUNCEMENT_COLOUR = 0x2f80ed;

const TYPE_CONFIG = {
    tournament: {
        label: 'Tournament',
        emoji: '🏆',
    },
    match: {
        label: 'Match',
        emoji: '⚔️',
    },
    team: {
        label: 'Team',
        emoji: '🛡️',
    },
    roster: {
        label: 'Roster',
        emoji: '👥',
    },
    practice: {
        label: 'Practice',
        emoji: '🎯',
    },
    general: {
        label: 'General',
        emoji: '📢',
    },
};

const data = new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Create a professional Cyber Knights announcement')

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
            .setDescription('Optional website or tournament link')
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

function buildTimestamp(unix) {
    if (
        !unix ||
        !Number.isFinite(Number(unix))
    ) {
        return null;
    }

    const timestamp = Number(unix);

    return `<t:${timestamp}:F>\n<t:${timestamp}:R>`;
}

function buildDetails({
    type,
    date,
    time,
    timezone,
    format,
    prize,
}) {
    const fields = [];

    if (type === 'tournament') {
        if (format) {
            fields.push({
                name: '⚔️ Format',
                value: format,
                inline: true,
            });
        }

        if (prize) {
            fields.push({
                name: '💰 Prize',
                value: prize,
                inline: true,
            });
        }
    }

    if (type === 'match') {
        if (format) {
            fields.push({
                name: '⚔️ Format',
                value: format,
                inline: true,
            });
        }
    }

    if (
        date &&
        time &&
        timezone
    ) {
        const unix =
            convertDateTimeToUnix(
                date,
                time,
                timezone
            );

        const timestamp =
            buildTimestamp(unix);

        if (timestamp) {
            fields.push({
                name: '📅 When',
                value: timestamp,
                inline: false,
            });
        }
    }

    return fields;
}

function buildAnnouncementContent({
    type,
    message,
}) {
    const config =
        TYPE_CONFIG[type] ||
        TYPE_CONFIG.general;

    let title = message;
    let description = message;
    let callToAction = null;

    if (type === 'tournament') {
        title = 'Tournament Update';

        description =
            `Cyber Knights have an important tournament update.\n\n${message}`;

        callToAction =
            'Keep an eye on the server for further tournament and match information.';
    }

    if (type === 'match') {
        title = 'Match Update';

        description =
            `Cyber Knights match information.\n\n${message}`;

        callToAction =
            'Players involved should be ready and available at the required time.';
    }

    if (type === 'team') {
        title = 'Team Update';

        description =
            `An important update for the Cyber Knights team.\n\n${message}`;

        callToAction =
            'Please make sure you have read and understood the information above.';
    }

    if (type === 'roster') {
        title = 'Roster Update';

        description =
            `There has been an update to the Cyber Knights roster.\n\n${message}`;

        callToAction =
            'Please check the current roster and team channels for any further information.';
    }

    if (type === 'practice') {
        title = 'Practice Session';

        description =
            `Cyber Knights practice information.\n\n${message}`;

        callToAction =
            'Players should be ready to join and prepared to practice.';
    }

    if (type === 'general') {
        title = 'Cyber Knights Update';

        description = message;
    }

    return {
        title,
        description,
        callToAction,
        emoji: config.emoji,
    };
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
    const config =
        TYPE_CONFIG[type] ||
        TYPE_CONFIG.general;

    const content =
        buildAnnouncementContent({
            type,
            message,
        });

    const embed =
        new EmbedBuilder()
            .setColor(ANNOUNCEMENT_COLOUR)
            .setAuthor({
                name: 'CYBER KNIGHTS',
            })
            .setTitle(
                `${config.emoji} ${content.title}`
            )
            .setDescription(
                content.description
            );

    const details =
        buildDetails({
            type,
            date,
            time,
            timezone,
            format,
            prize,
        });

    if (details.length > 0) {
        embed.addFields(details);
    }

    if (link) {
        embed.addFields({
            name: '🔗 More Information',
            value: `[Open Link](${link})`,
            inline: false,
        });
    }

    if (content.callToAction) {
        embed.addFields({
            name: '➡️ Next Step',
            value: content.callToAction,
            inline: false,
        });
    }

    embed.setFooter({
        text: 'Cyber Knights • Competitive TH18 Esports',
    });

    return embed;
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

        if (
            date &&
            time &&
            timezone
        ) {
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
