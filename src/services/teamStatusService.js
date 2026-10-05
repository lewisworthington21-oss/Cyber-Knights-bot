import {
    EmbedBuilder,
} from 'discord.js';

const TEAM_STATUS_KEY = (guildId) =>
    `guild:${guildId}:teamStatus`;

const TOURNAMENTS_KEY = (guildId) =>
    `guild:${guildId}:tournaments`;

function getDefaultConfig() {
    return {
        channelId: null,
        messageId: null,
        matchActive: false,
        roster: [],
    };
}

export async function getTeamStatusConfig(db, guildId) {
    const saved = await db.get(
        TEAM_STATUS_KEY(guildId),
        null
    );

    if (!saved || typeof saved !== 'object') {
        return getDefaultConfig();
    }

    return {
        ...getDefaultConfig(),
        ...saved,
        roster: Array.isArray(saved.roster)
            ? saved.roster
            : [],
    };
}

export async function saveTeamStatusConfig(
    db,
    guildId,
    config
) {
    await db.set(
        TEAM_STATUS_KEY(guildId),
        {
            ...getDefaultConfig(),
            ...config,
            roster: Array.isArray(config.roster)
                ? config.roster
                : [],
        }
    );
}

async function getTournaments(client, guildId) {
    const tournaments = await client.db.get(
        TOURNAMENTS_KEY(guildId),
        []
    );

    if (!Array.isArray(tournaments)) {
        return [];
    }

    return tournaments;
}

/*
 * A tournament only gets an automatic LIVE status when
 * it has a genuine startAt timestamp.
 *
 * This deliberately prevents:
 *
 * Number(null) === 0
 *
 * from being interpreted as January 1st 1970.
 */
function hasValidStartAt(tournament) {
    const timestamp = Number(tournament?.startAt);

    return (
        Number.isFinite(timestamp) &&
        timestamp > 0
    );
}

function getEffectiveTournamentStatus(
    tournament,
    now
) {
    if (tournament?.status === 'completed') {
        return 'completed';
    }

    if (tournament?.status === 'live') {
        return 'live';
    }

    if (
        tournament?.status === 'upcoming' &&
        hasValidStartAt(tournament) &&
        Number(tournament.startAt) <= now
    ) {
        return 'live';
    }

    return tournament?.status || 'upcoming';
}

function getOverallTeamStatus(
    tournaments,
    matchActive
) {
    if (matchActive) {
        return {
            label: 'LIVE MATCH',
            emoji: '🔴',
        };
    }

    const hasLiveTournament = tournaments.some(
        tournament =>
            tournament.effectiveStatus === 'live'
    );

    if (hasLiveTournament) {
        return {
            label: 'ACTIVE',
            emoji: '🟢',
        };
    }

    const hasUpcomingTournament = tournaments.some(
        tournament =>
            tournament.effectiveStatus === 'upcoming'
    );

    if (hasUpcomingTournament) {
        return {
            label: 'UPCOMING COMPETITION',
            emoji: '🟡',
        };
    }

    return {
        label: 'NO ACTIVE COMPETITION',
        emoji: '⚪',
    };
}

function getRosterMembers(
    guild,
    roster,
    position
) {
    return roster
        .filter(
            player =>
                player.position === position
        )
        .map(player => {
            const member =
                guild.members.cache.get(
                    player.userId
                );

            return member
                ? member.toString()
                : `<@${player.userId}>`;
        });
}

function buildRosterSection(
    guild,
    roster
) {
    const management =
        getRosterMembers(
            guild,
            roster,
            'management'
        );

    const main =
        getRosterMembers(
            guild,
            roster,
            'main'
        );

    const subs =
        getRosterMembers(
            guild,
            roster,
            'sub'
        );

    return [
        '👑 **Management**',
        management.length
            ? management.join(' • ')
            : 'None added yet.',
        '',
        '⚔️ **Main Lineup**',
        main.length
            ? main.join(' • ')
            : 'None added yet.',
        '',
        '🔄 **Substitutes**',
        subs.length
            ? subs.join(' • ')
            : 'None added yet.',
    ].join('\n');
}

function formatTournamentDate(
    tournament
) {
    if (!tournament?.date) {
        return '📅 **Date TBC**';
    }

    return `📅 **${tournament.date}**`;
}

function formatTournamentTime(
    tournament
) {
    if (!tournament?.time) {
        return '🕐 **Time TBC**';
    }

    if (tournament?.timezone) {
        return `🕐 **${tournament.time} ${tournament.timezone}**`;
    }

    return `🕐 **${tournament.time}**`;
}

function formatTournamentTiming(
    tournament
) {
    const hasDate = Boolean(
        tournament?.date
    );

    const hasTime = Boolean(
        tournament?.time
    );

    /*
     * If there is a real start timestamp,
     * Discord can provide a live relative countdown.
     */
    if (hasValidStartAt(tournament)) {
        const timestamp =
            Number(tournament.startAt);

        if (
            tournament.effectiveStatus ===
            'live'
        ) {
            return `🟢 **LIVE** • Started <t:${timestamp}:R>`;
        }

        return `🟡 **UPCOMING** • Starts <t:${timestamp}:R>`;
    }

    /*
     * No valid timestamp means we must rely
     * on the date/time fields themselves.
     */
    if (
        tournament.effectiveStatus ===
        'live'
    ) {
        return '🟢 **LIVE**';
    }

    const timing = [];

    if (hasDate) {
        timing.push(
            formatTournamentDate(
                tournament
            )
        );
    } else {
        timing.push(
            '📅 **Date TBC**'
        );
    }

    if (hasTime) {
        timing.push(
            formatTournamentTime(
                tournament
            )
        );
    } else {
        timing.push(
            '🕐 **Time TBC**'
        );
    }

    return `🟡 **UPCOMING**\n${timing.join(
        ' • '
    )}`;
}

function formatTournament(
    tournament
) {
    const format =
        tournament?.format
            ? `\n🎮 ${tournament.format}`
            : '';

    return [
        `🏆 **${tournament.name || 'Unnamed Tournament'}**`,
        formatTournamentTiming(
            tournament
        ),
        format,
    ]
        .filter(Boolean)
        .join('\n');
}

function buildTournamentSection(
    tournaments
) {
    const active =
        tournaments
            .filter(
                tournament =>
                    tournament.effectiveStatus !==
                    'completed'
            )
            .sort((a, b) => {
                const aHasTime =
                    hasValidStartAt(a);

                const bHasTime =
                    hasValidStartAt(b);

                /*
                 * Tournaments with known start times
                 * are placed before tournaments where
                 * the date/time is still unknown.
                 */
                if (
                    aHasTime &&
                    bHasTime
                ) {
                    return (
                        Number(a.startAt) -
                        Number(b.startAt)
                    );
                }

                if (
                    aHasTime &&
                    !bHasTime
                ) {
                    return -1;
                }

                if (
                    !aHasTime &&
                    bHasTime
                ) {
                    return 1;
                }

                return 0;
            })
            .slice(0, 8);

    if (!active.length) {
        return 'No active or upcoming tournaments.';
    }

    return active
        .map(formatTournament)
        .join('\n\n');
}

export function buildTeamStatusDashboard(
    guild,
    config,
    tournaments = []
) {
    const teamStatus =
        getOverallTeamStatus(
            tournaments,
            Boolean(config.matchActive)
        );

    const embed =
        new EmbedBuilder()
            .setTitle(
                '⚔️ CYBER KNIGHTS — TEAM STATUS'
            )
            .setDescription(
                [
                    `${teamStatus.emoji} **${teamStatus.label}**`,
                    '',
                    config.matchActive
                        ? '🔴 **Match:** Active'
                        : '🟢 **Match:** No active match',
                ].join('\n')
            )
            .addFields(
                {
                    name: '🏆 COMPETITIONS',
                    value:
                        buildTournamentSection(
                            tournaments
                        ),
                    inline: false,
                },
                {
                    name: '👥 ROSTER',
                    value:
                        buildRosterSection(
                            guild,
                            config.roster
                        ),
                    inline: false,
                }
            )
            .setFooter({
                text:
                    'Cyber Knights • Live Team Status • Updates every 60s',
            });

    return embed;
}

async function updateTeamStatus(
    client,
    guild
) {
    const config =
        await getTeamStatusConfig(
            client.db,
            guild.id
        );

    if (
        !config.channelId ||
        !config.messageId
    ) {
        return;
    }

    let channel;

    try {
        channel =
            await guild.channels.fetch(
                config.channelId
            );
    } catch {
        await saveTeamStatusConfig(
            client.db,
            guild.id,
            {
                ...config,
                channelId: null,
                messageId: null,
            }
        );

        return;
    }

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return;
    }

    let message;

    try {
        message =
            await channel.messages.fetch(
                config.messageId
            );
    } catch {
        await saveTeamStatusConfig(
            client.db,
            guild.id,
            {
                ...config,
                channelId: null,
                messageId: null,
            }
        );

        return;
    }

    const now =
        Math.floor(
            Date.now() / 1000
        );

    const tournaments =
        await getTournaments(
            client,
            guild.id
        );

    const processedTournaments =
        tournaments.map(
            tournament => ({
                ...tournament,
                effectiveStatus:
                    getEffectiveTournamentStatus(
                        tournament,
                        now
                    ),
            })
        );

    const embed =
        buildTeamStatusDashboard(
            guild,
            config,
            processedTournaments
        );

    const newEmbed =
        JSON.stringify(
            embed.toJSON()
        );

    const oldEmbed =
        message.embeds[0]
            ? JSON.stringify(
                  message.embeds[0].toJSON()
              )
            : null;

    /*
     * Do not edit the Discord message unless
     * something has actually changed.
     */
    if (
        newEmbed === oldEmbed
    ) {
        return;
    }

    await message.edit({
        embeds: [embed],
    });
}

export async function updateAllTeamStatuses(
    client
) {
    if (
        !client?.isReady()
    ) {
        return;
    }

    const guilds =
        client.guilds.cache;

    for (
        const guild of guilds.values()
    ) {
        try {
            await updateTeamStatus(
                client,
                guild
            );
        } catch (error) {
            console.error(
                `[TEAM STATUS] Failed to update guild ${guild.id}:`,
                error
            );
        }
    }
}
