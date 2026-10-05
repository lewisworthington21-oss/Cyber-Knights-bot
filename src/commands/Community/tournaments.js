import {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';

const TOURNAMENTS_KEY = (guildId) => `guild:${guildId}:tournaments`;

// --------------------------------------------------
// DATABASE HELPERS
// --------------------------------------------------

async function getTournaments(client, guildId) {
    try {
        if (!client?.db || typeof client.db.get !== 'function') {
            throw new Error('Database is not available.');
        }

        const data = await client.db.get(TOURNAMENTS_KEY(guildId), []);
        
        if (!Array.isArray(data)) {
            return [];
        }

        return data;
    } catch (error) {
        console.error('Error loading tournaments:', error);
        throw error;
    }
}

async function saveTournaments(client, guildId, tournaments) {
    try {
        if (!client?.db || typeof client.db.set !== 'function') {
            throw new Error('Database is not available.');
        }

        await client.db.set(TOURNAMENTS_KEY(guildId), tournaments);
        return true;
    } catch (error) {
        console.error('Error saving tournaments:', error);
        throw error;
    }
}

// --------------------------------------------------
// UTILITY FUNCTIONS
// --------------------------------------------------

function generateTournamentId(tournaments) {
    let id;

    do {
        id = Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();
    } while (tournaments.some(tournament => tournament.id === id));

    return id;
}

function getStatusDisplay(status) {
    switch (status) {
        case 'live':
            return '🟢 LIVE';

        case 'upcoming':
            return '🟡 UPCOMING';

        case 'completed':
            return '⚪ COMPLETED';

        default:
            return '🟡 UPCOMING';
    }
}

function getStatusColor(status) {
    switch (status) {
        case 'live':
            return 0x2ecc71;

        case 'upcoming':
            return 0xf1c40f;

        case 'completed':
            return 0x95a5a6;

        default:
            return 0x3498db;
    }
}

function formatTournamentDate(tournament) {
    if (!tournament.date) {
        return 'Date TBC';
    }

    return tournament.date;
}

function truncate(text, maxLength) {
    if (!text) {
        return '';

    }

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.substring(0, maxLength - 3)}...`;
}

// --------------------------------------------------
// PERMISSION CHECK
// --------------------------------------------------

function canManageTournaments(interaction) {
    return interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageGuild
    );
}

// --------------------------------------------------
// MAIN COMMAND
// --------------------------------------------------

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('tournaments')
        .setDescription('View and manage Cyber Knights tournaments')

        // ------------------------------------------
        // /tournaments
        // ------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View Cyber Knights tournaments')
        )

        // ------------------------------------------
        // /tournaments add
        // ------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new tournament')

                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Tournament name')
                        .setRequired(true)
                        .setMaxLength(100)
                )

                .addStringOption(option =>
                    option
                        .setName('status')
                        .setDescription('Tournament status')
                        .setRequired(true)
                        .addChoices(
                            {
                                name: '🟡 Upcoming',
                                value: 'upcoming'
                            },
                            {
                                name: '🟢 Live',
                                value: 'live'
                            },
                            {
                                name: '⚪ Completed',
                                value: 'completed'
                            }
                        )
                )

                .addStringOption(option =>
                    option
                        .setName('date')
                        .setDescription('Tournament date or date range')
                        .setRequired(false)
                        .setMaxLength(100)
                )

                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Tournament details')
                        .setRequired(false)
                        .setMaxLength(1000)
                )

                .addStringOption(option =>
                    option
                        .setName('logo')
                        .setDescription('Direct URL to the tournament logo')
                        .setRequired(false)
                        .setMaxLength(500)
                )
        )

        // ------------------------------------------
        // /tournaments edit
        // ------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing tournament')

                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Tournament ID')
                        .setRequired(true)
                        .setMaxLength(20)
                )

                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('New tournament name')
                        .setRequired(false)
                        .setMaxLength(100)
                )

                .addStringOption(option =>
                    option
                        .setName('status')
                        .setDescription('New tournament status')
                        .setRequired(false)
                        .addChoices(
                            {
                                name: '🟡 Upcoming',
                                value: 'upcoming'
                            },
                            {
                                name: '🟢 Live',
                                value: 'live'
                            },
                            {
                                name: '⚪ Completed',
                                value: 'completed'
                            }
                        )
                )

                .addStringOption(option =>
                    option
                        .setName('date')
                        .setDescription('New tournament date')
                        .setRequired(false)
                        .setMaxLength(100)
                )

                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('New tournament description')
                        .setRequired(false)
                        .setMaxLength(1000)
                )

                .addStringOption(option =>
                    option
                        .setName('logo')
                        .setDescription('New tournament logo URL')
                        .setRequired(false)
                        .setMaxLength(500)
                )
        )

        // ------------------------------------------
        // /tournaments remove
        // ------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a tournament')

                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Tournament ID')
                        .setRequired(true)
                        .setMaxLength(20)
                )
        )

        // ------------------------------------------
        // /tournaments complete
        // ------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('complete')
                .setDescription('Mark a tournament as completed')

                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Tournament ID')
                        .setRequired(true)
                        .setMaxLength(20)
                )
        )

        // ------------------------------------------
        // /tournaments live
        // ------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('live')
                .setDescription('Mark a tournament as live')

                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Tournament ID')
                        .setRequired(true)
                        .setMaxLength(20)
                )
        )

        // ------------------------------------------
        // /tournaments upcoming
        // ------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('upcoming')
                .setDescription('Mark a tournament as upcoming')

                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Tournament ID')
                        .setRequired(true)
                        .setMaxLength(20)
                )
        ),

    category: 'Community',

    async execute(interaction, guildConfig, client) {

        const subcommand = interaction.options.getSubcommand();

        // ==================================================
        // LIST TOURNAMENTS
        // ==================================================

        if (subcommand === 'list') {
            try {
                const tournaments = await getTournaments(
                    client,
                    interaction.guildId
                );

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Cyber Knights — Tournament Hub')
                    .setDescription(
                        'Current and upcoming Cyber Knights esports tournaments.'
                    )
                    .setColor(0x3498db)
                    .setTimestamp();

                if (tournaments.length === 0) {
                    embed.setDescription(
                        'There are currently no tournaments listed.'
                    );

                    embed.setFooter({
                        text: 'Cyber Knights • Tournament Hub'
                    });

                    return interaction.reply({
                        embeds: [embed]
                    });
                }

                // Sort:
                // Live → Upcoming → Completed
                const statusOrder = {
                    live: 1,
                    upcoming: 2,
                    completed: 3
                };

                tournaments.sort((a, b) => {
                    return (
                        (statusOrder[a.status] || 99) -
                        (statusOrder[b.status] || 99)
                    );
                });

                for (const tournament of tournaments) {

                    let value =
                        `**Date:** ${formatTournamentDate(tournament)}\n` +
                        `**ID:** \`${tournament.id}\``;

                    if (tournament.description) {
                        value += `\n\n${truncate(
                            tournament.description,
                            1000
                        )}`;
                    }

                    embed.addFields({
                        name: `${getStatusDisplay(tournament.status)} ${tournament.name}`,
                        value,
                        inline: false
                    });
                }

                const liveCount = tournaments.filter(
                    tournament => tournament.status === 'live'
                ).length;

                const upcomingCount = tournaments.filter(
                    tournament => tournament.status === 'upcoming'
                ).length;

                const completedCount = tournaments.filter(
                    tournament => tournament.status === 'completed'
                ).length;

                embed.setFooter({
                    text:
                        `Cyber Knights • ${liveCount} Live • ` +
                        `${upcomingCount} Upcoming • ` +
                        `${completedCount} Completed`
                });

                return interaction.reply({
                    embeds: [embed]
                });

            } catch (error) {

                console.error('Tournament list error:', error);

                return interaction.reply({
                    content:
                        '❌ I couldn’t load the tournament list. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ==================================================
        // MANAGEMENT PERMISSION
        // ==================================================

        if (!canManageTournaments(interaction)) {
            return interaction.reply({
                content:
                    '❌ You need the **Manage Server** permission to manage tournaments.',
                flags: MessageFlags.Ephemeral
            });
        }

        // ==================================================
        // ADD TOURNAMENT
        // ==================================================

        if (subcommand === 'add') {

            const name = interaction.options.getString('name');
            const status = interaction.options.getString('status');
            const date = interaction.options.getString('date');
            const description = interaction.options.getString('description');
            const logo = interaction.options.getString('logo');

            try {

                const tournaments = await getTournaments(
                    client,
                    interaction.guildId
                );

                const id = generateTournamentId(tournaments);

                const tournament = {
                    id,
                    name,
                    status,
                    date: date || null,
                    description: description || null,
                    logo: logo || null,
                    createdAt: Date.now(),
                    createdBy: interaction.user.id,
                    updatedAt: Date.now()
                };

                tournaments.push(tournament);

                await saveTournaments(
                    client,
                    interaction.guildId,
                    tournaments
                );

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Tournament Added')
                    .setDescription(
                        `**${name}** has been added to the Cyber Knights tournament hub.`
                    )
                    .setColor(getStatusColor(status))
                    .addFields(
                        {
                            name: 'Status',
                            value: getStatusDisplay(status),
                            inline: true
                        },
                        {
                            name: 'Date',
                            value: date || 'Date TBC',
                            inline: true
                        },
                        {
                            name: 'Tournament ID',
                            value: `\`${id}\``,
                            inline: true
                        }
                    )
                    .setTimestamp();

                if (description) {
                    embed.addFields({
                        name: 'Details',
                        value: description
                    });
                }

                if (logo) {
                    embed.setThumbnail(logo);
                }

                embed.setFooter({
                    text: 'Cyber Knights • Tournament Hub'
                });

                return interaction.reply({
                    embeds: [embed]
                });

            } catch (error) {

                console.error('Tournament add error:', error);

                return interaction.reply({
                    content:
                        '❌ I couldn’t save the tournament. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ==================================================
        // EDIT TOURNAMENT
        // ==================================================

        if (subcommand === 'edit') {

            const id = interaction.options
                .getString('id')
                .toUpperCase();

            const name = interaction.options.getString('name');
            const status = interaction.options.getString('status');
            const date = interaction.options.getString('date');
            const description = interaction.options.getString('description');
            const logo = interaction.options.getString('logo');

            try {

                const tournaments = await getTournaments(
                    client,
                    interaction.guildId
                );

                const index = tournaments.findIndex(
                    tournament => tournament.id === id
                );

                if (index === -1) {
                    return interaction.reply({
                        content:
                            `❌ No tournament was found with ID \`${id}\`.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                const tournament = tournaments[index];

                if (name !== null) {
                    tournament.name = name;
                }

                if (status !== null) {
                    tournament.status = status;
                }

                if (date !== null) {
                    tournament.date = date;
                }

                if (description !== null) {
                    tournament.description = description;
                }

                if (logo !== null) {
                    tournament.logo = logo;
                }

                tournament.updatedAt = Date.now();

                await saveTournaments(
                    client,
                    interaction.guildId,
                    tournaments
                );

                const embed = new EmbedBuilder()
                    .setTitle('✏️ Tournament Updated')
                    .setDescription(
                        `**${tournament.name}** has been updated.`
                    )
                    .setColor(getStatusColor(tournament.status))
                    .addFields(
                        {
                            name: 'Status',
                            value: getStatusDisplay(tournament.status),
                            inline: true
                        },
                        {
                            name: 'Date',
                            value: tournament.date || 'Date TBC',
                            inline: true
                        },
                        {
                            name: 'Tournament ID',
                            value: `\`${tournament.id}\``,
                            inline: true
                        }
                    )
                    .setTimestamp();

                if (tournament.description) {
                    embed.addFields({
                        name: 'Details',
                        value: tournament.description
                    });
                }

                if (tournament.logo) {
                    embed.setThumbnail(tournament.logo);
                }

                embed.setFooter({
                    text: 'Cyber Knights • Tournament Hub'
                });

                return interaction.reply({
                    embeds: [embed]
                });

            } catch (error) {

                console.error('Tournament edit error:', error);

                return interaction.reply({
                    content:
                        '❌ I couldn’t update the tournament. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ==================================================
        // REMOVE TOURNAMENT
        // ==================================================

        if (subcommand === 'remove') {

            const id = interaction.options
                .getString('id')
                .toUpperCase();

            try {

                const tournaments = await getTournaments(
                    client,
                    interaction.guildId
                );

                const index = tournaments.findIndex(
                    tournament => tournament.id === id
                );

                if (index === -1) {
                    return interaction.reply({
                        content:
                            `❌ No tournament was found with ID \`${id}\`.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                const removedTournament = tournaments[index];

                tournaments.splice(index, 1);

                await saveTournaments(
                    client,
                    interaction.guildId,
                    tournaments
                );

                return interaction.reply({
                    content:
                        `🗑️ **${removedTournament.name}** (` +
                        `\`${removedTournament.id}\`) has been removed from the tournament hub.`
                });

            } catch (error) {

                console.error('Tournament remove error:', error);

                return interaction.reply({
                    content:
                        '❌ I couldn’t remove the tournament. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ==================================================
        // COMPLETE / LIVE / UPCOMING
        // ==================================================

        if (
            subcommand === 'complete' ||
            subcommand === 'live' ||
            subcommand === 'upcoming'
        ) {

            const id = interaction.options
                .getString('id')
                .toUpperCase();

            const newStatus = subcommand;

            try {

                const tournaments = await getTournaments(
                    client,
                    interaction.guildId
                );

                const tournament = tournaments.find(
                    tournament => tournament.id === id
                );

                if (!tournament) {
                    return interaction.reply({
                        content:
                            `❌ No tournament was found with ID \`${id}\`.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                tournament.status = newStatus;
                tournament.updatedAt = Date.now();

                await saveTournaments(
                    client,
                    interaction.guildId,
                    tournaments
                );

                return interaction.reply({
                    content:
                        `${getStatusDisplay(newStatus)} **${tournament.name}** ` +
                        `is now marked as **${newStatus}**.`
                });

            } catch (error) {

                console.error(
                    `Tournament ${subcommand} error:`,
                    error
                );

                return interaction.reply({
                    content:
                        '❌ I couldn’t update the tournament status. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};
