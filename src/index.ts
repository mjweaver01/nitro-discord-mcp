import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Events,
} from 'discord.js';
import { NitroMCPClient } from './nitro-client';
import { handleMessage } from './handlers/message';
import { handleInteraction, getCommandsData } from './handlers/interaction';

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN environment variable is required');
}

if (!process.env.DISCORD_CLIENT_ID) {
  throw new Error('DISCORD_CLIENT_ID environment variable is required');
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

// Initialize the Nitro MCP client
const nitro = new NitroMCPClient();

// Create Discord client with required intents and partials
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
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
  if (!client.user) return;
  await handleInteraction(interaction, nitro, client.user.id);
});

// Event: Message (for mentions and DMs)
client.on(Events.MessageCreate, async message => {
  const isSelf = message.author.id === client.user?.id;
  if (isSelf) return;

  console.log(`[Event] Message received!`);
  console.log(`- From: ${message.author.tag} (${message.author.id})`);
  console.log(`- Channel: ${message.channel.name || 'DM'} (${message.channel.id})`);
  console.log(`- Type: ${message.channel.type}`);
  console.log(`- Content: ${message.content}`);
  console.log(`- Mentions Bot: ${message.mentions.users.has(client.user?.id || '')}`);
  
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

