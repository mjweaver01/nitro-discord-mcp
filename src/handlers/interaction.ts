import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import type { NitroMCPClient } from '../nitro-client';
import * as askCommand from '../commands/ask';
import { defaultRateLimiter } from '../utils/rate-limiter';

// Command registry
const commands = new Map<string, typeof askCommand>();
commands.set(askCommand.data.name, askCommand);

/**
 * Handle slash command interactions
 */
export async function handleInteraction(
  interaction: Interaction,
  nitro: NitroMCPClient,
  botId: string
): Promise<void> {
  // Only handle slash commands
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`Unknown command: ${interaction.commandName}`);
    return;
  }

  // Rate limiting check
  const rateLimit = defaultRateLimiter.check(interaction.user.id);
  if (!rateLimit.allowed) {
    const waitSeconds = Math.ceil(rateLimit.resetMs / 1000);
    const message = 
      `You've reached your rate limit! Please wait about ${waitSeconds} second${waitSeconds === 1 ? '' : 's'} before trying again.\n\n` +
      `💡 **Want unlimited access?** Use the full app at https://nitro.westside-barbell.com`;
    
    await interaction.reply({ content: message, ephemeral: true });
    return;
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction, nitro, botId);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);

    const errorMessage = 'There was an error executing this command.';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Get all command data for registration
 */
export function getCommandsData() {
  return Array.from(commands.values()).map(cmd => cmd.data.toJSON());
}

