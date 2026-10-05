import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Create a professional Cyber Knights announcement')
    .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild.toString()
    )

    .addStringOption(option =>
        option
            .setName('type')
            .setDescription('What type of announcement are you making?')
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
                    name: '📢 Team Update',
                    value: 'team',
                },
                {
                    name: '👤 Roster',
                    value: 'roster',
                },
                {
                    name: '📅 Practice',
                    value: 'practice',
                },
                {
                    name: '📣 General',
                    value: 'general',
                }
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
            .setDescription('What do you want to announce?')
            .setRequired(true)
            .setMaxLength(1000)
    );

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

    const type = interaction.options.getString(
        'type',
        true
    );

    const channel = interaction.options.getChannel(
        'channel',
        true
    );

    const message = interaction.options.getString(
        'message',
        true
    );

    return interaction.reply({
        content:
            `✅ **Announcement received.**\n\n` +
            `**Type:** ${type}\n` +
            `**Channel:** ${channel}\n` +
            `**Message:** ${message}\n\n` +
            `This is the first stage of the CK Announcement System. The professional formatting will be added next.`,
        ephemeral: true,
    });
}

export default {
    data,
    execute,
};
