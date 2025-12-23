import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import type { NitroMCPClient } from '../nitro-client';
import * as askCommand from '../commands/ask';

// Command registry
const commands = new Map<string, typeof askCommand>();
commands.set(askCommand.data.name, askCommand);

/**
 * Handle slash command interactions
 */
export async function handleInteraction(
  interaction: Interaction,
  nitro: NitroMCPClient
): Promise<void> {
  // Only handle slash commands
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction, nitro);
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

