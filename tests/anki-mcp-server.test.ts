import { AnkiMCPServer } from '../src/services/anki-mcp-server.js';
import type { DeckConfig, UserConfigNew } from '../src/types/index.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';

// Create mock implementations
const mockAnkiClient = {
  addNote: jest.fn(),
} as any;

const mockConfigManager = {
  loadConfig: jest.fn(),
  getDeckConfig: jest.fn(),
  getConfigPath: jest.fn(),
} as any;

const mockDeckAnalyzer = {
  getFieldsForDeck: jest.fn(),
} as any;

describe('AnkiMCPServer', () => {
  let server: AnkiMCPServer;

  beforeEach(() => {
    server = new AnkiMCPServer(
      mockAnkiClient,
      mockConfigManager,
      mockDeckAnalyzer
    );
    jest.clearAllMocks();
  });

  describe('addCard', () => {
    describe('error responses', () => {
      it('should provide comprehensive information when deck is not configured', async () => {
        const unconfiguredDeck = 'UnknownDeck';
        const configuredDecks: UserConfigNew = {
          decks: {
            'Japanese': {
              noteType: 'Japanese (recognition)',
              fields: ['Expression', 'Reading', 'Meaning']
            },
            'English': {
              noteType: 'Basic',
              fields: ['Front', 'Back']
            }
          },
          defaultDeck: 'Japanese'
        };

        mockConfigManager.loadConfig.mockResolvedValue(configuredDecks);
        mockConfigManager.getDeckConfig.mockResolvedValue(undefined);

        const result = await server.addCard({
          deck: unconfiguredDeck,
          content: { front: 'test' }
        });

        expect(result.content[0].text).toContain(`Deck "${unconfiguredDeck}" is not configured`);
        expect(result.content[0].text).toContain('Available configured decks:');
        expect(result.content[0].text).toContain('- Japanese (default): [Expression, Reading, Meaning]');
        expect(result.content[0].text).toContain('- English: [Front, Back]');
        expect(result.content[0].text).toContain(`analyze_deck with deck name "${unconfiguredDeck}"`);
      });

      it('should provide helpful message when no decks are configured', async () => {
        const emptyConfig: UserConfigNew = {
          decks: {},
        };

        mockConfigManager.loadConfig.mockResolvedValue(emptyConfig);
        mockConfigManager.getDeckConfig.mockResolvedValue(undefined);

        const result = await server.addCard({
          deck: 'AnyDeck',
          content: { front: 'test' }
        });

        expect(result.content[0].text).toContain('No decks configured yet.');
        expect(result.content[0].text).toContain('analyze_deck with deck name "AnyDeck"');
      });

      it('should provide detailed field information when invalid fields are used', async () => {
        const deckConfig: DeckConfig = {
          noteType: 'Japanese (recognition)',
          fields: ['Expression', 'Reading', 'Meaning', 'Notes']
        };

        mockConfigManager.loadConfig.mockResolvedValue({
          decks: { 'Japanese': deckConfig },
          defaultDeck: 'Japanese'
        });
        mockConfigManager.getDeckConfig.mockResolvedValue(deckConfig);

        const result = await server.addCard({
          content: {
            primary: 'テスト',
            secondary: 'test',
            wrongField: 'wrong'
          }
        });

        expect(result.content[0].text).toContain('Invalid fields for deck "Japanese": primary, secondary, wrongField');
        expect(result.content[0].text).toContain('Required fields for this deck:');
        expect(result.content[0].text).toContain('- Expression');
        expect(result.content[0].text).toContain('- Reading');
        expect(result.content[0].text).toContain('- Meaning');
        expect(result.content[0].text).toContain('- Notes');
        expect(result.content[0].text).toContain('Example usage:');
        expect(result.content[0].text).toContain('"Expression": "your content here"');
        expect(result.content[0].text).toContain('"Reading": "your content here"');
        expect(result.content[0].text).toContain('"Meaning": "your content here"');
        expect(result.content[0].text).toContain('"Notes": "your content here"');
        expect(result.content[0].text).toContain('Please retry add_card with the correct field structure');
      });

      it('should provide helpful error when no deck specified and no default configured', async () => {
        mockConfigManager.loadConfig.mockResolvedValue({ decks: {} });

        await expect(server.addCard({
          content: { front: 'test' }
        })).rejects.toThrow(McpError);
      });
    });

    describe('success responses', () => {
      it('should provide detailed success information when card is added', async () => {
        const deckConfig: DeckConfig = {
          noteType: 'Basic',
          fields: ['Front', 'Back']
        };

        mockConfigManager.loadConfig.mockResolvedValue({
          decks: { 'TestDeck': deckConfig },
          defaultDeck: 'TestDeck'
        });
        mockConfigManager.getDeckConfig.mockResolvedValue(deckConfig);
        mockAnkiClient.addNote.mockResolvedValue(1234567890);

        const result = await server.addCard({
          content: {
            Front: 'Question',
            Back: 'Answer'
          }
        });

        expect(result.content[0].text).toContain('Card added successfully!');
        expect(result.content[0].text).toContain('Note ID: 1234567890');
        expect(result.content[0].text).toContain('Deck: TestDeck');
        expect(result.content[0].text).toContain('Note type: Basic');
        expect(result.content[0].text).toContain('Fields used: Front, Back');
      });
    });
  });

  describe('formatAvailableDecks', () => {
    it('should format available decks correctly', async () => {
      // This will be tested indirectly through the addCard tests above
      // since formatAvailableDecks is a private method
    });
  });
});