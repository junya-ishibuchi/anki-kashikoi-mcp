import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DeckAnalyzer } from '../src/services/deck-analyzer.js';
import type { AnkiConnectClient } from '../src/services/anki-connect-client.js';
import type { AnkiCard } from '../src/types/index.js';
import { createMockAnkiCard } from './test-utils.js';

describe('DeckAnalyzer', () => {
  let deckAnalyzer: DeckAnalyzer;
  let mockAnkiClient: jest.Mocked<AnkiConnectClient>;

  beforeEach(() => {
    mockAnkiClient = {
      findCards: jest.fn(),
      getCardsInfo: jest.fn(),
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
      const mockCards: AnkiCard[] = [
        createMockAnkiCard({
          cardId: 1,
          modelName: 'Japanese (recognition)',
          fields: {
            'Expression': { value: '勉強', order: 0 },
            'Reading': { value: 'べんきょう', order: 1 },
            'Meaning': { value: 'study', order: 2 },
            'Sentence': { value: '毎日勉強します。', order: 3 }
          },
          deckName: 'Japanese Vocabulary',
          note: 1
        }),
        createMockAnkiCard({
          cardId: 2,
          modelName: 'Japanese (recognition)',
          fields: {
            'Expression': { value: '本', order: 0 },
            'Reading': { value: 'ほん', order: 1 },
            'Meaning': { value: 'book', order: 2 },
            'Sentence': { value: '本を読みます。', order: 3 }
          },
          deckName: 'Japanese Vocabulary',
          note: 2
        })
      ];

      mockAnkiClient.findCards.mockResolvedValue([1, 2, 3, 4, 5]);
      mockAnkiClient.getCardsInfo.mockResolvedValue(mockCards);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Expression', 'Reading', 'Meaning', 'Sentence']);

      const result = await deckAnalyzer.analyzeDeck('Japanese Vocabulary', 5);

      expect(result).toEqual({
        deckName: 'Japanese Vocabulary',
        noteType: 'Japanese (recognition)',
        fields: ['Expression', 'Reading', 'Meaning', 'Sentence'],
        sampleSize: 2
      });
      expect(mockAnkiClient.findCards).toHaveBeenCalledWith('deck:"Japanese Vocabulary"');
      expect(mockAnkiClient.getCardsInfo).toHaveBeenCalledWith([1, 2, 3, 4, 5]);
      expect(mockAnkiClient.getModelFieldNames).toHaveBeenCalledWith('Japanese (recognition)');
    });

    it('should handle multiple note types and select the most common', async () => {
      const mockCards: AnkiCard[] = [
        createMockAnkiCard({
          cardId: 1,
          modelName: 'Japanese (recognition)'
        }),
        createMockAnkiCard({
          cardId: 2,
          modelName: 'Japanese (recognition)'
        }),
        createMockAnkiCard({
          cardId: 3,
          modelName: 'Basic'
        })
      ];

      mockAnkiClient.findCards.mockResolvedValue([1, 2, 3]);
      mockAnkiClient.getCardsInfo.mockResolvedValue(mockCards);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Expression', 'Reading', 'Meaning', 'Sentence']);

      const result = await deckAnalyzer.analyzeDeck('Mixed Deck');

      expect(result.noteType).toBe('Japanese (recognition)');
    });

    it('should limit sample size to available cards', async () => {
      mockAnkiClient.findCards.mockResolvedValue([1, 2]);
      mockAnkiClient.getCardsInfo.mockResolvedValue([
        createMockAnkiCard({
          cardId: 1,
          modelName: 'Basic'
        }),
        createMockAnkiCard({
          cardId: 2,
          modelName: 'Basic'
        })
      ]);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Front', 'Back']);

      const result = await deckAnalyzer.analyzeDeck('Small Deck', 10);

      expect(result.sampleSize).toBe(2);
      expect(mockAnkiClient.getCardsInfo).toHaveBeenCalledWith([1, 2]);
    });

    it('should throw error when deck has no cards', async () => {
      mockAnkiClient.findCards.mockResolvedValue([]);

      await expect(deckAnalyzer.analyzeDeck('Empty Deck')).rejects.toThrow('Deck "Empty Deck" contains no cards');
    });

    it('should use default sample size of 5', async () => {
      mockAnkiClient.findCards.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8]);
      mockAnkiClient.getCardsInfo.mockResolvedValue([]);
      mockAnkiClient.getModelFieldNames.mockResolvedValue([]);

      await deckAnalyzer.analyzeDeck('Large Deck');

      expect(mockAnkiClient.getCardsInfo).toHaveBeenCalledWith([1, 2, 3, 4, 5]);
    });
  });

  describe('getFieldsForDeck', () => {
    it('should return deck configuration', async () => {
      mockAnkiClient.findCards.mockResolvedValue([1]);
      mockAnkiClient.getCardsInfo.mockResolvedValue([
        createMockAnkiCard({
          cardId: 1,
          modelName: 'Japanese (recognition)'
        })
      ]);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Expression', 'Reading', 'Meaning', 'Sentence']);

      const result = await deckAnalyzer.getFieldsForDeck('Japanese');

      expect(result).toEqual({
        noteType: 'Japanese (recognition)',
        fields: ['Expression', 'Reading', 'Meaning', 'Sentence']
      });
    });

    it('should use sample size of 1 for efficiency', async () => {
      mockAnkiClient.findCards.mockResolvedValue([1, 2, 3, 4, 5]);
      mockAnkiClient.getCardsInfo.mockResolvedValue([
        createMockAnkiCard({
          cardId: 1,
          modelName: 'Basic'
        })
      ]);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Front', 'Back']);

      await deckAnalyzer.getFieldsForDeck('Efficiency Test');

      expect(mockAnkiClient.getCardsInfo).toHaveBeenCalledWith([1]);
    });
  });

  describe('generateReport', () => {
    it('should generate formatted report', () => {
      const analysisResult = {
        deckName: 'Japanese Vocabulary',
        noteType: 'Japanese (recognition)',
        fields: ['Expression', 'Reading', 'Meaning', 'Sentence'],
        sampleSize: 5
      };

      const report = deckAnalyzer.generateReport(analysisResult);

      expect(report).toContain('=== Deck Analysis Report ===');
      expect(report).toContain('Deck: Japanese Vocabulary');
      expect(report).toContain('Note Type: Japanese (recognition)');
      expect(report).toContain('Sample size: 5');
      expect(report).toContain('Fields:');
      expect(report).toContain('- Expression');
      expect(report).toContain('- Reading');
      expect(report).toContain('- Meaning');
      expect(report).toContain('- Sentence');
    });

    it('should handle empty fields array', () => {
      const analysisResult = {
        deckName: 'Empty Deck',
        noteType: 'Basic',
        fields: [],
        sampleSize: 0
      };

      const report = deckAnalyzer.generateReport(analysisResult);

      expect(report).toContain('Fields:');
      expect(report).toContain('Sample size: 0');
    });
  });

  describe('edge cases', () => {
    it('should handle cards with missing modelName gracefully', async () => {
      const mockCards = [
        createMockAnkiCard({
          cardId: 1,
          modelName: ''
        }),
        createMockAnkiCard({
          cardId: 2,
          modelName: 'Basic'
        })
      ];

      mockAnkiClient.findCards.mockResolvedValue([1, 2]);
      mockAnkiClient.getCardsInfo.mockResolvedValue(mockCards);
      mockAnkiClient.getModelFieldNames.mockResolvedValue(['Front', 'Back']);

      const result = await deckAnalyzer.analyzeDeck('Test Deck');

      expect(result.noteType).toBe('Basic');
    });

    it('should handle API errors appropriately', async () => {
      mockAnkiClient.findCards.mockRejectedValue(new Error('Network error'));

      await expect(deckAnalyzer.analyzeDeck('Test Deck')).rejects.toThrow('Network error');
    });
  });
});