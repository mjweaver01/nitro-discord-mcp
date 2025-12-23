// Types for MCP JSON-RPC protocol
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: MCPSchemaProperty;
  properties?: Record<string, MCPSchemaProperty>;
}

interface MCPTool {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, MCPSchemaProperty>;
    required: string[];
    additionalProperties: boolean;
  };
}

export interface NitroMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface NitroQuestion {
  question: string;
  user_id?: string;
  email?: string;
  model?: string;
  messages?: NitroMessage[];
}

interface NitroResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

interface SSEData {
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export class NitroMCPClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.NITRO_BASE_URL || '';
    this.apiKey = process.env.NITRO_API_KEY || '';

    if (!this.baseUrl || !this.apiKey) {
      throw new Error('NITRO_BASE_URL and NITRO_API_KEY environment variables are required');
    }
  }

  /**
   * Parse Server-Sent Events response
   */
  private parseSSEResponse(text: string): unknown {
    const lines = text.split('\n');
    let lastData: SSEData | null = null;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.substring(6).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            lastData = JSON.parse(dataStr) as SSEData;
          } catch {
            console.error('Failed to parse SSE data:', dataStr);
          }
        }
      }
    }

    if (lastData) {
      // Check if it's an MCP response format
      if (lastData.result) {
        return lastData.result;
      }
      if (lastData.error) {
        throw new Error(
          `MCP Error ${lastData.error.code}: ${lastData.error.message}`
        );
      }
      return lastData;
    }

    throw new Error('No valid data found in SSE response');
  }

  /**
   * Make a JSON-RPC request to the MCP server
   */
  private async makeRequest<T = unknown>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    console.log('Asking Nitro MCP', method, params);

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    };

    const url = `${this.baseUrl}?api_key=${encodeURIComponent(this.apiKey)}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Nitro MCP HTTP error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');

      // Handle SSE streaming response
      if (contentType?.includes('text/event-stream')) {
        const text = await response.text();
        return this.parseSSEResponse(text) as T;
      }

      // Handle regular JSON response
      const data: MCPResponse<T> = await response.json();

      if (data.error) {
        throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`);
      }

      return data.result as T;
    } catch (error) {
      console.error('MCP request failed:', error);
      throw error;
    }
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.makeRequest<{ tools: MCPTool[] }>('tools/list');
    return result.tools || [];
  }

  /**
   * Convert a Discord snowflake ID to a valid UUID format
   * Creates a deterministic UUID from the Discord ID for consistent user tracking
   */
  private discordIdToUuid(discordId: string): string {
    // Pad the Discord ID with zeros and format as UUID
    const hex = BigInt(discordId).toString(16).padStart(32, '0');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  /**
   * Ask Nitro AI a question
   */
  async askNitro(params: NitroQuestion): Promise<string> {
    // Convert Discord ID to UUID format if provided
    const userId = params.user_id 
      ? this.discordIdToUuid(params.user_id) 
      : crypto.randomUUID();

    const result = await this.makeRequest<NitroResponse>('tools/call', {
      name: 'ask-nitro',
      arguments: {
        question: params.question,
        user_id: userId,
        email: params.email,
        model: params.model,
        messages: params.messages,
      },
    });

    // Extract text content from the response
    if (result.content && result.content.length > 0) {
      const text = result.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');

      // Filter out tool call info like {"tool":"books"}
      return text.replace(/\{"tool":"[^"]+"\}/g, '').trim();
    }

    return 'No response received from Nitro AI';
  }

  /**
   * Convenience method for simple questions
   */
  async ask(
    question: string,
    userId?: string,
    email?: string,
    messages?: NitroMessage[]
  ): Promise<string> {
    return this.askNitro({
      question,
      user_id: userId,
      email,
      messages,
    });
  }
}