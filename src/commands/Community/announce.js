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
        emoji: '🏆',
        label: 'Tournament',
    },
    match: {
        emoji: '⚔️',
        label: 'Match',
    },
    team: {
        emoji: '📢',
        label: 'Team Update',
    },
    roster: {
        emoji: '👤',
        label: 'Roster',
    },
    practice: {
        emoji: '📅',
        label: 'Practice',
    },
    general: {
        emoji: '📣',
        label: 'General',
    },
};

const data = new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Create a professional Cyber Knights announcement')
    .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild.toString()
    )

    // REQUIRED OPTIONS
    .addStringOption(option =>
        option
            .setName('type')
            .setDescription('What type of announcement are you making?')
            .setRequired(true)
            .addChoices(
                { name: '🏆 Tournament', value: 'tournament' },
                { name: '⚔️ Match', value: 'match' },
                { name: '📢 Team Update', value: 'team' },
                { name: '👤 Roster', value: 'roster' },
                { name: '📅 Practice', value: 'practice' },
                { name: '📣 General', value: 'general' }
            )
    )
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('Where should the announcement be posted?')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(option =>
        option
            .setName('message')
            .setDescription('Briefly explain what you want to announce')
            .setRequired(true)
            .setMaxLength(2000)
    )

    // OPTIONAL OPTIONS
    .addRoleOption(option =>
        option
            .setName('role')
            .setDescription('Optional role to notify')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('date')
            .setDescription('Optional date, e.g. 2026-10-15')
            .setRequired(false)
            .setMaxLength(10)
    )
    .addStringOption(option =>
        option
            .setName('time')
            .setDescription('Optional time, e.g. 20:00')
            .setRequired(false)
            .setMaxLength(5)
    )
    .addStringOption(option =>
        option
            .setName('timezone')
            .setDescription('Optional timezone, e.g. Europe/London')
            .setRequired(false)
            .setMaxLength(50)
    )
    .addStringOption(option =>
        option
            .setName('link')
            .setDescription('Optional relevant link')
            .setRequired(false)
            .setMaxLength(500)
    )
    .addStringOption(option =>
        option
            .setName('format')
            .setDescription('Optional format, e.g. 5v5 TH18')
            .setRequired(false)
            .setMaxLength(100)
    )
    .addStringOption(option =>
        option
            .setName('prize')
            .setDescription('Optional prize information')
            .setRequired(false)
            .setMaxLength(100)
    );

function cleanText(text) {
    return text
        .trim()
        .replace(/\n{3,}/g, '\n\n');
}

function isValidTimezone(timezone) {
    try {
        Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
        }).format();

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

    const desiredUtc = Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute
    );

    const formatter = new Intl.DateTimeFormat(
        'en-US',
        {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }
    );

    let timestamp = desiredUtc;

    for (let i = 0; i < 3; i++) {
        const parts = formatter.formatToParts(
            new Date(timestamp)
        );

        const values = {};

        for (const part of parts) {
            if (part.type !== 'literal') {
                values[part.type] = Number(part.value);
            }
        }

        const representedUtc = Date.UTC(
            values.year,
            values.month - 1,
            values.day,
            values.hour,
            values.minute
        );

        const offset = representedUtc - timestamp;

        timestamp = desiredUtc - offset;
    }

    return Math.floor(timestamp / 1000);
}

function buildTimestamp(unix) {
    if (!Number.isFinite(unix)) {
        return null;
    }

    return `<t:${Math.floor(unix)}:F>\n<t:${Math.floor(unix)}:R>`;
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
    if (!process.env.OPENAI_API_KEY) {
        throw new Error(
            'OPENAI_API_KEY is not configured in Railway.'
        );
    }

    const typeConfig = TYPE_CONFIG[type];

    const response = await openai.responses.create({
        model:
            process.env.OPENAI_ANNOUNCE_MODEL ||
            'gpt-5.6-mini',

        instructions: `
You write announcements for Cyber Knights, a serious competitive TH18 Clash of Clans esports organisation.

Turn the manager's rough brief into a polished Discord announcement.

Style:
- Professional esports organisation.
- Clean, confident and concise.
- Premium rather than flashy.
- Easy to read on mobile.
- Use emojis sparingly.
- Do not invent information.
- Do not add facts that were not provided.
- Do not repeat information unnecessarily.
- Create a strong, specific headline.
- Cyber Knights is a competitive TH18 Clash of Clans organisation.

Announcement type:
${typeConfig.label}

The result will be placed inside a Discord embed.

Do not include:
- @everyone
- role mentions
- code blocks
- unnecessary divider lines
- an announcement heading
- a footer

Return structured data only.
        `,

        input: `
Manager's brief:

${cleanText(message)}

Additional information supplied by the manager:

${JSON.stringify(
    {
        date: date || null,
        time: time || null,
        timezone: timezone || null,
        link: link || null,
        format: format || null,
        prize: prize || null,
    },
    null,
    2
)}
        `,

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

    if (!response.output_text) {
        throw new Error(
            'OpenAI returned an empty response.'
        );
    }

    return JSON.parse(
        response.output_text
    );
}

function buildAnnouncementEmbed(
    type,
    announcement,
    timestamp,
    link
) {
    const config = TYPE_CONFIG[type];

    const embed = new EmbedBuilder()
        .setColor(ANNOUNCEMENT_COLOUR)
        .setAuthor({
            name: 'CYBER KNIGHTS',
        })
        .setTitle(
            `${config.emoji} ${announcement.title}`
        )
        .setDescription(
            cleanText(
                announcement.description
            )
        );

    if (
        Array.isArray(
            announcement.details
        )
    ) {
        const validDetails =
            announcement.details
                .filter(
                    detail =>
                        detail?.label &&
                        detail?.value
                )
                .slice(0, 6);

        if (validDetails.length > 0) {
            embed.addFields(
                validDetails.map(
                    detail => ({
                        name:
                            detail.label,
                        value:
                            detail.value,
                        inline: true,
                    })
                )
            );
        }
    }

    if (timestamp) {
        embed.addFields({
            name: '🕐 Time',
            value: timestamp,
            inline: false,
        });
    }

    if (
        announcement.callToAction
    ) {
        embed.addFields({
            name: '📌 Next Step',
            value: cleanText(
                announcement.callToAction
            ),
            inline: false,
        });
    }

    if (link) {
        embed.addFields({
            name: '🔗 Information',
            value:
                `[View More Information](${link})`,
            inline: false,
        });
    }

    embed.setFooter({
        text:
            'Cyber Knights • Competitive TH18 Esports',
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
        interaction.options.getString(
            'message',
            true
        );

    const role =
        interaction.options.getRole(
            'role'
        );

    const date =
        interaction.options.getString(
            'date'
        );

    const time =
        interaction.options.getString(
            'time'
        );

    const timezone =
        interaction.options.getString(
            'timezone'
        );

    const link =
        interaction.options.getString(
            'link'
        );

    const format =
        interaction.options.getString(
            'format'
        );

    const prize =
        interaction.options.getString(
            'prize'
        );

    if (!channel.isTextBased()) {
        return interaction.editReply({
            content:
                '❌ The selected channel cannot receive messages.',
        });
    }

    if (
        date &&
        time &&
        !timezone
    ) {
        return interaction.editReply({
            content:
                '❌ You provided a date and time, but no timezone.',
        });
    }

    if (
        timezone &&
        !isValidTimezone(timezone)
    ) {
        return interaction.editReply({
            content:
                `❌ **${timezone}** is not a recognised timezone.`,
        });
    }

    let timestamp = null;

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
                    '❌ I could not understand the date/time. Use date `YYYY-MM-DD` and time `HH:mm`.',
            });
        }

        timestamp =
            buildTimestamp(unix);
    }

    try {
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
            buildAnnouncementEmbed(
                type,
                announcement,
                timestamp,
                link
            );

        await channel.send({
            content: role
                ? `<@&${role.id}>`
                : undefined,

            embeds: [embed],

            allowedMentions: {
                roles: role
                    ? [role.id]
                    : [],
            },
        });

        return interaction.editReply({
            content:
                `✅ **Announcement published successfully.**\n\n📍 ${channel}`,
        });
    } catch (error) {
        console.error(
            '[ANNOUNCE] Failed:',
            error
        );

        return interaction.editReply({
            content:
                '❌ I could not generate the announcement. Check the Railway deployment logs for the exact error.',
        });
    }
}

export default {
    data,
    execute,
};
