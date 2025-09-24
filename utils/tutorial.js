const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUserProfile, createUserProfile, completeTutorial } = require('./database');
const { ARCADE_TOKENS_EMOJI, GOLDEN_JOYSTICKS_EMOJI, COLORS } = require('./embeds');

const checkAndRunTutorial = async (interaction) => {
    const profile = getUserProfile(interaction.user.id);

    // If user exists and has completed tutorial, return true
    if (profile && profile.tutorialCompleted) {
        return true;
    }

    // If user doesn't exist, create profile
    if (!profile) {
        createUserProfile(interaction.user.id, interaction.user.username);
    }

    // Run tutorial
    await runTutorial(interaction);
    return false; // Tutorial was triggered, don't run the original command
};

const runTutorial = async (interaction) => {
    // Step 1: Welcome
    const step1Embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🎮 Welcome to Arcade Empire!')
        .setDescription(`Hello **${interaction.user.username}**! Welcome to the ultimate PvP gaming experience.\n\nLet me show you around the arcade!`)
        .setThumbnail('https://i.imgur.com/AfFp7pu.png')
        .setFooter({ text: 'Tutorial Step 1/4' });

    const step1Row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('tutorial_next_1')
                .setLabel('Let\'s Go!')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('▶️')
        );

    await interaction.reply({
        embeds: [step1Embed],
        components: [step1Row],
        ephemeral: true
    });

    // Create collector for tutorial navigation
    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 300000 // 5 minutes
    });

    collector.on('collect', async i => {
        if (i.customId === 'tutorial_next_1') {
            // Step 2: Currency System
            const step2Embed = new EmbedBuilder()
                .setColor(COLORS.GOLD)
                .setTitle('💰 Currency System')
                .setDescription('Arcade Empire uses two types of currency:')
                .addFields(
                    {
                        name: `${ARCADE_TOKENS_EMOJI} Arcade Tokens (AT)`,
                        value: 'The main currency used for betting in games. You start with **1,000 AT**!',
                        inline: false
                    },
                    {
                        name: `${GOLDEN_JOYSTICKS_EMOJI} Golden Joysticks (GJ)`,
                        value: 'Premium currency for special features (coming soon!)',
                        inline: false
                    }
                )
                .setFooter({ text: 'Tutorial Step 2/4' });

            const step2Row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tutorial_next_2')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️')
                );

            await i.update({ embeds: [step2Embed], components: [step2Row] });

        } else if (i.customId === 'tutorial_next_2') {
            // Step 3: Commands
            const step3Embed = new EmbedBuilder()
                .setColor(COLORS.INFO)
                .setTitle('📜 Essential Commands')
                .setDescription('Here are the commands you\'ll use most:')
                .addFields(
                    {
                        name: '/balance [user]',
                        value: 'Check your balance or another player\'s balance',
                        inline: false
                    },
                    {
                        name: '/rps <opponent> <wager>',
                        value: 'Challenge someone to Rock, Paper, Scissors',
                        inline: false
                    },
                    {
                        name: '/tictactoe <opponent> <wager>',
                        value: 'Challenge someone to Tic-Tac-Toe',
                        inline: false
                    }
                )
                .setFooter({ text: 'Tutorial Step 3/4' });

            const step3Row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tutorial_next_3')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️')
                );

            await i.update({ embeds: [step3Embed], components: [step3Row] });

        } else if (i.customId === 'tutorial_next_3') {
            // Step 4: Game Rules
            const step4Embed = new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setTitle('🎯 Game Rules & Payouts')
                .setDescription('When you win a game:')
                .addFields(
                    {
                        name: '💰 Payout System',
                        value: 'Winners receive **1.85x** their wager\n(Your bet back + 85% of opponent\'s bet)',
                        inline: false
                    },
                    {
                        name: '🏦 Arcade Fee',
                        value: 'The house keeps 15% to maintain the economy',
                        inline: false
                    },
                    {
                        name: '⏱️ Time Limits',
                        value: 'You have 30 seconds to accept challenges',
                        inline: false
                    }
                )
                .setFooter({ text: 'Tutorial Step 4/4' });

            const step4Row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tutorial_complete')
                        .setLabel('Complete Tutorial')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅')
                );

            await i.update({ embeds: [step4Embed], components: [step4Row] });

        } else if (i.customId === 'tutorial_complete') {
            // Complete tutorial
            completeTutorial(interaction.user.id);

            const completeEmbed = new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setTitle('🎉 Tutorial Complete!')
                .setDescription(`Congratulations **${interaction.user.username}**!\n\nYou've received **1,000 Arcade Tokens** to start your journey.\n\nGood luck in the arcade!`)
                .addFields(
                    {
                        name: 'Your Starting Balance',
                        value: `${ARCADE_TOKENS_EMOJI} **1,000** AT\n${GOLDEN_JOYSTICKS_EMOJI} **0** GJ`,
                        inline: true
                    }
                )
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Welcome to Arcade Empire!' })
                .setTimestamp();

            await i.update({ embeds: [completeEmbed], components: [] });
            collector.stop();
        }
    });

    collector.on('end', () => {
        // Clean up if tutorial times out
        if (!getUserProfile(interaction.user.id)?.tutorialCompleted) {
            interaction.editReply({
                content: 'Tutorial timed out. Use any command to restart the tutorial.',
                embeds: [],
                components: []
            }).catch(() => {});
        }
    });
};

module.exports = {
    checkAndRunTutorial
};
