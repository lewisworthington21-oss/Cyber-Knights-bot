import {
    SlashCommandBuilder,
    EmbedBuilder,
} from 'discord.js';


// ============================================================
// CYBER KNIGHTS — ANNOUNCEMENT DESIGN SYSTEM
// ============================================================

const CYBER_KNIGHTS_LOGO =
    'https://cdn.discordapp.com/attachments/1551328297055682692/1554627911926161469/FF973EB2-E985-4773-9333-D6D7DEB19C42.png?backend=b2&ex=6ac57c91&is=6ac42b11&hm=14e26b83ea58b8631ac8ff3b91fb829589b2bdb298e4c734f295a7df5ea518be';

const ANNOUNCEMENT_COLOUR = 0x2f80ed;

const FOOTER_TEXT =
    'Cyber Knights • Competitive TH18 Esports';

const AUTHOR_NAME =
    'CYBER KNIGHTS';


// ============================================================
// COMMAND
// ============================================================

const data = new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Create a professional Cyber Knights announcement')

    // Required options first
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
                    name: '🎯 Practice',
                    value: 'practice',
                },
                {
                    name: '👥 Roster',
                    value: 'roster',
                },
                {
                    name: '🛡️ Team',
                    value: 'team',
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
    )

    .addStringOption(option =>
        option
            .setName('message')
            .setDescription('Main announcement message')
            .setRequired(true)
            .setMaxLength(4000)
    )

    // Optional information
    .addRoleOption(option =>
        option
            .setName('role')
            .setDescription('Optional role to mention')
            .setRequired(false)
    )

    .addStringOption(option =>
        option
            .setName('date')
            .setDescription('Date in YYYY-MM-DD format')
            .setRequired(false)
    )

    .addStringOption(option =>
        option
            .setName('time')
            .setDescription('Time in HH:MM format')
            .setRequired(false)
    )

    .addStringOption(option =>
        option
            .setName('timezone')
            .setDescription('IANA timezone, e.g. Europe/London')
            .setRequired(false)
    )

    .addStringOption(option =>
        option
            .setName('link')
            .setDescription('Optional tournament, match or information link')
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


// ============================================================
// COMMON HELPERS
// ============================================================

function createBaseEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(ANNOUNCEMENT_COLOUR)

        // Permanent CK identity
        .setAuthor({
            name: AUTHOR_NAME,
            iconURL: CYBER_KNIGHTS_LOGO,
        })

        // CK logo on every announcement
        .setThumbnail(CYBER_KNIGHTS_LOGO)

        .setTitle(title)
        .setDescription(description)

        // Permanent CK footer
        .setFooter({
            text: FOOTER_TEXT,
        });
}


function addSpacer(embed) {
    embed.addFields({
        name: '\u200b',
        value: '\u200b',
        inline: false,
    });

    return embed;
}


function isValidTimezone(timezone) {
    if (!timezone) {
        return false;
    }

    try {
        Intl.DateTimeFormat('en-GB', {
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

    const match = time.match(/^(\d{2}):(\d{2})$/);

    if (!match) {
        return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null;
    }

    const dateMatch = date.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!dateMatch) {
        return null;
    }

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);

    const utcGuess = Date.UTC(
        year,
        month - 1,
        day,
        hours,
        minutes
    );

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

    let timestamp = utcGuess;

    for (let i = 0; i < 2; i++) {
        const parts = formatter.formatToParts(
            new Date(timestamp)
        );

        const values = {};

        for (const part of parts) {
            if (part.type !== 'literal') {
                values[part.type] = Number(part.value);
            }
        }

        const displayedUtc = Date.UTC(
            values.year,
            values.month - 1,
            values.day,
            values.hour,
            values.minute
        );

        const desiredUtc = Date.UTC(
            year,
            month - 1,
            day,
            hours,
            minutes
        );

        timestamp += desiredUtc - displayedUtc;
    }

    return Math.floor(timestamp / 1000);
}


function buildDiscordTimestamp(date, time, timezone) {
    const unix = convertDateTimeToUnix(
        date,
        time,
        timezone
    );

    if (!unix) {
        return null;
    }

    return `<t:${unix}:F>\n<t:${unix}:R>`;
}


function buildWhenField(date, time, timezone) {
    const timestamp = buildDiscordTimestamp(
        date,
        time,
        timezone
    );

    if (timestamp) {
        return timestamp;
    }

    return 'Time TBC';
}


function addLinkField(embed, link) {
    if (!link) {
        return;
    }

    embed.addFields({
        name: '🔗 INFORMATION',
        value: `[View More Information](${link})`,
        inline: false,
    });
}


function addScheduleField(
    embed,
    date,
    time,
    timezone
) {
    if (!date && !time && !timezone) {
        return;
    }

    embed.addFields({
        name: '📅 WHEN',
        value: buildWhenField(
            date,
            time,
            timezone
        ),
        inline: false,
    });
}


// ============================================================
// TOURNAMENT
// ============================================================

function buildTournamentEmbed({
    message,
    date,
    time,
    timezone,
    link,
    format,
    prize,
}) {
    const embed = createBaseEmbed(
        '🏆 TOURNAMENT UPDATE',
        message
    );

    addSpacer(embed);

    if (format) {
        embed.addFields({
            name: 'FORMAT',
            value: format,
            inline: true,
        });
    }

    if (prize) {
        embed.addFields({
            name: 'PRIZE',
            value: prize,
            inline: true,
        });
    }

    addScheduleField(
        embed,
        date,
        time,
        timezone
    );

    if (link) {
        addSpacer(embed);
        addLinkField(embed, link);
    }

    return embed;
}


// ============================================================
// MATCH
// ============================================================

function buildMatchEmbed({
    message,
    date,
    time,
    timezone,
    link,
    format,
}) {
    const embed = createBaseEmbed(
        '⚔️ MATCH UPDATE',
        message
    );

    addSpacer(embed);

    if (format) {
        embed.addFields({
            name: 'FORMAT',
            value: format,
            inline: true,
        });
    }

    addScheduleField(
        embed,
        date,
        time,
        timezone
    );

    addSpacer(embed);

    embed.addFields({
        name: '🎯 TEAM PREPARATION',
        value:
            'Main lineup players should be available and ready to prepare before the match.',
        inline: false,
    });

    if (link) {
        addSpacer(embed);
        addLinkField(embed, link);
    }

    return embed;
}


// ============================================================
// PRACTICE
// ============================================================

function buildPracticeEmbed({
    message,
    date,
    time,
    timezone,
    link,
    format,
}) {
    const embed = createBaseEmbed(
        '🎯 PRACTICE SESSION',
        message
    );

    addSpacer(embed);

    addScheduleField(
        embed,
        date,
        time,
        timezone
    );

    if (format) {
        embed.addFields({
            name: 'FORMAT',
            value: format,
            inline: true,
        });
    }

    addSpacer(embed);

    embed.addFields({
        name: '⚔️ PREPARATION',
        value:
            'Players attending should be ready to practice and communicate with the team.',
        inline: false,
    });

    if (link) {
        addSpacer(embed);
        addLinkField(embed, link);
    }

    return embed;
}


// ============================================================
// ROSTER
// ============================================================

function buildRosterEmbed({
    message,
    link,
}) {
    const embed = createBaseEmbed(
        '👥 ROSTER UPDATE',
        message
    );

    addSpacer(embed);

    embed.addFields({
        name: '📌 CYBER KNIGHTS ROSTER',
        value:
            'Please make sure you are aware of your current team position and responsibilities.',
        inline: false,
    });

    if (link) {
        addSpacer(embed);
        addLinkField(embed, link);
    }

    return embed;
}


// ============================================================
// TEAM
// ============================================================

function buildTeamEmbed({
    message,
    link,
}) {
    const embed = createBaseEmbed(
        '🛡️ TEAM UPDATE',
        message
    );

    addSpacer(embed);

    embed.addFields({
        name: '📌 CYBER KNIGHTS',
        value:
            'Please make sure all relevant team members have seen and understood this update.',
        inline: false,
    });

    if (link) {
        addSpacer(embed);
        addLinkField(embed, link);
    }

    return embed;
}


// ============================================================
// GENERAL
// ============================================================

function buildGeneralEmbed({
    message,
    link,
}) {
    const embed = createBaseEmbed(
        '📢 CYBER KNIGHTS UPDATE',
        message
    );

    if (link) {
        addSpacer(embed);
        addLinkField(embed, link);
    }

    return embed;
}


// ============================================================
// EMBED SELECTOR
// ============================================================

function buildAnnouncementEmbed(options) {
    switch (options.type) {
        case 'tournament':
            return buildTournamentEmbed(options);

        case 'match':
            return buildMatchEmbed(options);

        case 'practice':
            return buildPracticeEmbed(options);

        case 'roster':
            return buildRosterEmbed(options);

        case 'team':
            return buildTeamEmbed(options);

        case 'general':
            return buildGeneralEmbed(options);

        default:
            return buildGeneralEmbed(options);
    }
}


// ============================================================
// COMMAND EXECUTION
// ============================================================

async function execute(interaction) {
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
        interaction.options.getRole('role');

    const date =
        interaction.options.getString('date');

    const time =
        interaction.options.getString('time');

    const timezone =
        interaction.options.getString('timezone');

    const link =
        interaction.options.getString('link');

    const format =
        interaction.options.getString('format');

    const prize =
        interaction.options.getString('prize');


    // --------------------------------------------------------
    // CHANNEL VALIDATION
    // --------------------------------------------------------

    if (!channel.isTextBased()) {
        return interaction.reply({
            content:
                '❌ The selected channel is not a text-based channel.',
            ephemeral: true,
        });
    }


    // --------------------------------------------------------
    // DATE / TIME VALIDATION
    // --------------------------------------------------------

    const schedulingProvided =
        date ||
        time ||
        timezone;

    if (schedulingProvided) {
        if (!date || !time || !timezone) {
            return interaction.reply({
                content:
                    '❌ If you provide a date or time, you must provide **date, time and timezone** together.',
                ephemeral: true,
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return interaction.reply({
                content:
                    '❌ Invalid date format. Use **YYYY-MM-DD**.\nExample: `2026-10-12`',
                ephemeral: true,
            });
        }

        if (!/^\d{2}:\d{2}$/.test(time)) {
            return interaction.reply({
                content:
                    '❌ Invalid time format. Use **HH:MM**.\nExample: `20:30`',
                ephemeral: true,
            });
        }

        if (!isValidTimezone(timezone)) {
            return interaction.reply({
                content:
                    '❌ Invalid timezone.\n\nUse an IANA timezone such as `Europe/London`, `Europe/Athens` or `Asia/Kolkata`.',
                ephemeral: true,
            });
        }

        const unix = convertDateTimeToUnix(
            date,
            time,
            timezone
        );

        if (!unix) {
            return interaction.reply({
                content:
                    '❌ I could not convert that date and time. Please check your values.',
                ephemeral: true,
            });
        }
    }


    // --------------------------------------------------------
    // LINK VALIDATION
    // --------------------------------------------------------

    if (link) {
        try {
            const parsedUrl = new URL(link);

            if (
                parsedUrl.protocol !== 'http:' &&
                parsedUrl.protocol !== 'https:'
            ) {
                throw new Error();
            }
        } catch {
            return interaction.reply({
                content:
                    '❌ Invalid link. Please provide a full `https://` or `http://` URL.',
                ephemeral: true,
            });
        }
    }


    // --------------------------------------------------------
    // BUILD EMBED
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // ROLE MENTION
    // --------------------------------------------------------

    let content;

    if (role) {
        content = `${role}`;
    }


    // --------------------------------------------------------
    // SEND ANNOUNCEMENT
    // --------------------------------------------------------

    try {
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
    } catch (error) {
        console.error(
            'Announcement send error:',
            error
        );

        return interaction.reply({
            content:
                '❌ I could not send the announcement. Make sure I have **View Channel**, **Send Messages** and **Embed Links** permissions in that channel.',
            ephemeral: true,
        });
    }


    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    return interaction.reply({
        content:
            `✅ **${type.charAt(0).toUpperCase() + type.slice(1)} announcement posted.**\n\n📍 ${channel}`,
        ephemeral: true,
    });
}


// ============================================================
// EXPORT
// ============================================================

export default {
    data,
    execute,
};
