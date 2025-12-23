import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js';
import type { NitroMCPClient } from '../nitro-client';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask Nitro AI a question')
  .addStringOption(option =>
    option
      .setName('question')
      .setDescription('The question to ask Nitro')
      .setRequired(true)
  )
  .addBooleanOption(option =>
    option
      .setName('thread')
      .setDescription('Create a thread for follow-up conversation')
      .setRequired(false)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  nitro: NitroMCPClient
): Promise<void> {
  const question = interaction.options.getString('question', true);
  const createThread = interaction.options.getBoolean('thread') ?? false;

  // Defer reply to show "thinking" indicator
  await interaction.deferReply();

  try {
    // Get user info for tracking
    const userId = interaction.user.id;
    const userTag = interaction.user.tag;

    console.log(`[/ask] User ${userTag} (${userId}) asked: ${question}`);

    // Ask Nitro
    const response = await nitro.ask(question, userId);

    // Handle Discord's 2000 character limit
    const chunks = splitMessage(response);

    // Send the first chunk as the reply
    const reply = await interaction.editReply(chunks[0]);

    // Send remaining chunks as follow-ups
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp(chunks[i]);
    }

    // Create a thread if requested
    if (createThread && interaction.channel?.type === ChannelType.GuildText) {
      const threadName = question.length > 97 
        ? question.slice(0, 97) + '...' 
        : question;
      
      const message = await interaction.fetchReply();
      await message.startThread({
        name: threadName,
        autoArchiveDuration: 60,
      });
    }

    console.log(`[/ask] Responded to ${userTag}`);
  } catch (error) {
    console.error('[/ask] Error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred';
    
    await interaction.editReply(
      `Sorry, I encountered an error while processing your question: ${errorMessage}`
    );
  }
}

/**
 * Split a message into chunks that fit Discord's 2000 character limit
 */
function splitMessage(text: string, maxLength: number = 2000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    
    // If no newline, try to split at a space
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    
    // If still no good split point, just cut at maxLength
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}

