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
  console.log('='.repeat(30));
  console.log(`✅ BOT CONNECTED: ${readyClient.user.tag}`);
  
  // LOG THE INTENTS GRANTED BY DISCORD
  const intentBits = Number(client.options.intents);
  console.log(`🔢 Intent Bitmask: ${intentBits}`);
  console.log(`📜 Has MessageContent Intent: ${(intentBits & Number(GatewayIntentBits.MessageContent)) !== 0}`);
  console.log('='.repeat(30));
  
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
  console.log(`[Event] Message received from ${message.author.tag}: ${message.content}`);
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

// Debug: Log all raw gateway packets
client.on('raw', packet => {
  if (packet.t) {
    console.log(`[Raw Gateway] Received Packet: ${packet.t}`);
  }
});

// Deep Debug: Log internal discord.js events
client.on('debug', info => {
  console.log(`[Discord.js Debug] ${info}`);
});

// Start the bot
console.log('--- DEBUG VERSION 2.0 STARTING ---');
client.login(DISCORD_TOKEN);

