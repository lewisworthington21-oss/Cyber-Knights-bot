import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    getTeamStatusConfig,
    saveTeamStatusConfig,
    buildTeamStatusDashboard,
} from '../../services/teamStatusService.js';

const data = new SlashCommandBuilder()
    .setName('teamstatus')
    .setDescription('View and manage the Cyber Knights team status dashboard')

    // VIEW
    .addSubcommand(subcommand =>
        subcommand
            .setName('view')
            .setDescription('View the current Cyber Knights team status')
    )

    // SETUP
    .addSubcommand(subcommand =>
        subcommand
            .setName('setup')
            .setDescription('Create or move the team status dashboard to this channel')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    )

    // MATCH
    .addSubcommand(subcommand =>
        subcommand
            .setName('match')
            .setDescription('Set the current match status')
            .addStringOption(option =>
                option
                    .setName('status')
                    .setDescription('Current match status')
                    .setRequired(true)
                    .addChoices(
                        {
                            name: '🟢 Active',
                            value: 'active',
                        },
                        {
                            name: '🔴 No Active Match',
                            value: 'inactive',
                        }
                    )
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    )

    // ROSTER
    .addSubcommand(subcommand =>
        subcommand
            .setName('roster')
            .setDescription('Manage the Cyber Knights roster')
            .addStringOption(option =>
                option
                    .setName('action')
                    .setDescription('What you want to do')
                    .setRequired(true)
                    .addChoices(
                        {
                            name: 'Add',
                            value: 'add',
                        },
                        {
                            name: 'Edit',
                            value: 'edit',
                        },
                        {
                            name: 'Remove',
                            value: 'remove',
                        }
                    )
            )
            .addUserOption(option =>
                option
                    .setName('member')
                    .setDescription('Discord member')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('position')
                    .setDescription('Team position')
                    .setRequired(false)
                    .addChoices(
                        {
                            name: '👑 Management',
                            value: 'management',
                        },
                        {
                            name: '⚔️ Main',
                            value: 'main',
                        },
                        {
                            name: '🔄 Sub',
                            value: 'sub',
                        }
                    )
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );

async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // ---------------------------------------------------------
    // VIEW
    // ---------------------------------------------------------

    if (subcommand === 'view') {
        const config = await getTeamStatusConfig(
            interaction.client.db,
            interaction.guild.id
        );

        if (!config.channelId || !config.messageId) {
            return interaction.reply({
                content:
                    '⚠️ The team status dashboard has not been set up yet. A server manager can use `/teamstatus setup`.',
                ephemeral: true,
            });
        }

        return interaction.reply({
            embeds: [buildTeamStatusDashboard(interaction.guild, config)],
            ephemeral: true,
        });
    }

    // ---------------------------------------------------------
    // PERMISSION CHECK
    // ---------------------------------------------------------

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
            content:
                '❌ You need the **Manage Server** permission to use this command.',
            ephemeral: true,
        });
    }

    // ---------------------------------------------------------
    // SETUP
    // ---------------------------------------------------------

    if (subcommand === 'setup') {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;

        let config = await getTeamStatusConfig(
            interaction.client.db,
            guild.id
        );

        // Remove the previous dashboard if one exists.
        if (config.channelId && config.messageId) {
            try {
                const oldChannel = await guild.channels.fetch(config.channelId);

                if (oldChannel?.isTextBased()) {
                    const oldMessage = await oldChannel.messages.fetch(
                        config.messageId
                    );

                    if (oldMessage) {
                        await oldMessage.delete();
                    }
                }
            } catch {
                // Old dashboard may already have been deleted.
            }
        }

        // Create the new dashboard in the channel where setup was run.
        const channel = interaction.channel;

        if (!channel?.isTextBased()) {
            return interaction.editReply({
                content:
                    '❌ This command must be used in a text-based Discord channel.',
            });
        }

        config.channelId = channel.id;
        config.messageId = null;

        const message = await channel.send({
            embeds: [buildTeamStatusDashboard(guild, config)],
            components: [],
        });

        config.messageId = message.id;

        await saveTeamStatusConfig(
            interaction.client.db,
            guild.id,
            config
        );

        // Try to pin the dashboard.
        let pinned = true;

        try {
            await message.pin();
        } catch {
            pinned = false;
        }

        // Rebuild after saving so the service has the final config.
        await message.edit({
            embeds: [buildTeamStatusDashboard(guild, config)],
        });

        return interaction.editReply({
            content: pinned
                ? `✅ **Team Status dashboard created.**\n\n📍 ${channel}\n📌 The dashboard has been pinned and will automatically update.`
                : `✅ **Team Status dashboard created.**\n\n📍 ${channel}\n\n⚠️ I couldn't pin the message. Make sure the bot has the **Manage Messages** permission in this channel.`,
        });
    }

    // ---------------------------------------------------------
    // MATCH STATUS
    // ---------------------------------------------------------

    if (subcommand === 'match') {
        const status = interaction.options.getString('status', true);

        const config = await getTeamStatusConfig(
            interaction.client.db,
            interaction.guild.id
        );

        config.matchActive = status === 'active';

        await saveTeamStatusConfig(
            interaction.client.db,
            interaction.guild.id,
            config
        );

        return interaction.reply({
            content:
                status === 'active'
                    ? '🟢 **Match status set to ACTIVE.**'
                    : '🔴 **Match status set to NO ACTIVE MATCH.**',
            ephemeral: true,
        });
    }

    // ---------------------------------------------------------
    // ROSTER
    // ---------------------------------------------------------

    if (subcommand === 'roster') {
        const action = interaction.options.getString('action', true);
        const member = interaction.options.getUser('member', true);
        const position = interaction.options.getString('position');

        const config = await getTeamStatusConfig(
            interaction.client.db,
            interaction.guild.id
        );

        if (!Array.isArray(config.roster)) {
            config.roster = [];
        }

        // -----------------------------------------------------
        // REMOVE
        // -----------------------------------------------------

        if (action === 'remove') {
            const existingIndex = config.roster.findIndex(
                player => player.userId === member.id
            );

            if (existingIndex === -1) {
                return interaction.reply({
                    content: `❌ ${member} is not currently on the Cyber Knights roster.`,
                    ephemeral: true,
                });
            }

            config.roster.splice(existingIndex, 1);

            await saveTeamStatusConfig(
                interaction.client.db,
                interaction.guild.id,
                config
            );

            return interaction.reply({
                content: `✅ ${member} has been **removed from the Cyber Knights roster**.`,
                ephemeral: true,
            });
        }

        // Position is required for add/edit.
        if (!position) {
            return interaction.reply({
                content:
                    '❌ You need to select a **position** when adding or editing a player.',
                ephemeral: true,
            });
        }

        // -----------------------------------------------------
        // ADD
        // -----------------------------------------------------

        if (action === 'add') {
            const existingPlayer = config.roster.find(
                player => player.userId === member.id
            );

            if (existingPlayer) {
                return interaction.reply({
                    content:
                        `❌ ${member} is already on the roster as **${existingPlayer.position.toUpperCase()}**.\n\nUse **Edit** if you want to change their position.`,
                    ephemeral: true,
                });
            }

            config.roster.push({
                userId: member.id,
                position,
            });

            await saveTeamStatusConfig(
                interaction.client.db,
                interaction.guild.id,
                config
            );

            return interaction.reply({
                content:
                    `✅ ${member} has been added to the Cyber Knights roster as **${position.toUpperCase()}**.`,
                ephemeral: true,
            });
        }

        // -----------------------------------------------------
        // EDIT
        // -----------------------------------------------------

        if (action === 'edit') {
            const existingPlayer = config.roster.find(
                player => player.userId === member.id
            );

            if (!existingPlayer) {
                return interaction.reply({
                    content:
                        `❌ ${member} isn't currently on the roster.\n\nUse **Add** to add them first.`,
                    ephemeral: true,
                });
            }

            existingPlayer.position = position;

            await saveTeamStatusConfig(
                interaction.client.db,
                interaction.guild.id,
                config
            );

            return interaction.reply({
                content:
                    `✅ ${member}'s position has been changed to **${position.toUpperCase()}**.`,
                ephemeral: true,
            });
        }

        return interaction.reply({
            content: '❌ Unknown roster action.',
            ephemeral: true,
        });
    }

    return interaction.reply({
        content: '❌ Unknown team status command.',
        ephemeral: true,
    });
}

export default {
    data,
    execute,
};
