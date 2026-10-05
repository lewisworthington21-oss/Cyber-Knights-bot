import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const tournaments = [
    {
        name: 'Halloween Tournament',
        status: '🟢 LIVE',
        date: 'Currently active',
        details: 'Cyber Knights are competing in this tournament.'
    },
    {
        name: 'Saturn Cup',
        status: '🟡 UPCOMING',
        date: 'Date TBC',
        details: 'Cyber Knights have been accepted into the Saturn Cup.'
    },
    {
        name: 'TH18 3v3 Esports Tournament',
        status: '🟡 UPCOMING',
        date: 'Date TBC',
        details: 'Cyber Knights are entered in this TH18 3v3 tournament.'
    }
];

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('tournaments')
        .setDescription('View Cyber Knights tournaments'),

    category: 'Community',

    execute: async (interaction) => {
        const embed = new EmbedBuilder()
            .setTitle('🏆 Cyber Knights Tournaments')
            .setDescription('Our current and upcoming esports tournaments.')
            .setColor(0x3498db)
            .setTimestamp();

        for (const tournament of tournaments) {
            embed.addFields({
                name: `${tournament.status} ${tournament.name}`,
                value:
                    `**Date:** ${tournament.date}\n` +
                    `${tournament.details}`,
                inline: false
            });
        }

        embed.setFooter({
            text: 'Cyber Knights • Tournament Hub'
        });

        await interaction.reply({
            embeds: [embed]
        });
    }
};
