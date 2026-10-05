import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
} from 'discord.js';

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
            .setDescription('Briefly describe what you want to announce')
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
            .setDescription('Optional link')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('format')
            .setDescription('Optional tournament/match format, e.g. 5v5 TH18')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('prize')
            .setDescription('Optional prize information')
            .setRequired(false)
    );

function cleanText(value) {
    if (!value) return null;

    const cleaned = String(value).trim();

    return cleaned.length > 0 ? cleaned : null;
}

function isValidTimezone(timezone) {
    if (!timezone) return false;

    try {
        Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
        });

        return true;
    } catch {
        return false;
    }
}

function convertDateTimeToUnix(date, time, timezone) {
    if (!date || !time || !timezone) {
        return null;
    }

    if (!isValidTimezone(timezone)) {
        return null;
    }

    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);

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

    /*
     * Build an initial UTC timestamp from the supplied local values.
     * We then determine the timezone offset at that point and adjust it.
     */
    const initialUtc = Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute
    );

    const formatter = new Intl.DateTimeFormat('en-CA', {
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
            values[part.type] = Number(part.value);
        }
    }

    const timezoneAsUtc = Date.UTC(
        values.year,
        values.month - 1,
        values.day,
        values.hour,
        values.minute
    );

    const offset = timezoneAsUtc - initialUtc;

    return Math.floor(
        (initialUtc - offset) / 1000
    );
}

function buildTimestamp(unix) {
    if (!unix || !Number.isFinite(Number(unix))) {
        return null;
    }

    const timestamp = Number(unix);

    return `<t:${timestamp}:F>\n<t:${timestamp}:R>`;
}

function safeJsonParse(value) {
    if (!value) {
        throw new Error(
            'OpenAI returned an empty response.'
        );
    }

    try {
        return JSON.parse(value);
    } catch {
        throw new Error(
            'OpenAI returned invalid JSON.'
        );
    }
}

async function generateAnnouncement({
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
        TYPE_CONFIG[type] || TYPE_CONFIG.general;

    const explicitDetails = {
        date: date || null,
        time: time || null,
        timezone: timezone || null,
        link: link || null,
        format: format || null,
        prize: prize || null,
    };

    const response = await openai.responses.create({
        model:
            process.env.OPENAI_ANNOUNCE_MODEL ||
            'gpt-4.1-mini',

        instructions: `
You are the announcement writer for Cyber Knights (CK), a serious competitive Clash of Clans TH18 esports organisation.

Your job is to turn a short, informal Discord instruction into a polished announcement.

The announcement must:
- Be concise and professional.
- Sound like a serious esports organisation.
- Be easy to scan on Discord.
- Avoid unnecessary hype or generic corporate language.
- Never invent facts.
- Never invent dates, times, players, teams, prizes, links, formats or other information.
- Only use information provided by the user.
- Preserve the meaning of the original message.
- Use clear esports terminology where appropriate.
- Avoid excessive emojis.
- Do not repeat information that will separately appear in the structured details.
- Do not mention that AI was used.
- Do not use Markdown headings inside the title or description.
- Do not use @everyone or @here.

Announcement type:
${config.label}

The user provided:
${message}

Additional explicit information:
${JSON.stringify(explicitDetails, null, 2)}

Return ONLY valid JSON matching the supplied schema.
        `.trim(),

        input: message,

        text: {
            format: {
                type: 'json_schema',
                name: 'cyber_knights_announcement',
                strict: true,
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        title: {
                            type: 'string',
                        },
                        description: {
                            type: 'string',
                        },
                        details: {
                            type: 'array',
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    label: {
                                        type: 'string',
                                    },
                                    value: {
                                        type: 'string',
                                    },
                                },
                                required: [
                                    'label',
                                    'value',
                                ],
                            },
                        },
                        callToAction: {
                            type: 'string',
                        },
                    },
                    required: [
                        'title',
                        'description',
                        'details',
                        'callToAction',
                    ],
                },
            },
        },
    });

    return safeJsonParse(
        response.output_text
    );
}

function buildAnnouncementEmbed({
    type,
    announcement,
    timestamp,
    link,
}) {
    const config =
        TYPE_CONFIG[type] || TYPE_CONFIG.general;

    const embed = new EmbedBuilder()
        .setColor(ANNOUNCEMENT_COLOUR)
        .setAuthor({
            name: 'CYBER KNIGHTS',
        })
        .setTitle(
            `${config.emoji} ${announcement.title}`
        )
        .setDescription(
            announcement.description
        );

    if (
        Array.isArray(announcement.details)
    ) {
        for (
            const detail of announcement.details.slice(0, 6)
        ) {
            if (
                !detail?.label ||
                !detail?.value
            ) {
                continue;
            }

            embed.addFields({
                name: detail.label,
                value: detail.value,
                inline: true,
            });
        }
    }

    if (timestamp) {
        embed.addFields({
            name: '📅 When',
            value: timestamp,
            inline: false,
        });
    }

    if (announcement.callToAction) {
        embed.addFields({
            name: '➡️ Next Step',
            value: announcement.callToAction,
            inline: false,
        });
    }

    if (link) {
        embed.addFields({
            name: '🔗 Link',
            value: `[Open Link](${link})`,
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

        if (timezone && !isValidTimezone(timezone)) {
            return interaction.editReply({
                content:
                    `❌ **${timezone}** is not a valid timezone.\n\nExample: \`Europe/London\`, \`Europe/Athens\`, or \`Asia/Kolkata\`.`,
            });
        }

        if (
            (date || time) &&
            (!date || !time || !timezone)
        ) {
            return interaction.editReply({
                content:
                    '❌ To add a scheduled time, please provide **date, time and timezone** together.',
            });
        }

        let timestamp = null;

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
                        '❌ I couldn’t understand that date/time combination.\n\nUse:\n`date: 2026-10-12`\n`time: 20:30`\n`timezone: Europe/London`',
                });
            }

            timestamp =
                buildTimestamp(unix);
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

        const announcement =
            await generateAnnouncement({
                type,
                message,
                date,
                time,
                timezone,
                link,
                format,
                prize,
            });

        const embed =
            buildAnnouncementEmbed({
                type,
                announcement,
                timestamp,
                link,
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

        let errorMessage =
            '❌ Something went wrong while creating the announcement.';

        if (
            error?.code ===
            'model_not_found'
        ) {
            errorMessage =
                '❌ The configured OpenAI model is not available to the API account.';
        } else if (
            error?.status === 401
        ) {
            errorMessage =
                '❌ The OpenAI API key is invalid or has expired.';
        } else if (
            error?.status === 429
        ) {
            errorMessage =
                '❌ The OpenAI API rate limit or usage limit was reached.';
        }

        return interaction.editReply({
            content: errorMessage,
        });
    }
}

export default {
    data,
    execute,
};
