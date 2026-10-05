import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
} from 'discord.js';

const ANNOUNCEMENT_COLOUR = 0x2f80ed;

const TYPE_CONFIG = {
    tournament: {
        emoji: '🏆',
        title: 'TOURNAMENT UPDATE',
    },
    match: {
        emoji: '⚔️',
        title: 'MATCH UPDATE',
    },
    team: {
        emoji: '📢',
        title: 'TEAM UPDATE',
    },
    roster: {
        emoji: '👤',
        title: 'ROSTER UPDATE',
    },
    practice: {
        emoji: '📅',
        title: 'PRACTICE UPDATE',
    },
    general: {
        emoji: '📣',
        title: 'ANNOUNCEMENT',
    },
};

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

function cleanMessage(message) {
    return message
        .trim()
        .replace(/\n{3,}/g, '\n\n');
}

function buildAnnouncementEmbed(type, message, user) {
    const config = TYPE_CONFIG[type];

    const embed = new EmbedBuilder()
        .setColor(ANNOUNCEMENT_COLOUR)
        .setAuthor({
            name: 'CYBER KNIGHTS',
        })
        .setTitle(`${config.emoji} ${config.title}`)
        .setDescription(cleanMessage(message))
        .setFooter({
            text: 'Cyber Knights • Competitive TH18 Esports',
        })
        .setTimestamp();

    if (user) {
        embed.setAuthor({
            name: 'CYBER KNIGHTS',
            iconURL: user.displayAvatarURL(),
        });
    }

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

    if (!channel.isTextBased()) {
        return interaction.reply({
            content:
                '❌ The selected channel cannot receive messages.',
            ephemeral: true,
        });
    }

    const embed = buildAnnouncementEmbed(
        type,
        message,
        interaction.user
    );

    try {
        await channel.send({
            embeds: [embed],
        });

        return interaction.reply({
            content:
                `✅ **Announcement published successfully.**\n\n📍 ${channel}`,
            ephemeral: true,
        });
    } catch (error) {
        console.error(
            '[ANNOUNCE] Failed to send announcement:',
            error
        );

        return interaction.reply({
            content:
                '❌ I could not send the announcement to that channel. Make sure I have **View Channel**, **Send Messages**, and **Embed Links** permissions there.',
            ephemeral: true,
        });
    }
}

export default {
    data,
    execute,
};
