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
import type { FieldMapper } from './field-mapper.js';
import type { DeckAnalyzer } from './deck-analyzer.js';
import type {
  UserConfig,
  AnkiNoteType,
  ToolResponse,
  ConfigureAnkiSetupArgs,
  AddSmartCardArgs,
  SuggestFieldMappingArgs,
  AnalyzeExistingDeckArgs,
  AutoConfigureFromDeckArgs,
} from '../types/index.js';

export class AnkiMCPServer {
  private server: Server;
  private userConfig: UserConfig | null = null;
  private availableNoteTypes: AnkiNoteType[] = [];

  constructor(
    private readonly ankiClient: AnkiConnectClient,
    private readonly configManager: ConfigurationManager,
    private readonly fieldMapper: FieldMapper,
    private readonly deckAnalyzer: DeckAnalyzer
  ) {
    this.server = new Server(
      {
        name: 'dynamic-anki-server',
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

  async initializeUserConfig(): Promise<void> {
    if (!this.userConfig) {
      this.availableNoteTypes = await this.ankiClient.getNoteTypes();
      this.userConfig = await this.configManager.loadConfig();
    }
  }

  async configureAnkiSetup(args: ConfigureAnkiSetupArgs): Promise<ToolResponse> {
    await this.initializeUserConfig();

    try {
      await this.ankiClient.createDeck(args.deck);
    } catch (error) {
      console.error(`Deck creation error (possibly already exists): ${error}`);
    }

    this.userConfig = {
      preferredDeck: args.deck,
      preferredNoteType: args.noteType,
      fieldMappings: args.fieldMappings || this.userConfig?.fieldMappings || {},
    };

    await this.configManager.saveConfig(this.userConfig);

    return {
      content: [
        {
          type: 'text',
          text: `Anki configuration updated:\\n` +
            `Deck: ${args.deck}\\n` +
            `Note type: ${args.noteType}\\n` +
            `Configuration file: ${this.configManager.getConfigPath()}\\n` +
            `Field mappings:\\n${JSON.stringify(args.fieldMappings, null, 2)}`,
        },
      ],
    };
  }

  async getAnkiInfo(): Promise<ToolResponse> {
    await this.initializeUserConfig();

    const decks = await this.ankiClient.getDeckNames();

    let info = `=== Anki Information ===\\n\\n`;
    info += `Available decks:\\n${decks.map((d: string) => `- ${d}`).join('\\n')}\\n\\n`;
    info += `Available note types and fields:\\n`;

    for (const noteType of this.availableNoteTypes) {
      info += `- ${noteType.name}: [${noteType.fields.join(', ')}]\\n`;
    }

    info += `\\nCurrent configuration:\\n`;
    info += `- Default deck: ${this.userConfig?.preferredDeck}\\n`;
    info += `- Default note type: ${this.userConfig?.preferredNoteType}\\n`;
    info += `- Field mappings: ${JSON.stringify(this.userConfig?.fieldMappings, null, 2)}`;

    return {
      content: [{ type: 'text', text: info }],
    };
  }

  async addSmartCard(args: AddSmartCardArgs): Promise<ToolResponse> {
    await this.initializeUserConfig();

    const deck = args.deck || this.userConfig!.preferredDeck;
    const noteType = args.noteType || this.userConfig!.preferredNoteType;

    const mappedFields = this.fieldMapper.applyMapping(
      this.userConfig!.fieldMappings,
      args.content
    );

    if (Object.keys(mappedFields).length === 0) {
      throw new Error('No fields were mapped. Please check your configuration.');
    }

    const note = {
      deckName: deck,
      modelName: noteType,
      fields: mappedFields,
      tags: args.tags || [],
    };

    const noteId = await this.ankiClient.addNote(note);

    return {
      content: [
        {
          type: 'text',
          text: `Smart card added successfully!\\n` +
            `Note ID: ${noteId}\\n` +
            `Deck: ${deck}\\n` +
            `Note type: ${noteType}\\n` +
            `Mapped fields:\\n${Object.entries(mappedFields)
              .map(([field, value]) => `- ${field}: ${value}`)
              .join('\\n')}`,
        },
      ],
    };
  }

  async suggestFieldMapping(args: SuggestFieldMappingArgs): Promise<ToolResponse> {
    await this.initializeUserConfig();

    const noteType = this.availableNoteTypes.find(nt => nt.name === args.noteType);
    if (!noteType) {
      throw new Error(`Note type "${args.noteType}" not found.`);
    }

    const suggestions = this.fieldMapper.suggestMappings(noteType);

    let suggestionText = `Recommended field mappings for note type "${args.noteType}":\\n\\n`;
    suggestionText += `Available fields: [${noteType.fields.join(', ')}]\\n\\n`;
    suggestionText += `Recommended mappings:\\n`;

    for (const [semantic, field] of Object.entries(suggestions)) {
      suggestionText += `- ${semantic} → ${field}\\n`;
    }

    suggestionText += `\\nUsage:\\nUse the configure_anki_setup tool to apply these mappings.`;

    return {
      content: [{ type: 'text', text: suggestionText }],
    };
  }

  async analyzeExistingDeck(args: AnalyzeExistingDeckArgs): Promise<ToolResponse> {
    await this.initializeUserConfig();

    const analysisResult = await this.deckAnalyzer.analyzeDeck(
      args.deck,
      args.sampleSize || 5
    );

    const report = this.deckAnalyzer.generateReport(analysisResult);

    return {
      content: [{ type: 'text', text: report }],
    };
  }

  async autoConfigureFromDeck(args: AutoConfigureFromDeckArgs): Promise<ToolResponse> {
    const analysis = await this.deckAnalyzer.analyzeDeck(args.deck);

    if (!args.confirm) {
      return {
        content: [
          {
            type: 'text',
            text: this.deckAnalyzer.generateReport(analysis) +
              `\\n\\nIf this configuration looks good, run auto_configure_from_deck with confirm: true to apply.`,
          },
        ],
      };
    }

    const cardIds = await this.ankiClient.findCards(`deck:"${args.deck}"`);
    const cardsInfo = await this.ankiClient.getCardsInfo([cardIds[0]]);
    const noteType = cardsInfo[0].modelName;

    return await this.configureAnkiSetup({
      deck: args.deck,
      noteType: noteType,
      fieldMappings: analysis.suggestedMappings,
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      await this.initializeUserConfig();

      return {
        tools: [
          {
            name: 'configure_anki_setup',
            description: 'Initialize and customize Anki configuration (recommended to run first)',
            inputSchema: {
              type: 'object',
              properties: {
                deck: {
                  type: 'string',
                  description: 'Default deck name to use',
                },
                noteType: {
                  type: 'string',
                  description: 'Default note type to use',
                },
                fieldMappings: {
                  type: 'object',
                  description: 'Semantic name to actual field name mappings (define as needed)',
                  additionalProperties: {
                    type: 'string',
                    description: 'Actual Anki field name'
                  },
                  examples: [
                    {
                      "primary": "Front",
                      "secondary": "Back"
                    },
                    {
                      "question": "Question",
                      "answer": "Answer",
                      "hint": "Hint"
                    },
                    {
                      "kanji": "Expression",
                      "reading": "Reading",
                      "meaning": "Meaning",
                      "sentence": "Sentence"
                    }
                  ]
                },
              },
              required: ['deck', 'noteType'],
            },
          },
          {
            name: 'get_anki_info',
            description: 'Get Anki deck, note type, and field information',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'add_smart_card',
            description: 'Add card intelligently based on user configuration',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'object',
                  description: 'Content specified by semantic names (only configured mappings are valid)',
                  additionalProperties: {
                    type: 'string',
                    description: 'Value for any semantic name'
                  },
                  examples: [
                    { "primary": "Hello", "secondary": "こんにちは" },
                    { "question": "What is 2+2?", "answer": "4", "hint": "Simple addition" },
                    { "kanji": "日本", "reading": "にほん", "meaning": "Japan" }
                  ]
                },
                deck: {
                  type: 'string',
                  description: 'Deck name (uses default if omitted)',
                },
                noteType: {
                  type: 'string',
                  description: 'Note type (uses default if omitted)',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tag list',
                },
              },
              required: ['content'],
            },
          },
          {
            name: 'suggest_field_mapping',
            description: 'Suggest recommended field mappings for specified note type',
            inputSchema: {
              type: 'object',
              properties: {
                noteType: {
                  type: 'string',
                  description: 'Note type name',
                },
              },
              required: ['noteType'],
            },
          },
          {
            name: 'analyze_existing_deck',
            description: 'Analyze existing deck to generate recommended configuration',
            inputSchema: {
              type: 'object',
              properties: {
                deck: {
                  type: 'string',
                  description: 'Deck name to analyze',
                },
                sampleSize: {
                  type: 'number',
                  description: 'Number of cards to analyze (default: 5)',
                  default: 5,
                },
              },
              required: ['deck'],
            },
          },
          {
            name: 'auto_configure_from_deck',
            description: 'Automatically configure settings by analyzing existing deck',
            inputSchema: {
              type: 'object',
              properties: {
                deck: {
                  type: 'string',
                  description: 'Base deck name',
                },
                confirm: {
                  type: 'boolean',
                  description: 'Whether to automatically apply suggested configuration (default: false)',
                  default: false,
                },
              },
              required: ['deck'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result: ToolResponse;

        switch (name) {
          case 'configure_anki_setup':
            result = await this.configureAnkiSetup(args as unknown as ConfigureAnkiSetupArgs);
            break;

          case 'get_anki_info':
            result = await this.getAnkiInfo();
            break;

          case 'add_smart_card':
            result = await this.addSmartCard(args as unknown as AddSmartCardArgs);
            break;

          case 'suggest_field_mapping':
            result = await this.suggestFieldMapping(args as unknown as SuggestFieldMappingArgs);
            break;

          case 'analyze_existing_deck':
            result = await this.analyzeExistingDeck(args as unknown as AnalyzeExistingDeckArgs);
            break;

          case 'auto_configure_from_deck':
            result = await this.autoConfigureFromDeck(args as unknown as AutoConfigureFromDeckArgs);
            break;

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        return result as any;
      } catch (error) {
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Dynamic Anki MCP Server running on stdio');
    console.error(`Configuration file location: ${this.configManager.getConfigPath()}`);
  }
}