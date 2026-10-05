import {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

const TOURNAMENTS_KEY = (guildId) => `guild:${guildId}:tournaments`;

const STATUS = {
    UPCOMING: 'upcoming',
    LIVE: 'live',
    COMPLETED: 'completed',
};

const STATUS_META = {
    upcoming: {
        label: 'UPCOMING',
        emoji: '🟡',
    },
    live: {
        label: 'LIVE',
        emoji: '🟢',
    },
    completed: {
        label: 'COMPLETED',
        emoji: '⚪',
    },
};

const DEFAULT_TIMEZONE = 'Europe/London';

/* -------------------------------------------------------------------------- */
/*                              DATE / TIME HELPERS                           */
/* -------------------------------------------------------------------------- */

const MONTHS = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sep: 9,
    sept: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
};

/**
 * Parses common date formats:
 *
 * 2026-10-08
 * 08/10/2026
 * 8 October 2026
 * 8 Oct 2026
 */
function parseDateInput(input) {
    if (!input || typeof input !== 'string') {
        return null;
    }

    const value = input.trim();

    // YYYY-MM-DD
    let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);

        if (isValidDateParts(year, month, day)) {
            return { year, month, day };
        }

        return null;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);

        if (isValidDateParts(year, month, day)) {
            return { year, month, day };
        }

        return null;
    }

    // 8 October 2026 / 8 Oct 2026
    match = value.match(
        /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/
    );

    if (match) {
        const day = Number(match[1]);
        const monthName = match[2].toLowerCase();
        const year = Number(match[3]);

        const month = MONTHS[monthName];

        if (month && isValidDateParts(year, month, day)) {
            return { year, month, day };
        }

        return null;
    }

    return null;
}

function isValidDateParts(year, month, day) {
    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day)
    ) {
        return false;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return false;
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

/**
 * Parses:
 *
 * 18:00
 * 18:30:00
 * 6:00 PM
 * 6:30pm
 */
function parseTimeInput(input) {
    if (!input || typeof input !== 'string') {
        return null;
    }

    const value = input.trim().toUpperCase();

    const match = value.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/
    );

    if (!match) {
        return null;
    }

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = match[3] ? Number(match[3]) : 0;
    const meridiem = match[4];

    if (minute > 59 || second > 59) {
        return null;
    }

    if (meridiem) {
        if (hour < 1 || hour > 12) {
            return null;
        }

        if (meridiem === 'AM') {
            if (hour === 12) hour = 0;
        } else if (meridiem === 'PM') {
            if (hour !== 12) hour += 12;
        }
    } else {
        if (hour > 23) {
            return null;
        }
    }

    return {
        hour,
        minute,
        second,
    };
}

function isValidTimeZone(timeZone) {
    try {
        new Intl.DateTimeFormat('en-US', {
            timeZone,
        }).format();

        return true;
    } catch {
        return false;
    }
}

/**
 * Gets the date/time parts for a timestamp in a particular timezone.
 */
function getZonedParts(timestampMs, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(new Date(timestampMs));

    const result = {};

    for (const part of parts) {
        if (part.type !== 'literal') {
            result[part.type] = Number(part.value);
        }
    }

    return result;
}

/**
 * Finds the timezone offset at a particular instant.
 */
function getTimeZoneOffsetMs(timestampMs, timeZone) {
    const parts = getZonedParts(timestampMs, timeZone);

    const asUTC = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
    );

    return asUTC - timestampMs;
}

/**
 * Converts a local date/time in an IANA timezone to a Unix timestamp.
 *
 * Example:
 *
 * 2026-10-08
 * 18:00
 * Europe/London
 *
 * -> Unix timestamp
 */
function zonedDateTimeToUnix(dateInput, timeInput, timeZone) {
    const dateParts = parseDateInput(dateInput);
    const timeParts = parseTimeInput(timeInput);

    if (!dateParts) {
        throw new Error(
            'Invalid date. Use `2026-10-08`, `08/10/2026`, or `8 October 2026`.'
        );
    }

    if (!timeParts) {
        throw new Error(
            'Invalid time. Use `18:00`, `18:30`, or `6:00 PM`.'
        );
    }

    if (!isValidTimeZone(timeZone)) {
        throw new Error(
            `Invalid timezone. \`${timeZone}\` is not a valid IANA timezone.`
        );
    }

    const naiveUtcMs = Date.UTC(
        dateParts.year,
        dateParts.month - 1,
        dateParts.day,
        timeParts.hour,
        timeParts.minute,
        timeParts.second
    );

    let utcMs = naiveUtcMs;

    // A couple of iterations handles normal timezone/DST offsets.
    for (let i = 0; i < 4; i++) {
        const offset = getTimeZoneOffsetMs(utcMs, timeZone);
        const nextUtcMs = naiveUtcMs - offset;

        if (nextUtcMs === utcMs) {
            break;
        }

        utcMs = nextUtcMs;
    }

    return Math.floor(utcMs / 1000);
}

/* -------------------------------------------------------------------------- */
/*                              GENERAL HELPERS                               */
/* -------------------------------------------------------------------------- */

function generateTournamentId() {
    return Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
}

function getStatusMeta(status) {
    return (
        STATUS_META[status] || {
            label: status?.toUpperCase() || 'UNKNOWN',
            emoji: '❔',
        }
    );
}

function truncate(text, maxLength) {
    if (!text) return '';

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.substring(0, maxLength - 3)}...`;
}

function validateUrl(input) {
    if (!input) return null;

    try {
        const url = new URL(input);

        if (!['http:', 'https:'].includes(url.protocol)) {
            return null;
        }

        return url.toString();
    } catch {
        return null;
    }
}

function normalizeTournament(tournament) {
    return {
        id: tournament.id || generateTournamentId(),
        name: tournament.name || 'Unnamed Tournament',
        status: tournament.status || STATUS.UPCOMING,

        date: tournament.date || null,
        time: tournament.time || null,
        timezone: tournament.timezone || DEFAULT_TIMEZONE,

        startAt: tournament.startAt || null,

        description: tournament.description || null,
        logo: tournament.logo || null,
        link: tournament.link || null,

        createdAt: tournament.createdAt || Date.now(),
        createdBy: tournament.createdBy || null,
        updatedAt: tournament.updatedAt || tournament.createdAt || Date.now(),
    };
}

async function getTournaments(client, guildId) {
    const tournaments = await client.db.get(
        TOURNAMENTS_KEY(guildId),
        []
    );

    if (!Array.isArray(tournaments)) {
        return [];
    }

    return tournaments.map(normalizeTournament);
}

async function saveTournaments(client, guildId, tournaments) {
    await client.db.set(
        TOURNAMENTS_KEY(guildId),
        tournaments
    );
}

function sortTournaments(tournaments) {
    const statusOrder = {
        live: 0,
        upcoming: 1,
        completed: 2,
    };

    return [...tournaments].sort((a, b) => {
        const statusDifference =
            (statusOrder[a.status] ?? 99) -
            (statusOrder[b.status] ?? 99);

        if (statusDifference !== 0) {
            return statusDifference;
        }

        // Upcoming/live tournaments with a known start time
        if (a.startAt && b.startAt) {
            if (a.status === STATUS.COMPLETED) {
                return b.startAt - a.startAt;
            }

            return a.startAt - b.startAt;
        }

        if (a.startAt) return -1;
        if (b.startAt) return 1;

        return a.name.localeCompare(b.name);
    });
}

function getTournamentTimeText(tournament) {
    if (!tournament.startAt) {
        if (tournament.date) {
            return `🗓️ **Date:** ${tournament.date}`;
        }

        return '🗓️ **Date:** TBC';
    }

    const timestamp = Math.floor(
        Number(tournament.startAt)
    );

    if (!Number.isFinite(timestamp)) {
        return tournament.date
            ? `🗓️ **Date:** ${tournament.date}`
            : '🗓️ **Date:** TBC';
    }

    if (tournament.status === STATUS.UPCOMING) {
        return [
            `🗓️ **Starts:** <t:${timestamp}:F>`,
            `⏳ **Countdown:** <t:${timestamp}:R>`,
        ].join('\n');
    }

    if (tournament.status === STATUS.LIVE) {
        return [
            `🗓️ **Started:** <t:${timestamp}:F>`,
            `⏱️ **Running:** <t:${timestamp}:R>`,
        ].join('\n');
    }

    return [
        `🗓️ **Started:** <t:${timestamp}:F>`,
        `⌛ **Finished:** <t:${timestamp}:R>`,
    ].join('\n');
}

function buildTournamentField(tournament) {
    const meta = getStatusMeta(tournament.status);

    const lines = [
        `${getTournamentTimeText(tournament)}`,
        '',
    ];

    if (tournament.description) {
        lines.push(
            truncate(tournament.description, 700),
            ''
        );
    }

    if (tournament.link) {
        lines.push(
            `🔗 [Tournament Page](${tournament.link})`
        );
    }

    if (tournament.logo) {
        lines.push(
            `🖼️ [Tournament Logo](${tournament.logo})`
        );
    }

    lines.push(
        `\n🆔 ID: \`${tournament.id}\``
    );

    return {
        name: `${meta.emoji} ${tournament.name}`,
        value: lines.join('\n'),
        inline: false,
    };
}

function buildListEmbed(tournaments) {
    const sorted = sortTournaments(tournaments);

    const liveCount = sorted.filter(
        (tournament) => tournament.status === STATUS.LIVE
    ).length;

    const upcomingCount = sorted.filter(
        (tournament) => tournament.status === STATUS.UPCOMING
    ).length;

    const completedCount = sorted.filter(
        (tournament) => tournament.status === STATUS.COMPLETED
    ).length;

    const embed = new EmbedBuilder()
        .setTitle('🏆 Cyber Knights Tournament Hub')
        .setDescription(
            [
                `🟢 **${liveCount} Live**  •  🟡 **${upcomingCount} Upcoming**  •  ⚪ **${completedCount} Completed**`,
                '',
                'Times are automatically displayed in your local timezone.',
            ].join('\n')
        )
        .setFooter({
            text: 'Cyber Knights • Tournament Hub',
        });

    if (sorted.length === 0) {
        embed.setDescription(
            [
                'There are currently no tournaments listed.',
                '',
                'Use `/tournaments add` to add the next tournament.',
            ].join('\n')
        );

        return embed;
    }

    // Discord allows a maximum of 25 fields per embed.
    // We keep the display comfortably below that limit.
    const displayTournaments = sorted.slice(0, 20);

    embed.addFields(
        displayTournaments.map(buildTournamentField)
    );

    if (sorted.length > displayTournaments.length) {
        embed.addFields({
            name: '📌 More Tournaments',
            value: `There are ${sorted.length - displayTournaments.length} additional tournaments not shown here.`,
            inline: false,
        });
    }

    return embed;
}

/* -------------------------------------------------------------------------- */
/*                              COMMAND DEFINITION                            */
/* -------------------------------------------------------------------------- */

export const data = new SlashCommandBuilder()
    .setName('tournaments')
    .setDescription('Manage the Cyber Knights tournament hub')

    // LIST
    .addSubcommand((subcommand) =>
        subcommand
            .setName('list')
            .setDescription('View all Cyber Knights tournaments')
    )

    // ADD
    .addSubcommand((subcommand) =>
        subcommand
            .setName('add')
            .setDescription('Add a tournament to the tournament hub')
            .addStringOption((option) =>
                option
                    .setName('name')
                    .setDescription('Tournament name')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .addStringOption((option) =>
                option
                    .setName('status')
                    .setDescription('Tournament status')
                    .setRequired(true)
                    .addChoices(
                        {
                            name: 'Upcoming',
                            value: STATUS.UPCOMING,
                        },
                        {
                            name: 'Live',
                            value: STATUS.LIVE,
                        },
                        {
                            name: 'Completed',
                            value: STATUS.COMPLETED,
                        }
                    )
            )
            .addStringOption((option) =>
                option
                    .setName('date')
                    .setDescription(
                        'Date e.g. 2026-10-08 or 8 October 2026'
                    )
                    .setRequired(false)
                    .setMaxLength(50)
            )
            .addStringOption((option) =>
                option
                    .setName('time')
                    .setDescription(
                        'Start time e.g. 18:00 or 6:00 PM'
                    )
                    .setRequired(false)
                    .setMaxLength(20)
            )
            .addStringOption((option) =>
                option
                    .setName('timezone')
                    .setDescription(
                        'IANA timezone e.g. Europe/London'
                    )
                    .setRequired(false)
                    .setMaxLength(50)
            )
            .addStringOption((option) =>
                option
                    .setName('description')
                    .setDescription('Short tournament description')
                    .setRequired(false)
                    .setMaxLength(1000)
            )
            .addStringOption((option) =>
                option
                    .setName('logo')
                    .setDescription('Tournament logo/image URL')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .addStringOption((option) =>
                option
                    .setName('link')
                    .setDescription('Official tournament page URL')
                    .setRequired(false)
                    .setMaxLength(500)
            )
    )

    // EDIT
    .addSubcommand((subcommand) =>
        subcommand
            .setName('edit')
            .setDescription('Edit an existing tournament')
            .addStringOption((option) =>
                option
                    .setName('id')
                    .setDescription('Tournament ID')
                    .setRequired(true)
                    .setMaxLength(20)
            )
            .addStringOption((option) =>
                option
                    .setName('name')
                    .setDescription('New tournament name')
                    .setRequired(false)
                    .setMaxLength(100)
            )
            .addStringOption((option) =>
                option
                    .setName('status')
                    .setDescription('New tournament status')
                    .setRequired(false)
                    .addChoices(
                        {
                            name: 'Upcoming',
                            value: STATUS.UPCOMING,
                        },
                        {
                            name: 'Live',
                            value: STATUS.LIVE,
                        },
                        {
                            name: 'Completed',
                            value: STATUS.COMPLETED,
                        }
                    )
            )
            .addStringOption((option) =>
                option
                    .setName('date')
                    .setDescription(
                        'New date e.g. 2026-10-08'
                    )
                    .setRequired(false)
                    .setMaxLength(50)
            )
            .addStringOption((option) =>
                option
                    .setName('time')
                    .setDescription(
                        'New start time e.g. 18:00'
                    )
                    .setRequired(false)
                    .setMaxLength(20)
            )
            .addStringOption((option) =>
                option
                    .setName('timezone')
                    .setDescription(
                        'New timezone e.g. Europe/London'
                    )
                    .setRequired(false)
                    .setMaxLength(50)
            )
            .addStringOption((option) =>
                option
                    .setName('description')
                    .setDescription('New description')
                    .setRequired(false)
                    .setMaxLength(1000)
            )
            .addStringOption((option) =>
                option
                    .setName('logo')
                    .setDescription('New tournament logo URL')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .addStringOption((option) =>
                option
                    .setName('link')
                    .setDescription('New tournament page URL')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .addBooleanOption((option) =>
                option
                    .setName('clear_time')
                    .setDescription(
                        'Remove the exact start time and countdown'
                    )
                    .setRequired(false)
            )
    )

    // REMOVE
    .addSubcommand((subcommand) =>
        subcommand
            .setName('remove')
            .setDescription('Remove a tournament')
            .addStringOption((option) =>
                option
                    .setName('id')
                    .setDescription('Tournament ID')
                    .setRequired(true)
                    .setMaxLength(20)
            )
    )

    // COMPLETE
    .addSubcommand((subcommand) =>
        subcommand
            .setName('complete')
            .setDescription('Mark a tournament as completed')
            .addStringOption((option) =>
                option
                    .setName('id')
                    .setDescription('Tournament ID')
                    .setRequired(true)
                    .setMaxLength(20)
            )
    )

    // LIVE
    .addSubcommand((subcommand) =>
        subcommand
            .setName('live')
            .setDescription('Mark a tournament as live')
            .addStringOption((option) =>
                option
                    .setName('id')
                    .setDescription('Tournament ID')
                    .setRequired(true)
                    .setMaxLength(20)
            )
    )

    // UPCOMING
    .addSubcommand((subcommand) =>
        subcommand
            .setName('upcoming')
            .setDescription('Mark a tournament as upcoming')
            .addStringOption((option) =>
                option
                    .setName('id')
                    .setDescription('Tournament ID')
                    .setRequired(true)
                    .setMaxLength(20)
            )
    );

/* -------------------------------------------------------------------------- */
/*                               COMMAND EXECUTION                            */
/* -------------------------------------------------------------------------- */

export async function execute(interaction) {
    const { client } = interaction;
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({
            content: 'This command can only be used inside a server.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
        /* ------------------------------------------------------------------ */
        /*                                 LIST                               */
        /* ------------------------------------------------------------------ */

        if (subcommand === 'list') {
            const tournaments = await getTournaments(
                client,
                guildId
            );

            return interaction.reply({
                embeds: [buildListEmbed(tournaments)],
                allowedMentions: {
                    parse: [],
                },
            });
        }

        /* ------------------------------------------------------------------ */
        /*                         MANAGEMENT PERMISSION                      */
        /* ------------------------------------------------------------------ */

        const member = interaction.member;

        if (
            !member?.permissions?.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return interaction.reply({
                content:
                    '❌ You need the **Manage Server** permission to manage tournaments.',
                flags: MessageFlags.Ephemeral,
            });
        }

        /* ------------------------------------------------------------------ */
        /*                                  ADD                               */
        /* ------------------------------------------------------------------ */

        if (subcommand === 'add') {
            const name = interaction.options.getString('name', true);
            const status = interaction.options.getString(
                'status',
                true
            );

            const date =
                interaction.options.getString('date') || null;

            const time =
                interaction.options.getString('time') || null;

            const timezone =
                interaction.options.getString('timezone') ||
                DEFAULT_TIMEZONE;

            const description =
                interaction.options.getString('description') ||
                null;

            const logo =
                interaction.options.getString('logo') || null;

            const linkInput =
                interaction.options.getString('link') || null;

            let startAt = null;

            if (time && !date) {
                return interaction.reply({
                    content:
                        '❌ You provided a start time but no date. Please provide both `date` and `time`.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (date && time) {
                try {
                    startAt = zonedDateTimeToUnix(
                        date,
                        time,
                        timezone
                    );
                } catch (error) {
                    return interaction.reply({
                        content: `❌ ${error.message}`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } else if (!isValidTimeZone(timezone)) {
                return interaction.reply({
                    content: `❌ Invalid timezone: \`${timezone}\``,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const validatedLogo = logo
                ? validateUrl(logo)
                : null;

            if (logo && !validatedLogo) {
                return interaction.reply({
                    content:
                        '❌ The logo must be a valid `http://` or `https://` URL.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const validatedLink = linkInput
                ? validateUrl(linkInput)
                : null;

            if (linkInput && !validatedLink) {
                return interaction.reply({
                    content:
                        '❌ The tournament link must be a valid `http://` or `https://` URL.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const tournaments = await getTournaments(
                client,
                guildId
            );

            const tournament = {
                id: generateTournamentId(),
                name,
                status,
                date,
                time,
                timezone,
                startAt,
                description,
                logo: validatedLogo,
                link: validatedLink,
                createdAt: Date.now(),
                createdBy: interaction.user.id,
                updatedAt: Date.now(),
            };

            tournaments.push(tournament);

            await saveTournaments(
                client,
                guildId,
                tournaments
            );

            const meta = getStatusMeta(status);

            const embed = new EmbedBuilder()
                .setTitle('🏆 Tournament Added')
                .setDescription(
                    `${meta.emoji} **${name}** has been added to the Cyber Knights tournament hub.`
                )
                .addFields(
                    {
                        name: 'Status',
                        value: `${meta.emoji} ${meta.label}`,
                        inline: true,
                    },
                    {
                        name: 'Tournament ID',
                        value: `\`${tournament.id}\``,
                        inline: true,
                    },
                    {
                        name: 'Schedule',
                        value: getTournamentTimeText(tournament),
                        inline: false,
                    }
                )
                .setFooter({
                    text: 'Cyber Knights • Tournament Hub',
                });

            if (description) {
                embed.addFields({
                    name: 'Description',
                    value: truncate(description, 1000),
                    inline: false,
                });
            }

            if (validatedLogo) {
                embed.setThumbnail(validatedLogo);
            }

            if (validatedLink) {
                embed.addFields({
                    name: 'Tournament Page',
                    value: `[Open Tournament Page](${validatedLink})`,
                    inline: false,
                });
            }

            return interaction.reply({
                embeds: [embed],
                allowedMentions: {
                    parse: [],
                },
            });
        }

        /* ------------------------------------------------------------------ */
        /*                                 EDIT                               */
        /* ------------------------------------------------------------------ */

        if (subcommand === 'edit') {
            const id = interaction.options.getString(
                'id',
                true
            );

            const tournaments = await getTournaments(
                client,
                guildId
            );

            const index = tournaments.findIndex(
                (tournament) =>
                    tournament.id.toLowerCase() ===
                    id.toLowerCase()
            );

            if (index === -1) {
                return interaction.reply({
                    content: `❌ No tournament was found with ID \`${id}\`.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const tournament = tournaments[index];

            const name =
                interaction.options.getString('name');

            const status =
                interaction.options.getString('status');

            const date =
                interaction.options.getString('date');

            const time =
                interaction.options.getString('time');

            const timezone =
                interaction.options.getString('timezone');

            const description =
                interaction.options.getString('description');

            const logo =
                interaction.options.getString('logo');

            const link =
                interaction.options.getString('link');

            const clearTime =
                interaction.options.getBoolean('clear_time') ||
                false;

            if (name !== null) {
                tournament.name = name;
            }

            if (status !== null) {
                tournament.status = status;
            }

            if (date !== null) {
                tournament.date = date;
            }

            if (timezone !== null) {
                tournament.timezone = timezone;
            }

            if (description !== null) {
                tournament.description = description;
            }

            if (clearTime) {
                tournament.time = null;
                tournament.startAt = null;
            } else if (time !== null) {
                tournament.time = time;
            }

            if (logo !== null) {
                const validatedLogo = validateUrl(logo);

                if (!validatedLogo) {
                    return interaction.reply({
                        content:
                            '❌ The logo must be a valid `http://` or `https://` URL.',
                        flags: MessageFlags.Ephemeral,
                    });
                }

                tournament.logo = validatedLogo;
            }

            if (link !== null) {
                const validatedLink = validateUrl(link);

                if (!validatedLink) {
                    return interaction.reply({
                        content:
                            '❌ The tournament link must be a valid `http://` or `https://` URL.',
                        flags: MessageFlags.Ephemeral,
                    });
                }

                tournament.link = validatedLink;
            }

            /*
             * Recalculate the Unix timestamp whenever date,
             * time or timezone changes.
             */
            if (!clearTime) {
                if (
                    tournament.date &&
                    tournament.time
                ) {
                    try {
                        tournament.startAt =
                            zonedDateTimeToUnix(
                                tournament.date,
                                tournament.time,
                                tournament.timezone ||
                                    DEFAULT_TIMEZONE
                            );
                    } catch (error) {
                        return interaction.reply({
                            content: `❌ ${error.message}`,
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                } else {
                    tournament.startAt = null;
                }
            }

            tournament.updatedAt = Date.now();

            tournaments[index] = tournament;

            await saveTournaments(
                client,
                guildId,
                tournaments
            );

            const meta = getStatusMeta(
                tournament.status
            );

            const embed = new EmbedBuilder()
                .setTitle('✏️ Tournament Updated')
                .setDescription(
                    `${meta.emoji} **${tournament.name}** has been updated.`
                )
                .addFields(
                    {
                        name: 'Status',
                        value: `${meta.emoji} ${meta.label}`,
                        inline: true,
                    },
                    {
                        name: 'Tournament ID',
                        value: `\`${tournament.id}\``,
                        inline: true,
                    },
                    {
                        name: 'Schedule',
                        value: getTournamentTimeText(
                            tournament
                        ),
                        inline: false,
                    }
                )
                .setFooter({
                    text: 'Cyber Knights • Tournament Hub',
                });

            if (tournament.description) {
                embed.addFields({
                    name: 'Description',
                    value: truncate(
                        tournament.description,
                        1000
                    ),
                    inline: false,
                });
            }

            if (tournament.logo) {
                embed.setThumbnail(
                    tournament.logo
                );
            }

            return interaction.reply({
                embeds: [embed],
                allowedMentions: {
                    parse: [],
                },
            });
        }

        /* ------------------------------------------------------------------ */
        /*                                REMOVE                              */
        /* ------------------------------------------------------------------ */

        if (subcommand === 'remove') {
            const id = interaction.options.getString(
                'id',
                true
            );

            const tournaments = await getTournaments(
                client,
                guildId
            );

            const index = tournaments.findIndex(
                (tournament) =>
                    tournament.id.toLowerCase() ===
                    id.toLowerCase()
            );

            if (index === -1) {
                return interaction.reply({
                    content: `❌ No tournament was found with ID \`${id}\`.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const [removed] =
                tournaments.splice(index, 1);

            await saveTournaments(
                client,
                guildId,
                tournaments
            );

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🗑️ Tournament Removed')
                        .setDescription(
                            `**${removed.name}** has been removed from the tournament hub.`
                        )
                        .setFooter({
                            text: `Tournament ID: ${removed.id}`,
                        }),
                ],
                allowedMentions: {
                    parse: [],
                },
            });
        }

        /* ------------------------------------------------------------------ */
        /*                            STATUS CHANGES                           */
        /* ------------------------------------------------------------------ */

        if (
            subcommand === 'complete' ||
            subcommand === 'live' ||
            subcommand === 'upcoming'
        ) {
            const id = interaction.options.getString(
                'id',
                true
            );

            const tournaments = await getTournaments(
                client,
                guildId
            );

            const index = tournaments.findIndex(
                (tournament) =>
                    tournament.id.toLowerCase() ===
                    id.toLowerCase()
            );

            if (index === -1) {
                return interaction.reply({
                    content: `❌ No tournament was found with ID \`${id}\`.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const statusMap = {
                complete: STATUS.COMPLETED,
                live: STATUS.LIVE,
                upcoming: STATUS.UPCOMING,
            };

            const newStatus =
                statusMap[subcommand];

            tournaments[index].status =
                newStatus;

            tournaments[index].updatedAt =
                Date.now();

            await saveTournaments(
                client,
                guildId,
                tournaments
            );

            const tournament =
                tournaments[index];

            const meta =
                getStatusMeta(newStatus);

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        `${meta.emoji} Tournament Status Updated`
                    )
                    .setDescription(
                        `**${tournament.name}** is now marked as **${meta.label}**.`
                    )
                    .addFields({
                        name: 'Tournament ID',
                        value: `\`${tournament.id}\``,
                        inline: true,
                    })
                    .setFooter({
                        text: 'Cyber Knights • Tournament Hub',
                    });

            return interaction.reply({
                embeds: [embed],
                allowedMentions: {
                    parse: [],
                },
            });
        }

        return interaction.reply({
            content:
                '❌ Unknown tournament command.',
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error(
            '[TOURNAMENTS] Command error:',
            error
        );

        if (interaction.replied || interaction.deferred) {
            return interaction.followUp({
                content:
                    '❌ Something went wrong while processing the tournament command.',
                flags: MessageFlags.Ephemeral,
            });
        }

        return interaction.reply({
            content:
                '❌ Something went wrong while processing the tournament command.',
            flags: MessageFlags.Ephemeral,
        });
    }
}
export default, data, execute.
