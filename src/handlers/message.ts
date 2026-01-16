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
    console.log('[Debug] Channel does not support message fetching');
    return [];
  }

  try {
    console.log(`[Debug] Fetching up to ${limit} messages for conversation history`);
    
    // Fetch recent messages before the current one
    const messages = await channel.messages.fetch({ 
      limit, 
      before: message.id 
    });

    console.log(`[Debug] Fetched ${messages.size} messages`);

    // Convert to array and reverse to get chronological order
    const sortedMessages = [...messages.values()].reverse();

    // Remove the bot mention pattern for cleaner history
    const mentionPattern = new RegExp(`<@!?${botId}>`, 'g');

    // Format messages for Nitro
    const history: NitroMessage[] = sortedMessages
      .filter(msg => {
        // Skip bot messages from other bots
        if (msg.author.bot && msg.author.id !== botId) {
          return false;
        }
        
        // Include all bot messages and user messages with content
        const content = msg.content.replace(mentionPattern, '').trim();
        
        // Include the message if:
        // - It's from the bot (always include bot responses)
        // - It has content after removing mentions
        const shouldInclude = msg.author.id === botId || content.length > 0;
        
        if (!shouldInclude) {
          console.log(`[Debug] Filtering out message from ${msg.author.tag}: empty after mention removal`);
        }
        
        return shouldInclude;
      })
      .map(msg => {
        const cleanContent = msg.content.replace(mentionPattern, '').trim();
        return {
          role: msg.author.id === botId ? 'assistant' as const : 'user' as const,
          content: cleanContent || msg.content.trim(), // Fallback to original if empty after mention removal
        };
      });

    console.log(`[Debug] Formatted ${history.length} messages for conversation history`);
    
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
  
  // Check if this is a reply to one of the bot's messages
  let isReplyToBot = false;
  if (message.reference) {
    try {
      const referencedMessage = await message.fetchReference();
      isReplyToBot = referencedMessage.author.id === botId;
      console.log(`[Debug] Message is a reply to bot: ${isReplyToBot}`);
    } catch (error) {
      console.log('[Debug] Could not fetch referenced message:', error);
    }
  }

  console.log(`[Debug] Message check - Mentioned: ${isMentioned}, InThread: ${isInThread}, DM: ${isDM}, ReplyToBot: ${isReplyToBot}`);

  // Respond if: mentioned in a channel, in a participating thread, in DMs, OR replying to bot
  if (!isMentioned && !isInThread && !isDM && !isReplyToBot) {
    console.log('[Debug] Ignoring message - no trigger conditions met');
    return;
  }

  // If in a thread but not mentioned and not replying to bot, check if bot has participated before
  if (isInThread && !isMentioned && !isReplyToBot) {
    // For threads, we'll respond to all messages once we've been mentioned once
    // This creates a conversational experience in threads
    const thread = message.channel;
    
    console.log(`[Debug] In thread, checking participation...`);
    
    // Check if we've already joined/participated in this thread
    const messages = await thread.messages.fetch({ limit: 50 });
    const botHasParticipated = messages.some(m => m.author.id === botId);
    
    if (!botHasParticipated) {
      console.log('[Debug] Bot has not participated in this thread, ignoring');
      return;
    }
    
    console.log('[Debug] Bot has participated in thread, will respond');
  }

  // Extract the question by removing the bot mention
  const mentionPattern = new RegExp(`<@!?${botId}>`, 'g');
  const question = message.content.replace(mentionPattern, '').trim();

  console.log(`[Debug] Extracted question: "${question}" (original: "${message.content}")`);

  // Ignore empty messages
  if (!question) {
    console.log('[Debug] Empty question, sending greeting');
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
    // - User is replying to the bot specifically
    const isReply = !!message.reference;
    const shouldIncludeHistory = isInThread || isReply || isReplyToBot;

    console.log(`[Debug] Should include history: ${shouldIncludeHistory} (isInThread: ${isInThread}, isReply: ${isReply}, isReplyToBot: ${isReplyToBot})`);

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

