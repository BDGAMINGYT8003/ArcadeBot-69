const { EmbedBuilder } = require('discord.js');

// Currency emojis
const ARCADE_TOKENS_EMOJI = '<:ArcadeTokens:1420147365213507686>';
const GOLDEN_JOYSTICKS_EMOJI = '<:GoldenJoysticks:1420147415868244148>';

// Standard embed colors
const COLORS = {
    PRIMARY: 0x7C3AED,
    SUCCESS: 0x10B981,
    ERROR: 0xEF4444,
    WARNING: 0xF59E0B,
    INFO: 0x3B82F6,
    GOLD: 0xFBBF24
};

// Create balance embed
const createBalanceEmbed = (user, profile) => {
    const winRate = profile.stats.gamesPlayed > 0
        ? ((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100).toFixed(1)
        : 0;

    return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('💰 Arcade Empire Balance')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
            {
                name: `${ARCADE_TOKENS_EMOJI} Arcade Tokens`,
                value: `**${profile.arcadeTokens.toLocaleString()}** AT`,
                inline: true
            },
            {
                name: `${GOLDEN_JOYSTICKS_EMOJI} Golden Joysticks`,
                value: `**${profile.goldenJoysticks.toLocaleString()}** GJ`,
                inline: true
            },
            {
                name: '📊 Statistics',
                value: `Games Played: **${profile.stats.gamesPlayed}**\nWin Rate: **${winRate}%**`,
                inline: false
            }
        )
        .setFooter({ text: `Player: ${user.username}` })
        .setTimestamp();
};

// Create challenge embed
const createChallengeEmbed = (game, challenger, opponent, wager) => {
    return new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle(`🎮 ${game} Challenge!`)
        .setDescription(`${challenger} has challenged ${opponent} to a game of **${game}**!`)
        .addFields(
            {
                name: `${ARCADE_TOKENS_EMOJI} Wager`,
                value: `**${wager.toLocaleString()}** AT`,
                inline: true
            },
            {
                name: '💰 Potential Payout',
                value: `**${Math.floor(wager * 1.85).toLocaleString()}** AT`,
                inline: true
            }
        )
        .setFooter({ text: 'Both players must accept within 30 seconds' })
        .setTimestamp();
};

// Create game result embed
const createGameResultEmbed = (game, winner, loser, payout) => {
    return new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`🏆 ${game} - Game Over!`)
        .setDescription(`**${winner.username}** defeats **${loser.username}**!`)
        .addFields(
            {
                name: '🏆 Winner',
                value: winner.username,
                inline: true
            },
            {
                name: `${ARCADE_TOKENS_EMOJI} Payout`,
                value: `**+${payout.toLocaleString()}** AT`,
                inline: true
            }
        )
        .setFooter({ text: '15% Arcade Fee has been deducted' })
        .setTimestamp();
};

// Create draw result embed
const createDrawEmbed = (game, player1, player2, wager) => {
    return new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`🤝 ${game} - Draw!`)
        .setDescription('The game ended in a draw! Wagers have been returned.')
        .addFields(
            {
                name: 'Players',
                value: `${player1.username} vs ${player2.username}`,
                inline: true
            },
            {
                name: `${ARCADE_TOKENS_EMOJI} Returned`,
                value: `**${wager.toLocaleString()}** AT`,
                inline: true
            }
        )
        .setTimestamp();
};

module.exports = {
    ARCADE_TOKENS_EMOJI,
    GOLDEN_JOYSTICKS_EMOJI,
    COLORS,
    createBalanceEmbed,
    createChallengeEmbed,
    createGameResultEmbed,
    createDrawEmbed
};
