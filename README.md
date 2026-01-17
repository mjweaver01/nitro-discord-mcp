# Nitro Discord Bot

A Discord bot that integrates with Nitro AI chatbot via MCP (Model Context Protocol).

## Features

- **Slash Commands**: Use `/ask` to ask Nitro AI questions
- **Mentions**: Mention the bot (@Nitro) in any channel to ask questions
- **Thread Support**: Create threads for follow-up conversations
- **Typing Indicator**: Shows typing indicator while Nitro is processing
- **User Tracking**: Passes Discord user ID to Nitro for context

## Prerequisites

- [Bun](https://bun.sh) runtime
- A Discord bot token
- Nitro MCP server access

## Setup

### 1. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section and click "Add Bot"
4. Under "Privileged Gateway Intents", enable:
   - **Message Content Intent** (Required for reading mentions and message content)
5. Under "Installation", ensure **Guild Install** is configured with the `bot` and `applications.commands` scopes.
6. Copy the bot token (you'll need this for `DISCORD_TOKEN`)
7. Go to "OAuth2" → "General" and copy the Client ID (for `DISCORD_CLIENT_ID`)

### 2. Invite the Bot to Your Server

1. Go to "Installation" or "OAuth2"
2. Select scopes: `bot`, `applications.commands`
3. Select bot permissions:
   - View Channels
   - Send Messages
   - Read Message History
   - Use Slash Commands
   - Create Public Threads
   - Create Private Threads
   - Send Messages in Threads
4. Copy the generated URL and open it in your browser to invite the bot

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_application_id_here

# Nitro MCP Configuration
NITRO_BASE_URL=https://your-nitro-mcp-server.com
NITRO_API_KEY=your_nitro_api_key_here
```

### 4. Install Dependencies

```bash
bun install
```

### 5. Run the Bot

```bash
# Development mode (with auto-reload)
bun dev

# Production mode
bun start
```

## Usage

### Slash Command

```
/ask question:What is the capital of France?
/ask question:Tell me about TypeScript thread:true
```

Options:
- `question` (required): The question to ask Nitro
- `thread` (optional): Set to `true` to create a thread for follow-up

### Mentions

Simply mention the bot in any message:

```
@Nitro What is the meaning of life?
```

In threads where the bot has been mentioned, it will automatically respond to all messages.

## Project Structure

```
nitro-discord/
├── src/
│   ├── index.ts           # Main entry point, Discord client setup
│   ├── nitro-client.ts    # Nitro MCP client
│   ├── commands/
│   │   └── ask.ts         # /ask slash command handler
│   └── handlers/
│       ├── message.ts     # Mention handler
│       └── interaction.ts # Slash command dispatcher
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT

