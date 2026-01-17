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
    GatewayIntentBits.GuildMembers, // Added for better mention handling
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.User, // Added for DM support
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
  
  await registerCommands();
  console.log('Nitro Discord Bot is ready!');
});

// DIAGNOSTIC: Log when a guild becomes available
client.on(Events.GuildCreate, guild => {
  console.log(`\n[Diagnostic] Guild Available: ${guild.name} (${guild.id})`);
  
  // Find the 'nitro' channel and check permissions
  const nitroChannel = guild.channels.cache.find(c => c.name.toLowerCase() === 'nitro');
  if (nitroChannel && nitroChannel.isTextBased()) {
    const me = guild.members.me;
    if (me) {
      const perms = me.permissionsIn(nitroChannel);
      console.log(`[Diagnostic] My permissions in #nitro:`);
      console.log(`- View Channel: ${perms.has('ViewChannel')}`);
      console.log(`- Send Messages: ${perms.has('SendMessages')}`);
      console.log(`- Read History: ${perms.has('ReadMessageHistory')}`);
      console.log(`- Use Slash Commands: ${perms.has('UseApplicationCommands')}`);
    }
  } else {
    console.log(`[Diagnostic] Could not find #nitro channel in this guild.`);
    console.log(`[Diagnostic] Available channels: ${guild.channels.cache.filter(c => c.isTextBased()).map(c => c.name).join(', ')}`);
  }
});

// Event: Slash command interaction
client.on(Events.InteractionCreate, async interaction => {
  // LOG ALL INTERACTIONS
  console.log(`[Interaction] Type: ${interaction.type}, ID: ${interaction.id}`);
  
  if (!interaction.isChatInputCommand()) {
    console.log(`[Interaction] Non-command interaction detected:`, JSON.stringify(interaction).slice(0, 200));
  }

  if (!client.user) return;
  await handleInteraction(interaction, nitro, client.user.id);
});

// Event: Message (for mentions and DMs)
client.on(Events.MessageCreate, async message => {
  if (message.author.id === client.user?.id) return;
  
  // LOG ALL MESSAGES
  console.log(`[Message] From: ${message.author.tag}, Content: "${message.content}"`);
  
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

