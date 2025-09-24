const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Replit Secrets
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Create client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Collections for commands and active interactions
client.commands = new Collection();
client.activeInteractions = new Map();

// Load commands dynamically
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

// Register slash commands globally on startup
const deployCommands = async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

        const data = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
};

// Ready event
client.once('ready', async () => {
    console.log(`🎮 Arcade Empire is online! Logged in as ${client.user.tag}`);

    // Deploy commands on startup
    await deployCommands();

    // Set bot status
    client.user.setActivity('🎮 /balance | Arcade Empire', { type: 'PLAYING' });
});

// Interaction handler
client.on('interactionCreate', async interaction => {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        // Check if user is already in an active interaction (concurrency control)
        if (client.activeInteractions.has(interaction.user.id)) {
            const { EmbedBuilder } = require('discord.js');
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Active Command Detected')
                .setDescription('You are already in an active command. Please complete or cancel it before starting a new one.')
                .setTimestamp();

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        try {
            // Check for tutorial requirement
            const { checkAndRunTutorial } = require('./utils/tutorial');
            const tutorialCompleted = await checkAndRunTutorial(interaction);

            if (!tutorialCompleted) {
                // Tutorial was triggered, don't execute the command
                return;
            }

            // Mark user as having an active interaction
            client.activeInteractions.set(interaction.user.id, {
                commandName: interaction.commandName,
                timestamp: Date.now()
            });

            // Execute the command
            await command.execute(interaction, client);

        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);

            const { EmbedBuilder } = require('discord.js');
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Command Error')
                .setDescription('There was an error while executing this command.')
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }

    // Pass all other interactions to commands for handling
    else if (interaction.isButton() || interaction.isSelectMenu() || interaction.isModalSubmit()) {
        // Find the command that should handle this interaction
        for (const command of client.commands.values()) {
            if (command.handleInteraction) {
                await command.handleInteraction(interaction, client);
            }
        }
    }
});

// Clean up stale active interactions periodically (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [userId, data] of client.activeInteractions.entries()) {
        if (now - data.timestamp > timeout) {
            client.activeInteractions.delete(userId);
        }
    }
}, 60000); // Check every minute

// Login to Discord
client.login(BOT_TOKEN);
