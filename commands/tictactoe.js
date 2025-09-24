const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getUserProfile, updateUserBalance, updateGameStats } = require('../utils/database');
const { COLORS, ARCADE_TOKENS_EMOJI, createChallengeEmbed, createGameResultEmbed, createDrawEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Challenge someone to Tic-Tac-Toe')
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

        // Validation checks (same as RPS)
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

        // Create challenge
        const challengeEmbed = createChallengeEmbed('Tic-Tac-Toe', challenger, opponent, wager);

        const challengerRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`ttt_accept_challenger_${interaction.id}`)
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`ttt_decline_challenger_${interaction.id}`)
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

        // Initialize game data
        const gameData = {
            challenger: challenger,
            opponent: opponent,
            wager: wager,
            message: message,
            challengerAccepted: false,
            opponentAccepted: false,
            board: Array(9).fill(null),
            currentPlayer: challenger.id,
            playerSymbols: {
                [challenger.id]: 'X',
                [opponent.id]: 'O'
            },
            stage: 'challenger_confirm'
        };

        if (!module.exports.activeGames) {
            module.exports.activeGames = new Map();
        }
        module.exports.activeGames.set(interaction.id, gameData);

        // Timeout for challenger
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
        if (!interaction.customId.startsWith('ttt_')) return;

        const parts = interaction.customId.split('_');
        const action = parts[1];

        if (action === 'accept' || action === 'decline') {
            const role = parts[2];
            const gameId = parts.slice(3).join('_');
            const game = module.exports.activeGames?.get(gameId);
            if (!game) return;

            // Handle challenger confirmation
            if (role === 'challenger' && interaction.user.id === game.challenger.id) {
                if (action === 'accept') {
                    game.challengerAccepted = true;
                    game.stage = 'opponent_confirm';

                    client.activeInteractions.set(game.opponent.id, {
                        commandName: 'tictactoe',
                        timestamp: Date.now()
                    });

                    const opponentRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`ttt_accept_opponent_${gameId}`)
                                .setLabel('Accept')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('✅'),
                            new ButtonBuilder()
                                .setCustomId(`ttt_decline_opponent_${gameId}`)
                                .setLabel('Decline')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('❌')
                        );

                    await interaction.update({
                        content: `${game.opponent}, you have been challenged! Do you accept?`,
                        components: [opponentRow]
                    });

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

                } else {
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

                    // Start game
                    const gameEmbed = createTicTacToeEmbed(game);
                    const gameButtons = createTicTacToeButtons(game, gameId);

                    await interaction.update({
                        content: '',
                        embeds: [gameEmbed],
                        components: gameButtons
                    });

                } else {
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
        }

        // Handle game moves
        else if (action === 'move') {
            const position = parseInt(parts[2]);
            const gameId = parts.slice(3).join('_');
            const game = module.exports.activeGames?.get(gameId);

            if (!game || game.stage !== 'playing') return;

            // Check if it's the player's turn
            if (interaction.user.id !== game.currentPlayer) {
                await interaction.reply({
                    content: "It's not your turn!",
                    ephemeral: true
                });
                return;
            }

            // Make the move
            game.board[position] = game.playerSymbols[interaction.user.id];

            // Check for winner or draw
            const winner = checkWinner(game.board);

            if (winner) {
                let resultEmbed;

                if (winner === 'draw') {
                    // Return wagers
                    updateUserBalance(game.challenger.id, game.wager);
                    updateUserBalance(game.opponent.id, game.wager);
                    updateGameStats(game.challenger.id, false, game.wager);
                    updateGameStats(game.opponent.id, false, game.wager);

                    resultEmbed = createDrawEmbed('Tic-Tac-Toe', game.challenger, game.opponent, game.wager);
                } else {
                    const winnerUser = winner === 'X'
                        ? (game.playerSymbols[game.challenger.id] === 'X' ? game.challenger : game.opponent)
                        : (game.playerSymbols[game.challenger.id] === 'O' ? game.challenger : game.opponent);
                    const loserUser = winnerUser.id === game.challenger.id ? game.opponent : game.challenger;
                    const payout = Math.floor(game.wager * 1.85);

                    updateUserBalance(winnerUser.id, payout);
                    updateGameStats(winnerUser.id, true, game.wager, payout - game.wager);
                    updateGameStats(loserUser.id, false, game.wager);

                    resultEmbed = createGameResultEmbed('Tic-Tac-Toe', winnerUser, loserUser, payout);
                }

                // Show final board
                const finalBoard = createFinalBoard(game);
                resultEmbed.addFields({
                    name: 'Final Board',
                    value: finalBoard,
                    inline: false
                });

                await interaction.update({
                    embeds: [resultEmbed],
                    components: []
                });

                module.exports.activeGames.delete(gameId);
                client.activeInteractions.delete(game.challenger.id);
                client.activeInteractions.delete(game.opponent.id);
            } else {
                // Switch turns
                game.currentPlayer = game.currentPlayer === game.challenger.id
                    ? game.opponent.id
                    : game.challenger.id;

                const gameEmbed = createTicTacToeEmbed(game);
                const gameButtons = createTicTacToeButtons(game, gameId);

                await interaction.update({
                    embeds: [gameEmbed],
                    components: gameButtons
                });
            }
        }
    }
};

function createTicTacToeEmbed(game) {
    const currentPlayerUser = game.currentPlayer === game.challenger.id ? game.challenger : game.opponent;
    const board = game.board.map(cell => cell || '⬛').join('');

    return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🎮 Tic-Tac-Toe')
        .setDescription(`Current Turn: **${currentPlayerUser.username}** (${game.playerSymbols[game.currentPlayer]})`)
        .addFields(
            {
                name: 'Players',
                value: `${game.challenger.username} (X) vs ${game.opponent.username} (O)`,
                inline: true
            },
            {
                name: `${ARCADE_TOKENS_EMOJI} Wager`,
                value: `**${game.wager.toLocaleString()}** AT`,
                inline: true
            }
        )
        .setTimestamp();
}

function createTicTacToeButtons(game, gameId) {
    const rows = [];

    for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) {
            const position = i * 3 + j;
            const cell = game.board[position];

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ttt_move_${position}_${gameId}`)
                    .setLabel(cell || '\u200b')
                    .setStyle(cell ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    .setDisabled(cell !== null || game.currentPlayer === null)
                    .setEmoji(cell === 'X' ? '❌' : cell === 'O' ? '⭕' : '⬜')
            );
        }
        rows.push(row);
    }

    return rows;
}

function createFinalBoard(game) {
    let board = '';
    for (let i = 0; i < 9; i++) {
        const cell = game.board[i];
        board += cell === 'X' ? '❌' : cell === 'O' ? '⭕' : '⬜';
        if ((i + 1) % 3 === 0 && i < 8) board += '\n';
    }
    return board;
}

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    if (board.every(cell => cell !== null)) {
        return 'draw';
    }

    return null;
}
