const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getUserProfile, updateUserBalance, updateGameStats } = require('../utils/database');
const { COLORS, ARCADE_TOKENS_EMOJI, createChallengeEmbed, createGameResultEmbed, createDrawEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Challenge someone to Rock Paper Scissors')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('The user to challenge')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('wager')
                .setDescription('Amount of Arcade Tokens to wager (1-25,000)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(25000)),

    async execute(interaction, client) {
        const opponent = interaction.options.getUser('opponent');
        const wager = interaction.options.getInteger('wager');
        const challenger = interaction.user;

        // Validation checks
        if (opponent.id === challenger.id) {
            const errorEmbed = new EmbedBuilder()
                .setColor(COLORS.ERROR)
                .setTitle('❌ Invalid Challenge')
                .setDescription('You cannot challenge yourself!')
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            client.activeInteractions.delete(interaction.user.id);
            return;
        }

        if (opponent.bot) {
            const errorEmbed = new EmbedBuilder()
                .setColor(COLORS.ERROR)
                .setTitle('❌ Invalid Challenge')
                .setDescription('You cannot challenge a bot!')
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            client.activeInteractions.delete(interaction.user.id);
            return;
        }

        // Check if opponent is in an active interaction
        if (client.activeInteractions.has(opponent.id)) {
            const errorEmbed = new EmbedBuilder()
                .setColor(COLORS.ERROR)
                .setTitle('❌ Opponent Busy')
                .setDescription(`${opponent.username} is currently in another command. Try again later!`)
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            client.activeInteractions.delete(interaction.user.id);
            return;
        }

        // Check balances
        const challengerProfile = getUserProfile(challenger.id);
        const opponentProfile = getUserProfile(opponent.id);

        if (!opponentProfile) {
            const errorEmbed = new EmbedBuilder()
                .setColor(COLORS.ERROR)
                .setTitle('❌ Profile Not Found')
                .setDescription(`${opponent.username} hasn't joined Arcade Empire yet!`)
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            client.activeInteractions.delete(interaction.user.id);
            return;
        }

        if (challengerProfile.arcadeTokens < wager) {
            const errorEmbed = new EmbedBuilder()
                .setColor(COLORS.ERROR)
                .setTitle('❌ Insufficient Balance')
                .setDescription(`You don't have enough Arcade Tokens!\n\nYour balance: ${ARCADE_TOKENS_EMOJI} **${challengerProfile.arcadeTokens}** AT`)
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            client.activeInteractions.delete(interaction.user.id);
            return;
        }

        if (opponentProfile.arcadeTokens < wager) {
            const errorEmbed = new EmbedBuilder()
                .setColor(COLORS.ERROR)
                .setTitle('❌ Opponent Insufficient Balance')
                .setDescription(`${opponent.username} doesn't have enough Arcade Tokens for this wager!`)
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            client.activeInteractions.delete(interaction.user.id);
            return;
        }

        // Create challenge embed and buttons
        const challengeEmbed = createChallengeEmbed('Rock Paper Scissors', challenger, opponent, wager);

        const challengerRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`rps_accept_challenger_${interaction.id}`)
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`rps_decline_challenger_${interaction.id}`)
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

        const message = await interaction.reply({
            content: `${challenger}, confirm your challenge:`,
            embeds: [challengeEmbed],
            components: [challengerRow],
            fetchReply: true
        });

        // Store game data
        const gameData = {
            challenger: challenger,
            opponent: opponent,
            wager: wager,
            message: message,
            challengerAccepted: false,
            opponentAccepted: false,
            challengerChoice: null,
            opponentChoice: null,
            stage: 'challenger_confirm'
        };

        // Store in module scope for access in handleInteraction
        if (!module.exports.activeGames) {
            module.exports.activeGames = new Map();
        }
        module.exports.activeGames.set(interaction.id, gameData);

        // Add opponent to active interactions when challenger accepts

        // Set timeout for challenger confirmation
        setTimeout(async () => {
            const game = module.exports.activeGames.get(interaction.id);
            if (game && game.stage === 'challenger_confirm') {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setTitle('⏱️ Challenge Timeout')
                    .setDescription('The challenge was not confirmed in time.')
                    .setTimestamp();

                await message.edit({
                    content: '',
                    embeds: [timeoutEmbed],
                    components: []
                });

                module.exports.activeGames.delete(interaction.id);
                client.activeInteractions.delete(challenger.id);
            }
        }, 30000);
    },

    async handleInteraction(interaction, client) {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('rps_')) return;

        const parts = interaction.customId.split('_');
        const action = parts[1];
        const role = parts[2];
        const gameId = parts.slice(3).join('_');

        const game = module.exports.activeGames?.get(gameId);
        if (!game) return;

        // Handle challenger confirmation
        if (role === 'challenger' && interaction.user.id === game.challenger.id) {
            if (action === 'accept') {
                game.challengerAccepted = true;
                game.stage = 'opponent_confirm';

                // Add opponent to active interactions
                client.activeInteractions.set(game.opponent.id, {
                    commandName: 'rps',
                    timestamp: Date.now()
                });

                const opponentRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`rps_accept_opponent_${gameId}`)
                            .setLabel('Accept')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅'),
                        new ButtonBuilder()
                            .setCustomId(`rps_decline_opponent_${gameId}`)
                            .setLabel('Decline')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                    );

                await interaction.update({
                    content: `${game.opponent}, you have been challenged! Do you accept?`,
                    components: [opponentRow]
                });

                // Set timeout for opponent
                setTimeout(async () => {
                    if (game.stage === 'opponent_confirm') {
                        const timeoutEmbed = new EmbedBuilder()
                            .setColor(COLORS.ERROR)
                            .setTitle('⏱️ Challenge Timeout')
                            .setDescription(`${game.opponent.username} did not respond in time.`)
                            .setTimestamp();

                        await game.message.edit({
                            content: '',
                            embeds: [timeoutEmbed],
                            components: []
                        });

                        module.exports.activeGames.delete(gameId);
                        client.activeInteractions.delete(game.challenger.id);
                        client.activeInteractions.delete(game.opponent.id);
                    }
                }, 30000);

            } else if (action === 'decline') {
                const declineEmbed = new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setTitle('❌ Challenge Declined')
                    .setDescription(`${game.challenger.username} declined their own challenge.`)
                    .setTimestamp();

                await interaction.update({
                    content: '',
                    embeds: [declineEmbed],
                    components: []
                });

                module.exports.activeGames.delete(gameId);
                client.activeInteractions.delete(game.challenger.id);
            }
        }

        // Handle opponent confirmation
        else if (role === 'opponent' && interaction.user.id === game.opponent.id) {
            if (action === 'accept') {
                game.opponentAccepted = true;
                game.stage = 'playing';

                // Deduct wagers
                updateUserBalance(game.challenger.id, -game.wager);
                updateUserBalance(game.opponent.id, -game.wager);

                // Start the game
                const gameEmbed = new EmbedBuilder()
                    .setColor(COLORS.PRIMARY)
                    .setTitle('🎮 Rock Paper Scissors - Game Started!')
                    .setDescription('Check your DMs to make your choice!\n\nBoth players must choose within 30 seconds.')
                    .addFields(
                        { name: 'Player 1', value: game.challenger.username, inline: true },
                        { name: 'Player 2', value: game.opponent.username, inline: true },
                        { name: `${ARCADE_TOKENS_EMOJI} Wager`, value: `**${game.wager.toLocaleString()}** AT`, inline: true }
                    )
                    .setTimestamp();

                await interaction.update({
                    content: '',
                    embeds: [gameEmbed],
                    components: []
                });

                // Send choice buttons to players via ephemeral follow-up
                const choiceRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`rps_choice_rock_${gameId}`)
                            .setLabel('Rock')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🪨'),
                        new ButtonBuilder()
                            .setCustomId(`rps_choice_paper_${gameId}`)
                            .setLabel('Paper')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📄'),
                        new ButtonBuilder()
                            .setCustomId(`rps_choice_scissors_${gameId}`)
                            .setLabel('Scissors')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('✂️')
                    );

                const choiceEmbed = new EmbedBuilder()
                    .setColor(COLORS.INFO)
                    .setTitle('🎮 Make Your Choice!')
                    .setDescription('Select your move below. You have 30 seconds!')
                    .setTimestamp();

                // Send to challenger
                await interaction.followUp({
                    embeds: [choiceEmbed],
                    components: [choiceRow],
                    ephemeral: true
                });

                // Send to opponent
                await game.message.channel.send({
                    content: `${game.challenger}`,
                    embeds: [choiceEmbed],
                    components: [choiceRow],
                    ephemeral: false
                }).then(msg => {
                    setTimeout(() => msg.delete().catch(() => {}), 30000);
                });

                // Game timeout
                setTimeout(async () => {
                    if (game.stage === 'playing') {
                        let result;
                        if (!game.challengerChoice && !game.opponentChoice) {
                            // Both timed out - draw
                            updateUserBalance(game.challenger.id, game.wager);
                            updateUserBalance(game.opponent.id, game.wager);

                            const drawEmbed = createDrawEmbed('Rock Paper Scissors', game.challenger, game.opponent, game.wager);
                            drawEmbed.setDescription('Both players timed out! Wagers have been returned.');

                            result = drawEmbed;
                        } else if (!game.challengerChoice) {
                            // Challenger timed out
                            const payout = Math.floor(game.wager * 1.85);
                            updateUserBalance(game.opponent.id, payout);
                            updateGameStats(game.opponent.id, true, game.wager, payout - game.wager);
                            updateGameStats(game.challenger.id, false, game.wager);

                            result = createGameResultEmbed('Rock Paper Scissors', game.opponent, game.challenger, payout);
                            result.setDescription(`${game.challenger.username} timed out! ${game.opponent.username} wins by default!`);
                        } else if (!game.opponentChoice) {
                            // Opponent timed out
                            const payout = Math.floor(game.wager * 1.85);
                            updateUserBalance(game.challenger.id, payout);
                            updateGameStats(game.challenger.id, true, game.wager, payout - game.wager);
                            updateGameStats(game.opponent.id, false, game.wager);

                            result = createGameResultEmbed('Rock Paper Scissors', game.challenger, game.opponent, payout);
                            result.setDescription(`${game.opponent.username} timed out! ${game.challenger.username} wins by default!`);
                        }

                        if (result) {
                            await game.message.edit({ embeds: [result] });
                            module.exports.activeGames.delete(gameId);
                            client.activeInteractions.delete(game.challenger.id);
                            client.activeInteractions.delete(game.opponent.id);
                        }
                    }
                }, 30000);

            } else if (action === 'decline') {
                const declineEmbed = new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setTitle('❌ Challenge Declined')
                    .setDescription(`${game.opponent.username} declined the challenge.`)
                    .setTimestamp();

                await interaction.update({
                    content: '',
                    embeds: [declineEmbed],
                    components: []
                });

                module.exports.activeGames.delete(gameId);
                client.activeInteractions.delete(game.challenger.id);
                client.activeInteractions.delete(game.opponent.id);
            }
        }

        // Handle game choices
        else if (action === 'choice' && game.stage === 'playing') {
            const choice = role; // rock, paper, or scissors

            if (interaction.user.id === game.challenger.id && !game.challengerChoice) {
                game.challengerChoice = choice;
                await interaction.reply({
                    content: `You chose **${choice}**! Waiting for opponent...`,
                    ephemeral: true
                });
            } else if (interaction.user.id === game.opponent.id && !game.opponentChoice) {
                game.opponentChoice = choice;
                await interaction.reply({
                    content: `You chose **${choice}**! Waiting for opponent...`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: 'You have already made your choice!',
                    ephemeral: true
                });
                return;
            }

            // Check if both players have chosen
            if (game.challengerChoice && game.opponentChoice) {
                // Determine winner
                const winner = determineRPSWinner(game.challengerChoice, game.opponentChoice);

                let resultEmbed;
                if (winner === 'draw') {
                    // Return wagers
                    updateUserBalance(game.challenger.id, game.wager);
                    updateUserBalance(game.opponent.id, game.wager);
                    updateGameStats(game.challenger.id, false, game.wager);
                    updateGameStats(game.opponent.id, false, game.wager);

                    resultEmbed = createDrawEmbed('Rock Paper Scissors', game.challenger, game.opponent, game.wager);
                    resultEmbed.addFields(
                        { name: `${game.challenger.username}'s Choice`, value: game.challengerChoice, inline: true },
                        { name: `${game.opponent.username}'s Choice`, value: game.opponentChoice, inline: true }
                    );
                } else {
                    const winnerUser = winner === 'player1' ? game.challenger : game.opponent;
                    const loserUser = winner === 'player1' ? game.opponent : game.challenger;
                    const payout = Math.floor(game.wager * 1.85);

                    updateUserBalance(winnerUser.id, payout);
                    updateGameStats(winnerUser.id, true, game.wager, payout - game.wager);
                    updateGameStats(loserUser.id, false, game.wager);

                    resultEmbed = createGameResultEmbed('Rock Paper Scissors', winnerUser, loserUser, payout);
                    resultEmbed.addFields(
                        { name: `${game.challenger.username}'s Choice`, value: game.challengerChoice, inline: true },
                        { name: `${game.opponent.username}'s Choice`, value: game.opponentChoice, inline: true }
                    );
                }

                await game.message.edit({ embeds: [resultEmbed] });

                module.exports.activeGames.delete(gameId);
                client.activeInteractions.delete(game.challenger.id);
                client.activeInteractions.delete(game.opponent.id);
            }
        }
    }
};

function determineRPSWinner(choice1, choice2) {
    if (choice1 === choice2) return 'draw';

    const wins = {
        'rock': 'scissors',
        'paper': 'rock',
        'scissors': 'paper'
    };

    return wins[choice1] === choice2 ? 'player1' : 'player2';
}
