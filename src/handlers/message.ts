import { Message, ChannelType } from 'discord.js';
import type { NitroMCPClient, NitroMessage } from '../nitro-client';

/**
 * Fetch conversation history from the channel
 * Returns messages formatted for Nitro AI
 */
async function getConversationHistory(
  message: Message,
  botId: string,
  limit: number = 20
): Promise<NitroMessage[]> {
  const channel = message.channel;
  
  // Check if channel supports fetching messages
  if (!('messages' in channel)) {
    return [];
  }

  try {
    // Fetch recent messages before the current one
    const messages = await channel.messages.fetch({ 
      limit, 
      before: message.id 
    });

    // Convert to array and reverse to get chronological order
    const sortedMessages = [...messages.values()].reverse();

    // Remove the bot mention pattern for cleaner history
    const mentionPattern = new RegExp(`<@!?${botId}>`, 'g');

    // Format messages for Nitro
    const history: NitroMessage[] = sortedMessages
      .filter(msg => {
        // Include messages from the bot or messages that mention/interact with the bot
        const content = msg.content.replace(mentionPattern, '').trim();
        return content.length > 0;
      })
      .map(msg => ({
        role: msg.author.id === botId ? 'assistant' as const : 'user' as const,
        content: msg.content.replace(mentionPattern, '').trim(),
      }));

    return history;
  } catch (error) {
    console.error('Failed to fetch conversation history:', error);
    return [];
  }
}

/**
 * Handle messages where the bot is mentioned
 */
export async function handleMessage(
  message: Message,
  nitro: NitroMCPClient,
  botId: string
): Promise<void> {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if the bot is mentioned
  const isMentioned = message.mentions.users.has(botId);
  const isInThread = message.channel.type === ChannelType.PublicThread ||
                     message.channel.type === ChannelType.PrivateThread;
  const isDM = message.channel.type === ChannelType.DM;

  // Respond if: mentioned in a channel, in a participating thread, or in DMs
  if (!isMentioned && !isInThread && !isDM) return;

  // If in a thread but not mentioned, check if bot has participated before
  if (isInThread && !isMentioned) {
    // For threads, we'll respond to all messages once we've been mentioned once
    // This creates a conversational experience in threads
    const thread = message.channel;
    const starterMessage = await thread.fetchStarterMessage().catch(() => null);
    
    // Only auto-respond in threads if the starter message mentions the bot
    // or if the bot has already sent a message in this thread
    const messages = await thread.messages.fetch({ limit: 50 });
    const botHasParticipated = messages.some(m => m.author.id === botId);
    
    if (!botHasParticipated) return;
  }

  // Extract the question by removing the bot mention
  const mentionPattern = new RegExp(`<@!?${botId}>`, 'g');
  const question = message.content.replace(mentionPattern, '').trim();

  // Ignore empty messages
  if (!question) {
    await message.reply("Hi! Ask me anything and I'll help you out.");
    return;
  }

  try {
    // Show typing indicator (check if channel supports it)
    const channel = message.channel;
    if ('sendTyping' in channel) {
      await channel.sendTyping();
    }

    // Keep typing indicator active for longer responses
    const typingInterval = setInterval(() => {
      if ('sendTyping' in channel) {
        channel.sendTyping().catch(() => {});
      }
    }, 5000);

    console.log(`[@mention] User ${message.author.tag} asked: ${question}`);

    // Only fetch conversation history if:
    // - In a thread (always include context)
    // - User is replying to a message (has message.reference)
    const isReply = !!message.reference;
    const shouldIncludeHistory = isInThread || isReply;

    let conversationHistory: NitroMessage[] = [];
    if (shouldIncludeHistory) {
      conversationHistory = await getConversationHistory(message, botId);
      console.log(`[@mention] Including ${conversationHistory.length} previous messages for context`);
    }

    // Ask Nitro with user tracking and conversation history
    const response = await nitro.ask(question, message.author.id, undefined, conversationHistory);

    // Clear typing indicator
    clearInterval(typingInterval);

    // Handle Discord's 2000 character limit
    const chunks = splitMessage(response);

    // Reply with the first chunk
    await message.reply(chunks[0]);

    // Send remaining chunks as follow-ups
    for (let i = 1; i < chunks.length; i++) {
      if ('send' in channel) {
        await channel.send(chunks[i]);
      }
    }

    console.log(`[@mention] Responded to ${message.author.tag}`);
  } catch (error) {
    console.error('[@mention] Error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred';
    
    await message.reply(
      `Sorry, I encountered an error: ${errorMessage}`
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

