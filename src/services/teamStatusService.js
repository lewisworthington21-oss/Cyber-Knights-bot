import {
    EmbedBuilder,
} from 'discord.js';

const TEAM_STATUS_KEY = (guildId) =>
    `guild:${guildId}:teamStatus`;

const TOURNAMENTS_KEY = (guildId) =>
    `guild:${guildId}:tournaments`;

/* -------------------------------------------------------------------------- */
/*                              DEFAULT CONFIG                                */
/* -------------------------------------------------------------------------- */

function getDefaultConfig() {
    return {
        channelId: null,
        messageId: null,
        matchActive: false,
        roster: [],
    };
}

/* -------------------------------------------------------------------------- */
/*                              CONFIG STORAGE                                */
/* -------------------------------------------------------------------------- */

export async function getTeamStatusConfig(
    db,
    guildId
) {
    const saved =
        await db.get(
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

/* -------------------------------------------------------------------------- */
/*                              TOURNAMENTS                                   */
/* -------------------------------------------------------------------------- */

async function getTournaments(
    client,
    guildId
) {
    const tournaments =
        await client.db.get(
            TOURNAMENTS_KEY(guildId),
            []
        );

    if (!Array.isArray(tournaments)) {
        return [];
    }

    return tournaments;
}

/*
 * The tournament command stores the start time
 * as a Unix timestamp in `startAt`.
 *
 * We automatically treat an upcoming tournament
 * as live once its start time has been reached.
 */
function getEffectiveTournamentStatus(
    tournament,
    now
) {
    if (
        tournament.status === 'completed'
    ) {
        return 'completed';
    }

    if (
        tournament.status === 'live'
    ) {
        return 'live';
    }

    if (
        tournament.status === 'upcoming' &&
        Number.isFinite(
            Number(tournament.startAt)
        ) &&
        Number(tournament.startAt) <= now
    ) {
        return 'live';
    }

    return tournament.status || 'upcoming';
}

/* -------------------------------------------------------------------------- */
/*                              TEAM STATUS                                   */
/* -------------------------------------------------------------------------- */

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

    const hasLiveTournament =
        tournaments.some(
            tournament =>
                tournament.effectiveStatus ===
                'live'
        );

    if (hasLiveTournament) {
        return {
            label: 'ACTIVE',
            emoji: '🟢',
        };
    }

    const hasUpcomingTournament =
        tournaments.some(
            tournament =>
                tournament.effectiveStatus ===
                'upcoming'
        );

    if (hasUpcomingTournament) {
        return {
            label:
                'UPCOMING COMPETITION',
            emoji: '🟡',
        };
    }

    return {
        label:
            'NO ACTIVE COMPETITION',
        emoji: '⚪',
    };
}

/* -------------------------------------------------------------------------- */
/*                              ROSTER                                        */
/* -------------------------------------------------------------------------- */

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
        '👑 **MANAGEMENT**',
        management.length
            ? management.join('\n')
            : 'None added yet.',
        '',
        '⚔️ **MAIN LINEUP**',
        main.length
            ? main.join('\n')
            : 'None added yet.',
        '',
        '🔄 **SUBSTITUTES**',
        subs.length
            ? subs.join('\n')
            : 'None added yet.',
    ].join('\n');
}

/* -------------------------------------------------------------------------- */
/*                              TOURNAMENT LIST                               */
/* -------------------------------------------------------------------------- */

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
            .sort(
                (a, b) => {
                    const aTime =
                        Number(a.startAt);

                    const bTime =
                        Number(b.startAt);

                    if (
                        Number.isFinite(aTime) &&
                        Number.isFinite(bTime)
                    ) {
                        return (
                            aTime - bTime
                        );
                    }

                    return 0;
                }
            )
            .slice(0, 8);

    if (!active.length) {
        return 'No active or upcoming tournaments.';
    }

    return active
        .map(tournament => {
            const status =
                tournament.effectiveStatus ===
                'live'
                    ? '🟢 LIVE'
                    : '🟡 UPCOMING';

            const format =
                tournament.format
                    ? ` • ${tournament.format}`
                    : '';

            if (
                Number.isFinite(
                    Number(tournament.startAt)
                )
            ) {
                const timestamp =
                    Number(
                        tournament.startAt
                    );

                if (
                    tournament.effectiveStatus ===
                    'live'
                ) {
                    return [
                        `🏆 **${tournament.name}**`,
                        `${status}${format}`,
                        `Started <t:${timestamp}:R>`,
                    ].join('\n');
                }

                return [
                    `🏆 **${tournament.name}**`,
                    `${status}${format}`,
                    `Starts <t:${timestamp}:R>`,
                ].join('\n');
            }

            return [
                `🏆 **${tournament.name}**`,
                `${status}${format}`,
            ].join('\n');
        })
        .join('\n\n');
}

/* -------------------------------------------------------------------------- */
/*                              DASHBOARD                                     */
/* -------------------------------------------------------------------------- */

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
                'Cyber Knights — Competitive TH18 Clash of Clans esports team.'
            )
            .addFields(
                {
                    name: 'TEAM STATUS',
                    value:
                        `${teamStatus.emoji} **${teamStatus.label}**`,
                    inline: false,
                },
                {
                    name: '⚔️ MATCH STATUS',
                    value:
                        config.matchActive
                            ? '🟢 **ACTIVE**'
                            : '🔴 **NO ACTIVE MATCH**',
                    inline: true,
                },
                {
                    name: '🏆 COMPETITION',
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

/* -------------------------------------------------------------------------- */
/*                              DASHBOARD UPDATE                              */
/* -------------------------------------------------------------------------- */

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

    /*
     * Compare the new embed against the
     * existing embed. This prevents Discord
     * from receiving an edit every minute
     * when nothing has actually changed.
     */
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

    if (newEmbed === oldEmbed) {
        return;
    }

    await message.edit({
        embeds: [embed],
    });
}

/* -------------------------------------------------------------------------- */
/*                              CRON UPDATE                                   */
/* -------------------------------------------------------------------------- */

export async function updateAllTeamStatuses(
    client
) {
    if (!client?.isReady()) {
        return;
    }

    const guilds =
        client.guilds.cache;

    for (const guild of guilds.values()) {
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
