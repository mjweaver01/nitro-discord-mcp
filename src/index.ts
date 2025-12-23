import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
} from 'discord.js';
import { NitroMCPClient } from './nitro-client';
import { handleMessage } from './handlers/message';
import { handleInteraction, getCommandsData } from './handlers/interaction';

// Validate environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN environment variable is required');
}

if (!DISCORD_CLIENT_ID) {
  throw new Error('DISCORD_CLIENT_ID environment variable is required');
}

// Initialize the Nitro MCP client
const nitro = new NitroMCPClient();

// Create Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

/**
 * Register slash commands with Discord
 */
async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(DISCORD_TOKEN);
  const commands = getCommandsData();

  console.log(`Registering ${commands.length} slash command(s)...`);

  try {
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
      body: commands,
    });
    console.log('Successfully registered slash commands');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    throw error;
  }
}

// Event: Bot is ready
client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  
  // Register slash commands on startup
  await registerCommands();
  
  console.log('Nitro Discord Bot is ready!');
});

// Event: Slash command interaction
client.on(Events.InteractionCreate, async interaction => {
  await handleInteraction(interaction, nitro);
});

// Event: Message (for mentions)
client.on(Events.MessageCreate, async message => {
  if (!client.user) return;
  await handleMessage(message, nitro, client.user.id);
});

// Error handling
client.on(Events.Error, error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Start the bot
console.log('Starting Nitro Discord Bot...');
client.login(DISCORD_TOKEN);

