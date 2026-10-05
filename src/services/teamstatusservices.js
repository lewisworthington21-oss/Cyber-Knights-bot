import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import { logger } from '../utils/logger.js';

const TEAM_STATUS_KEY = (guildId) =>
    `guild:${guildId}:team_status`;

const TOURNAMENTS_KEY = (guildId) =>
    `guild:${guildId}:tournaments`;

// ---------------------------------------------------------
// DATABASE
// ---------------------------------------------------------

function getConfig(client, guildId) {
    return (
        client.db.get(TEAM_STATUS_KEY(guildId)) || {
            channelId: null,
            messageId: null,
            matchActive: false,
            roster: [],
            lastRendered: null,
        }
    );
}

function saveConfig(client, guildId, config) {
    client.db.set(
        TEAM_STATUS_KEY(guildId),
        config
    );
}

function getTournaments(client, guildId) {
    const tournaments = client.db.get(
        TOURNAMENTS_KEY(guildId)
    );

    return Array.isArray(tournaments)
        ? tournaments
        : [];
}

// ---------------------------------------------------------
// TOURNAMENT HELPERS
// ---------------------------------------------------------

function getTournamentTimestamp(tournament, type) {
    const candidates =
        type === 'start'
            ? [
                  tournament.startTimestamp,
                  tournament.startAt,
                  tournament.startDateTime,
                  tournament.startDate,
                  tournament.dateTime,
              ]
            : [
                  tournament.endTimestamp,
                  tournament.endAt,
                  tournament.endDateTime,
                  tournament.endDate,
              ];

    for (const value of candidates) {
        if (
            value === null ||
            value === undefined ||
            value === ''
        ) {
            continue;
        }

        if (
            typeof value === 'number' &&
            Number.isFinite(value)
        ) {
            return value > 1000000000000
                ? Math.floor(value / 1000)
                : Math.floor(value);
        }

        if (typeof value === 'string') {
            const numeric = Number(value);

            if (
                Number.isFinite(numeric) &&
                numeric > 0
            ) {
                return numeric > 1000000000000
                    ? Math.floor(numeric / 1000)
                    : Math.floor(numeric);
            }

            const parsed = Date.parse(value);

            if (!Number.isNaN(parsed)) {
                return Math.floor(parsed / 1000);
            }
        }
    }

    return null;
}

function normalizeStatus(tournament) {
    const status = String(
        tournament.status || ''
    ).toLowerCase();

    // Explicit completed status always wins.
    if (
        [
            'completed',
            'complete',
            'finished',
            'ended',
        ].includes(status)
    ) {
        return 'completed';
    }

    // Explicit live status.
    if (
        [
            'live',
            'active',
            'ongoing',
        ].includes(status)
    ) {
        return 'live';
    }

    // Explicit upcoming status.
    if (
        [
            'upcoming',
            'scheduled',
            'pending',
        ].includes(status)
    ) {
        return 'upcoming';
    }

    // Automatic time-based status.
    const start = getTournamentTimestamp(
        tournament,
        'start'
    );

    const end = getTournamentTimestamp(
        tournament,
        'end'
    );

    const now = Math.floor(
        Date.now() / 1000
    );

    if (end && now >= end) {
        return 'completed';
    }

    if (start && now >= start) {
        return 'live';
    }

    return 'upcoming';
}

function getTournamentName(tournament) {
    return (
        tournament.name ||
        tournament.title ||
        tournament.tournamentName ||
        'Unnamed Tournament'
    );
}

function getTournamentFormat(tournament) {
    return (
        tournament.format ||
        tournament.type ||
        tournament.matchFormat ||
        null
    );
}

function getTournamentRound(tournament) {
    return (
        tournament.round ||
        tournament.stage ||
        tournament.currentRound ||
        null
    );
}

function getTournamentStatusEmoji(status) {
    if (status === 'live') {
        return '🟢';
    }

    if (status === 'upcoming') {
        return '🟡';
    }

    return '⚪';
}

function buildTournamentLine(tournament) {
    const status = normalizeStatus(
        tournament
    );

    const emoji =
        getTournamentStatusEmoji(status);

    const name =
        getTournamentName(tournament);

    const format =
        getTournamentFormat(tournament);

    const round =
        getTournamentRound(tournament);

    const details = [];

    if (round) {
        details.push(String(round));
    }

    if (format) {
        details.push(String(format));
    }

    let timing;

    if (status === 'live') {
        const end =
            getTournamentTimestamp(
                tournament,
                'end'
            );

        timing = end
            ? `Ends <t:${end}:R>`
            : 'LIVE';
    } else {
        const start =
            getTournamentTimestamp(
                tournament,
                'start'
            );

        timing = start
            ? `Starts <t:${start}:R>`
            : 'Upcoming';
    }

    if (details.length > 0) {
        return `${emoji} **${name}**\n${details.join(
            ' • '
        )} • ${timing}`;
    }

    return `${emoji} **${name}**\n${timing}`;
}

function getActiveTournaments(
    client,
    guildId
) {
    const tournaments =
        getTournaments(
            client,
            guildId
        );

    return tournaments
        .filter(tournament => {
            if (!tournament) {
                return false;
            }

            const status =
                normalizeStatus(
                    tournament
                );

            return (
                status === 'live' ||
                status === 'upcoming'
            );
        })
        .sort((a, b) => {
            const aStatus =
                normalizeStatus(a);

            const bStatus =
                normalizeStatus(b);

            if (aStatus !== bStatus) {
                if (aStatus === 'live') {
                    return -1;
                }

                if (bStatus === 'live') {
                    return 1;
                }
            }

            const aStart =
                getTournamentTimestamp(
                    a,
                    'start'
                ) ||
                Number.MAX_SAFE_INTEGER;

            const bStart =
                getTournamentTimestamp(
                    b,
                    'start'
                ) ||
                Number.MAX_SAFE_INTEGER;

            return aStart - bStart;
        });
}

// ---------------------------------------------------------
// OVERALL TEAM STATUS
// ---------------------------------------------------------

function calculateOverallStatus(
    matchActive,
    tournaments
) {
    if (matchActive) {
        return {
            emoji: '🔴',
            label: 'LIVE MATCH',
        };
    }

    const liveTournament =
        tournaments.some(
            tournament =>
                normalizeStatus(
                    tournament
                ) === 'live'
        );

    if (liveTournament) {
        return {
            emoji: '🟢',
            label: 'ACTIVE',
        };
    }

    const upcomingTournament =
        tournaments.some(
            tournament =>
                normalizeStatus(
                    tournament
                ) === 'upcoming'
        );

    if (upcomingTournament) {
        return {
            emoji: '🟡',
            label: 'UPCOMING COMPETITION',
        };
    }

    return {
        emoji: '⚪',
        label: 'NO ACTIVE COMPETITION',
    };
}

// ---------------------------------------------------------
// ROSTER
// ---------------------------------------------------------

function getMention(userId) {
    return `<@${userId}>`;
}

function getRosterByPosition(
    roster,
    position
) {
    return roster.filter(
        member =>
            member.position === position
    );
}

function buildRosterText(
    roster,
    position,
    emptyText
) {
    const members =
        getRosterByPosition(
            roster,
            position
        );

    if (members.length === 0) {
        return emptyText;
    }

    return members
        .map(
            member =>
                `${getMention(
                    member.userId
                )} — ${position.toUpperCase()}`
        )
        .join('\n');
}

// ---------------------------------------------------------
// BUTTONS
// ---------------------------------------------------------

function buildButtons(guild) {
    const tournamentHub =
        guild.channels.cache.find(
            channel =>
                channel.isTextBased() &&
                [
                    'tournament-hub',
                    'tournaments',
                ].includes(
                    channel.name.toLowerCase()
                )
        );

    const teamAvailability =
        guild.channels.cache.find(
            channel =>
                channel.isTextBased() &&
                channel.name
                    .toLowerCase() ===
                    'team-availability'
        );

    const buttons = [];

    if (tournamentHub) {
        buttons.push(
            new ButtonBuilder()
                .setLabel(
                    'Tournament Hub'
                )
                .setEmoji('🏆')
                .setStyle(
                    ButtonStyle.Link
                )
                .setURL(
                    `https://discord.com/channels/${guild.id}/${tournamentHub.id}`
                )
        );
    }

    if (teamAvailability) {
        buttons.push(
            new ButtonBuilder()
                .setLabel(
                    'Team Availability'
                )
                .setEmoji('📅')
                .setStyle(
                    ButtonStyle.Link
                )
                .setURL(
                    `https://discord.com/channels/${guild.id}/${teamAvailability.id}`
                )
        );
    }

    if (buttons.length === 0) {
        return [];
    }

    return [
        new ActionRowBuilder().addComponents(
            buttons
        ),
    ];
}

// ---------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------

function buildDashboard(
    client,
    guild,
    config
) {
    const tournaments =
        getActiveTournaments(
            client,
            guild.id
        );

    const overallStatus =
        calculateOverallStatus(
            config.matchActive,
            tournaments
        );

    const roster = Array.isArray(
        config.roster
    )
        ? config.roster
        : [];

    const management =
        buildRosterText(
            roster,
            'management',
            'No management members configured.'
        );

    const main =
        buildRosterText(
            roster,
            'main',
            'No main lineup configured.'
        );

    const substitutes =
        buildRosterText(
            roster,
            'sub',
            'No substitutes configured.'
        );

    const tournamentText =
        tournaments.length > 0
            ? tournaments
                  .slice(0, 8)
                  .map(
                      buildTournamentLine
                  )
                  .join('\n\n')
            : 'No active or upcoming tournaments.';

    const embed =
        new EmbedBuilder()
            .setTitle(
                '⚔️ CYBER KNIGHTS — TEAM STATUS'
            )
            .setDescription(
                '**Cyber Knights — Competitive TH18 Clash of Clans esports team.**'
            )
            .addFields(
                {
                    name: 'CURRENT STATUS',
                    value: `${overallStatus.emoji} **${overallStatus.label}**`,
                    inline: false,
                },
                {
                    name: '👑 MANAGEMENT',
                    value: management,
                    inline: false,
                },
                {
                    name: '⚔️ MAIN LINEUP',
                    value: main,
                    inline: false,
                },
                {
                    name: '🔄 SUBSTITUTES',
                    value: substitutes,
                    inline: false,
                },
                {
                    name: '🏆 ACTIVE TOURNAMENTS',
                    value: tournamentText,
                    inline: false,
                },
                {
                    name: '⚔️ MATCH STATUS',
                    value: config.matchActive
                        ? '🟢 **ACTIVE**'
                        : '🔴 **NO ACTIVE MATCH**',
                    inline: false,
                }
            )
            .setFooter({
                text: 'Cyber Knights • Live Team Status • Updates every 60s',
            });

    return {
        embeds: [embed],
        components:
            buildButtons(guild),
    };
}

// ---------------------------------------------------------
// CHANGE DETECTION
// ---------------------------------------------------------

function createRenderSignature(
    payload
) {
    return JSON.stringify({
        embeds: (
            payload.embeds || []
        ).map(embed => {
            if (
                typeof embed.toJSON ===
                'function'
            ) {
                return embed.toJSON();
            }

            return embed;
        }),

        components: (
            payload.components || []
        ).map(component => {
            if (
                typeof component.toJSON ===
                'function'
            ) {
                return component.toJSON();
            }

            return component;
        }),
    });
}

// ---------------------------------------------------------
// UPDATE ONE SERVER
// ---------------------------------------------------------

export async function updateTeamStatus(
    client,
    guild
) {
    if (!client.db || !guild) {
        return;
    }

    const config = getConfig(
        client,
        guild.id
    );

    if (
        !config.channelId ||
        !config.messageId
    ) {
        return;
    }

    try {
        const channel =
            await guild.channels.fetch(
                config.channelId
            );

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            logger.warn(
                `Team Status channel ${config.channelId} no longer exists in guild ${guild.id}.`
            );

            return;
        }

        const message =
            await channel.messages.fetch(
                config.messageId
            );

        if (!message) {
            return;
        }

        const payload =
            buildDashboard(
                client,
                guild,
                config
            );

        const signature =
            createRenderSignature(
                payload
            );

        // Nothing changed — do not edit Discord.
        if (
            config.lastRendered ===
            signature
        ) {
            return;
        }

        await message.edit(
            payload
        );

        config.lastRendered =
            signature;

        saveConfig(
            client,
            guild.id,
            config
        );

        logger.info(
            `Updated Team Status dashboard for guild ${guild.id}.`
        );
    } catch (error) {
        // Unknown channel.
        if (
            error?.code === 10003
        ) {
            logger.warn(
                `Team Status channel no longer exists for guild ${guild.id}. Clearing dashboard.`
            );

            config.channelId = null;
            config.messageId = null;
            config.lastRendered = null;

            saveConfig(
                client,
                guild.id,
                config
            );

            return;
        }

        // Unknown message.
        if (
            error?.code === 10008
        ) {
            logger.warn(
                `Team Status message no longer exists for guild ${guild.id}. Clearing dashboard.`
            );

            config.channelId = null;
            config.messageId = null;
            config.lastRendered = null;

            saveConfig(
                client,
                guild.id,
                config
            );

            return;
        }

        logger.error(
            `Error updating Team Status dashboard for guild ${guild.id}:`,
            error
        );
    }
}

// ---------------------------------------------------------
// UPDATE ALL SERVERS
// ---------------------------------------------------------

export async function updateAllTeamStatuses(
    client
) {
    if (
        !client.db ||
        !client.isReady()
    ) {
        return;
    }

    for (const guild of client.guilds.cache.values()) {
        try {
            await updateTeamStatus(
                client,
                guild
            );
        } catch (error) {
            logger.error(
                `Failed to update Team Status for guild ${guild.id}:`,
                error
            );
        }
    }
}

// ---------------------------------------------------------
// EXPORTED HELPERS
// ---------------------------------------------------------

export function getTeamStatusConfig(
    client,
    guildId
) {
    return getConfig(
        client,
        guildId
    );
}

export function saveTeamStatusConfig(
    client,
    guildId,
    config
) {
    saveConfig(
        client,
        guildId,
        config
    );
}

export function buildTeamStatusDashboard(
    guild,
    config
) {
    const client = guild.client;

    return buildDashboard(
        client,
        guild,
        config
    ).embeds[0];
}

export function getTeamStatusKey(
    guildId
) {
    return TEAM_STATUS_KEY(
        guildId
    );
}
