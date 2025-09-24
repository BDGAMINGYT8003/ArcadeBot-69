const { SlashCommandBuilder } = require('discord.js');
const { getUserProfile } = require('../utils/database');
const { createBalanceEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your or another user\'s balance')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check balance for')
                .setRequired(false)),

    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const profile = getUserProfile(targetUser.id);

        if (!profile) {
            const { EmbedBuilder } = require('discord.js');
            const { COLORS } = require('../utils/embeds');

            const errorEmbed = new EmbedBuilder()
                .setColor(COLORS.ERROR)
                .setTitle('❌ Profile Not Found')
                .setDescription(`${targetUser.username} hasn't joined Arcade Empire yet!`)
                .setFooter({ text: 'They need to use any command to get started.' })
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });

            // Remove from active interactions
            client.activeInteractions.delete(interaction.user.id);
            return;
        }

        const balanceEmbed = createBalanceEmbed(targetUser, profile);
        await interaction.reply({ embeds: [balanceEmbed] });

        // Remove from active interactions
        client.activeInteractions.delete(interaction.user.id);
    }
};
