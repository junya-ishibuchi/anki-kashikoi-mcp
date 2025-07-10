import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DeckAnalyzer } from '../src/services/deck-analyzer.js';
import type { AnkiConnectClient } from '../src/services/anki-connect-client.js';
import type { AnkiNoteInfo } from '../src/types/index.js';

function createMockAnkiNoteInfo(overrides: Partial<AnkiNoteInfo> = {}): AnkiNoteInfo {
  return {
    noteId: 1,
    profileName: 'User1',
    modelName: 'Basic',
    tags: [],
    fields: { 
      Front: { value: 'Question', order: 0 },
      Back: { value: 'Answer', order: 1 }
    },
    mod: 1609459200,
    cards: [1, 2],
    ...overrides
  };
}

describe('DeckAnalyzer', () => {
  let deckAnalyzer: DeckAnalyzer;
  let mockAnkiClient: jest.Mocked<AnkiConnectClient>;

  beforeEach(() => {
    mockAnkiClient = {
      getNotesInfo: jest.fn(),
      getModelFieldNames: jest.fn(),
      // Other methods not used in DeckAnalyzer
      getDeckNames: jest.fn(),
      getNoteTypes: jest.fn(),
      createDeck: jest.fn(),
      addNote: jest.fn(),
      sendRequest: jest.fn()
    } as any;

    deckAnalyzer = new DeckAnalyzer(mockAnkiClient);
  });

  describe('analyzeDeck', () => {
    it('should analyze deck and return deck information', async () => {
      const mockNotes: AnkiNoteInfo[] = [
        createMockAnkiNoteInfo({
          noteId: 1,
          modelName: 'Japanese (recognition)',
          fields: {
            'Expression': { value: '勉強', order: 0 },
            'Reading': { value: 'べんきょう', order: 1 },
            'Meaning': { value: 'study', order: 2 },
            'Sentence': { value: '毎日勉強します。', order: 3 }
          }
        }),
        createMockAnkiNoteInfo({
          noteId: 2,
          modelName: 'Japanese (recognition)',
          fields: {
            'Expression': { value: '本', order: 0 },
            'Reading': { value: 'ほん', order: 1 },
            'Meaning': { value: 'book', order: 2 },
            'Sentence': { value: '本を読みます。', order: 3 }
          }
        })
      ];

      mockAnkiClient.getNotesInfo.mockResolvedValue(mockNotes);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Expression', 'Reading', 'Meaning', 'Sentence']);

      const result = await deckAnalyzer.analyzeDeck('Japanese Vocabulary');

      expect(result).toEqual({
        noteType: 'Japanese (recognition)',
        fields: ['Expression', 'Reading', 'Meaning', 'Sentence']
      });
      expect(mockAnkiClient.getNotesInfo).toHaveBeenCalledWith({ query: 'deck:"Japanese Vocabulary"' });
      expect(mockAnkiClient.getModelFieldNames).toHaveBeenCalledWith('Japanese (recognition)');
    });

    it('should use the first note type from the deck', async () => {
      const mockNotes: AnkiNoteInfo[] = [
        createMockAnkiNoteInfo({
          noteId: 1,
          modelName: 'Basic'
        }),
        createMockAnkiNoteInfo({
          noteId: 2,
          modelName: 'Japanese (recognition)'
        }),
        createMockAnkiNoteInfo({
          noteId: 3,
          modelName: 'Japanese (recognition)'
        })
      ];

      mockAnkiClient.getNotesInfo.mockResolvedValue(mockNotes);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Front', 'Back']);

      const result = await deckAnalyzer.analyzeDeck('Mixed Deck');

      expect(result.noteType).toBe('Basic');
    });

    it('should use first note regardless of deck size', async () => {
      const mockNotes = [
        createMockAnkiNoteInfo({
          noteId: 1,
          modelName: 'Basic'
        }),
        createMockAnkiNoteInfo({
          noteId: 2,
          modelName: 'Basic'
        })
      ];
      mockAnkiClient.getNotesInfo.mockResolvedValue(mockNotes);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Front', 'Back']);

      const result = await deckAnalyzer.analyzeDeck('Small Deck');

      expect(result.noteType).toBe('Basic');
      expect(mockAnkiClient.getNotesInfo).toHaveBeenCalledWith({ query: 'deck:"Small Deck"' });
    });

    it('should throw error when deck has no cards', async () => {
      mockAnkiClient.getNotesInfo.mockResolvedValue([]);

      await expect(deckAnalyzer.analyzeDeck('Empty Deck')).rejects.toThrow('Deck "Empty Deck" contains no cards');
    });

    it('should throw error when first note has no model name', async () => {
      const mockNotes = [
        {
          ...createMockAnkiNoteInfo({ noteId: 1 }),
          modelName: undefined as any
        }
      ];
      mockAnkiClient.getNotesInfo.mockResolvedValue(mockNotes);

      await expect(deckAnalyzer.analyzeDeck('Invalid Deck')).rejects.toThrow('First note in deck has no model name');
    });

    it('should handle large decks efficiently', async () => {
      const mockNotes = Array.from({length: 100}, (_, i) => createMockAnkiNoteInfo({
        noteId: i + 1,
        modelName: i === 0 ? 'Basic' : 'Other'
      }));
      mockAnkiClient.getNotesInfo.mockResolvedValue(mockNotes);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Front', 'Back']);

      const result = await deckAnalyzer.analyzeDeck('Large Deck');

      expect(result.noteType).toBe('Basic');
      expect(mockAnkiClient.getNotesInfo).toHaveBeenCalledWith({ query: 'deck:"Large Deck"' });
    });
  });

  describe('analyzeDeck', () => {
    it('should return deck configuration', async () => {
      const mockNotes = [
        createMockAnkiNoteInfo({
          noteId: 1,
          modelName: 'Japanese (recognition)'
        })
      ];
      mockAnkiClient.getNotesInfo.mockResolvedValue(mockNotes);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Expression', 'Reading', 'Meaning', 'Sentence']);

      const result = await deckAnalyzer.analyzeDeck('Japanese');

      expect(result).toEqual({
        noteType: 'Japanese (recognition)',
        fields: ['Expression', 'Reading', 'Meaning', 'Sentence']
      });
    });

    it('should use sample size of 1 for efficiency', async () => {
      const mockNotes = Array.from({length: 5}, (_, i) => createMockAnkiNoteInfo({
        noteId: i + 1,
        modelName: 'Basic'
      }));
      mockAnkiClient.getNotesInfo.mockResolvedValue(mockNotes);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Front', 'Back']);

      const result = await deckAnalyzer.analyzeDeck('Efficiency Test');

      expect(result.noteType).toBe('Basic');
      expect(mockAnkiClient.getNotesInfo).toHaveBeenCalledWith({ query: 'deck:"Efficiency Test"' });
    });
  });


  describe('edge cases', () => {
    it('should throw error when first note has empty modelName', async () => {
      const mockNotes = [
        createMockAnkiNoteInfo({
          noteId: 1,
          modelName: ''
        }),
        createMockAnkiNoteInfo({
          noteId: 2,
          modelName: 'Basic'
        })
      ];

      mockAnkiClient.getNotesInfo.mockResolvedValue(mockNotes);

      await expect(deckAnalyzer.analyzeDeck('Test Deck')).rejects.toThrow('First note in deck has no model name');
    });

    it('should handle API errors appropriately', async () => {
      mockAnkiClient.getNotesInfo.mockRejectedValue(new Error('Network error'));

      await expect(deckAnalyzer.analyzeDeck('Test Deck')).rejects.toThrow('Network error');
    });
  });
});