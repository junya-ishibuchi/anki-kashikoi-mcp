import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { AnkiConnectClient } from './anki-connect-client.js';
import type { ConfigurationManager } from './configuration-manager.js';
import type { DeckAnalyzer } from './deck-analyzer.js';
import type {
  AddCardParams,
  ToolResponse
} from '../types/index.js';

export class AnkiMCPServer {
  private server: Server;

  constructor(
    private readonly ankiClient: AnkiConnectClient,
    private readonly configManager: ConfigurationManager,
    private readonly deckAnalyzer: DeckAnalyzer
  ) {
    this.server = new Server(
      {
        name: 'anki-kashikoi-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  async analyzeDeckAndSaveConfig(deckName: string): Promise<ToolResponse> {
    try {
      const deckConfig = await this.deckAnalyzer.analyzeDeck(deckName);
      await this.configManager.addDeckConfig(deckName, deckConfig);
      
      return {
        content: [
          {
            type: 'text',
            text: `Deck "${deckName}" analyzed and configured:\n` +
              `Note type: ${deckConfig.noteType}\n` +
              `Fields: ${deckConfig.fields.join(', ')}\n` +
              `Configuration saved to: ${this.configManager.getConfigPath()}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to analyze deck: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async addCard(params: AddCardParams): Promise<ToolResponse> {
    const config = await this.configManager.loadConfig();
    const deckName = this.validateDeckName(params.deck, config.defaultDeck);
    
    const deckConfig = await this.configManager.getDeckConfig(deckName);
    if (!deckConfig) {
      return this.createDeckNotConfiguredResponse(deckName, config);
    }

    const validationResult = this.validateFieldsForDeck(params.content, deckConfig, deckName);
    if (validationResult) {
      return validationResult;
    }

    const fields = this.prepareFieldsForNote(params.content, deckConfig.fields);

    try {
      const noteId = await this.ankiClient.addNote({
        deckName,
        modelName: deckConfig.noteType,
        fields
      });

      return this.createAddCardSuccessResponse(noteId, deckName, deckConfig.noteType, fields);
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add card: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getConfiguredDecks(): Promise<ToolResponse> {
    const config = await this.configManager.loadConfig();
    
    let info = `=== Configured Decks ===\n\n`;
    
    if (Object.keys(config.decks).length === 0) {
      info += 'No decks configured yet. Use analyze_deck to configure a deck.\n';
    } else {
      for (const [deckName, deckConfig] of Object.entries(config.decks)) {
        info += `Deck: ${deckName}`;
        if (config.defaultDeck === deckName) {
          info += ' (default)';
        }
        info += `\n`;
        info += `  Note type: ${deckConfig.noteType}\n`;
        info += `  Fields: ${deckConfig.fields.join(', ')}\n\n`;
      }
    }

    info += `\nConfiguration file: ${this.configManager.getConfigPath()}`;

    return {
      content: [
        {
          type: 'text',
          text: info,
        },
      ],
    };
  }

  async setDefaultDeck(deckName: string): Promise<ToolResponse> {
    const deckConfig = await this.configManager.getDeckConfig(deckName);
    if (!deckConfig) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Deck "${deckName}" not configured. Please analyze the deck first.`
      );
    }

    await this.configManager.setDefaultDeck(deckName);

    return {
      content: [
        {
          type: 'text',
          text: `Default deck set to: ${deckName}`,
        },
      ],
    };
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'analyze_deck',
          description: 'Analyze a deck and save its configuration',
          inputSchema: {
            type: 'object',
            properties: {
              deck: {
                type: 'string',
                description: 'Name of the deck to analyze',
              },
            },
            required: ['deck'],
          },
        },
        {
          name: 'add_card',
          description: 'Add a card to Anki using field names directly',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'object',
                description: 'Card content with field names as keys',
              },
              deck: {
                type: 'string',
                description: 'Deck name (optional, uses default if not specified)',
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'get_configured_decks',
          description: 'Get information about configured decks',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'set_default_deck',
          description: 'Set the default deck for adding cards',
          inputSchema: {
            type: 'object',
            properties: {
              deck: {
                type: 'string',
                description: 'Name of the deck to set as default',
              },
            },
            required: ['deck'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!request.params.arguments) {
        throw new McpError(ErrorCode.InvalidParams, 'Arguments required');
      }

      let result: ToolResponse;

      switch (request.params.name) {
        case 'analyze_deck': {
          const args = request.params.arguments as { deck: string };
          result = await this.analyzeDeckAndSaveConfig(args.deck);
          break;
        }

        case 'add_card': {
          const args = request.params.arguments as unknown as AddCardParams;
          result = await this.addCard(args);
          break;
        }

        case 'get_configured_decks':
          result = await this.getConfiguredDecks();
          break;

        case 'set_default_deck': {
          const args = request.params.arguments as { deck: string };
          result = await this.setDefaultDeck(args.deck);
          break;
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }

      return result as any;
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Anki MCP server running on stdio');
  }

  private validateDeckName(deckName: string | undefined, defaultDeck: string | undefined): string {
    if (!deckName && !defaultDeck) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'No deck specified and no default deck configured'
      );
    }
    return deckName || defaultDeck!;
  }

  private createDeckNotConfiguredResponse(deckName: string, config: any): ToolResponse {
    return {
      content: [{
        type: 'text',
        text: `Deck "${deckName}" is not configured. Please run analyze_deck first.\n\n` +
              `Available configured decks:\n${this.formatAvailableDecks(config)}\n\n` +
              `If this is a new deck, use: analyze_deck with deck name "${deckName}"\n` +
              `If you want to use an existing deck, retry add_card with one of the configured deck names above.`
      }]
    };
  }

  private validateFieldsForDeck(content: Record<string, string>, deckConfig: any, deckName: string): ToolResponse | null {
    const contentFields = Object.keys(content);
    const invalidFields = contentFields.filter(field => !deckConfig.fields.includes(field));
    
    if (invalidFields.length > 0) {
      return {
        content: [{
          type: 'text',
          text: `Invalid fields for deck "${deckName}": ${invalidFields.join(', ')}\n\n` +
                `Required fields for this deck:\n${deckConfig.fields.map((f: string) => `- ${f}`).join('\n')}\n\n` +
                `Example usage:\n` +
                `{\n${deckConfig.fields.map((f: string) => `  "${f}": "your content here"`).join(',\n')}\n}\n\n` +
                `Please retry add_card with the correct field structure.`
        }]
      };
    }
    return null;
  }

  private prepareFieldsForNote(content: Record<string, string>, fields: readonly string[]): Record<string, string> {
    return fields.reduce((acc, field) => {
      acc[field] = content[field] || '';
      return acc;
    }, {} as Record<string, string>);
  }

  private createAddCardSuccessResponse(noteId: number, deckName: string, noteType: string, fields: Record<string, string>): ToolResponse {
    return {
      content: [
        {
          type: 'text',
          text: 'Card added successfully!\n' +
            `Note ID: ${noteId}\n` +
            `Deck: ${deckName}\n` +
            `Note type: ${noteType}\n` +
            `Fields used: ${Object.keys(fields).join(', ')}`,
        },
      ],
    };
  }

  private formatAvailableDecks(config: any): string {
    if (Object.keys(config.decks).length === 0) {
      return "No decks configured yet.";
    }
    
    return Object.entries(config.decks)
      .map(([name, deckConfig]: [string, any]) => {
        const defaultMarker = config.defaultDeck === name ? " (default)" : "";
        return '- ' + name + defaultMarker + ': [' + deckConfig.fields.join(', ') + ']';
      })
      .join('\n');
  }
}