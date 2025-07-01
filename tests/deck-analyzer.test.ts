import { DeckAnalyzer } from '../src/services/deck-analyzer.js';
import type { AnkiConnectClient } from '../src/services/anki-connect-client.js';
import type { FieldMapper } from '../src/services/field-mapper.js';
import type { AnkiCard, DeckAnalysisResult } from '../src/types/index.js';

// Mock dependencies
const mockAnkiClient = {
  findCards: jest.fn(),
  getCardsInfo: jest.fn(),
} as jest.Mocked<Pick<AnkiConnectClient, 'findCards' | 'getCardsInfo'>>;

const mockFieldMapper = {
  suggestMappings: jest.fn(),
} as jest.Mocked<Pick<FieldMapper, 'suggestMappings'>>;

describe('DeckAnalyzer', () => {
  let deckAnalyzer: DeckAnalyzer;

  const createMockCard = (cardId: number, fields: Record<string, string>, modelName = 'Basic', deckName = 'TestDeck'): AnkiCard => ({
    cardId,
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value], index) => [key, { value, order: index }])
    ),
    fieldOrder: 0,
    question: '',
    answer: '',
    modelName,
    deckName,
    css: '',
    factor: 0,
    interval: 0,
    note: 0,
    type: 0,
    queue: 0,
    due: 0,
    reps: 0,
    lapses: 0,
    left: 0,
    odue: 0,
    odid: 0,
    mod: 0,
    usn: 0,
  });

  beforeEach(() => {
    deckAnalyzer = new DeckAnalyzer(mockAnkiClient as unknown as AnkiConnectClient, mockFieldMapper as unknown as FieldMapper);
    jest.clearAllMocks();
  });

  describe('analyzeDeck', () => {
    it('should analyze deck and return results', async () => {
      const mockCardIds = [1, 2, 3, 4, 5];
      const mockCardsInfo: AnkiCard[] = [
        createMockCard(1, { Front: 'Hello', Back: 'こんにちは' }, 'Basic', 'Japanese'),
        createMockCard(2, { Front: 'Good morning', Back: 'おはよう' }, 'Basic', 'Japanese'),
      ];

      mockAnkiClient.findCards.mockResolvedValueOnce(mockCardIds);
      mockAnkiClient.getCardsInfo.mockResolvedValueOnce(mockCardsInfo);
      mockFieldMapper.suggestMappings.mockReturnValueOnce({
        primary: 'Front',
        secondary: 'Back',
      });

      const result = await deckAnalyzer.analyzeDeck('Japanese', 2);

      expect(mockAnkiClient.findCards).toHaveBeenCalledWith('deck:"Japanese"');
      expect(mockAnkiClient.getCardsInfo).toHaveBeenCalledWith([1, 2]);
      
      expect(result.deckName).toBe('Japanese');
      expect(result.sampleSize).toBe(2);
      expect(result.primaryNoteType).toBe('Basic');
      expect(result.fieldAnalysis).toHaveProperty('Front');
      expect(result.fieldAnalysis).toHaveProperty('Back');
      expect(result.suggestedMappings).toEqual({
        primary: 'Front',
        secondary: 'Back',
      });
    });

    it('should handle empty deck gracefully', async () => {
      mockAnkiClient.findCards.mockResolvedValueOnce([]);

      await expect(deckAnalyzer.analyzeDeck('EmptyDeck'))
        .rejects.toThrow('Deck "EmptyDeck" contains no cards');

      expect(mockAnkiClient.findCards).toHaveBeenCalledWith('deck:"EmptyDeck"');
      expect(mockAnkiClient.getCardsInfo).not.toHaveBeenCalled();
    });

    it('should use default sample size when not specified', async () => {
      const mockCardIds = [1, 2, 3, 4, 5, 6, 7, 8];
      const mockCardsInfo: AnkiCard[] = Array.from({ length: 5 }, (_, i) => 
        createMockCard(i + 1, { Front: `Question ${i + 1}`, Back: `Answer ${i + 1}` })
      );

      mockAnkiClient.findCards.mockResolvedValueOnce(mockCardIds);
      mockAnkiClient.getCardsInfo.mockResolvedValueOnce(mockCardsInfo);
      mockFieldMapper.suggestMappings.mockReturnValueOnce({});

      const result = await deckAnalyzer.analyzeDeck('TestDeck');

      expect(mockAnkiClient.getCardsInfo).toHaveBeenCalledWith([1, 2, 3, 4, 5]);
      expect(result.sampleSize).toBe(5);
    });

    it('should handle multiple note types and select primary', async () => {
      const mockCardIds = [1, 2, 3];
      const mockCardsInfo: AnkiCard[] = [
        createMockCard(1, { Front: 'Test' }),
        createMockCard(2, { Text: 'Cloze test' }, 'Cloze'),
        createMockCard(3, { Front: 'Another' }),
      ];

      mockAnkiClient.findCards.mockResolvedValueOnce(mockCardIds);
      mockAnkiClient.getCardsInfo.mockResolvedValueOnce(mockCardsInfo);
      mockFieldMapper.suggestMappings.mockReturnValueOnce({});

      const result = await deckAnalyzer.analyzeDeck('TestDeck');

      expect(result.primaryNoteType).toBe('Basic'); // Most frequent note type
    });

    it('should limit sample size to available cards', async () => {
      const mockCardIds = [1, 2]; // Only 2 cards available
      const mockCardsInfo: AnkiCard[] = [
        createMockCard(1, { Front: 'Test1' }, 'Basic', 'SmallDeck'),
        createMockCard(2, { Front: 'Test2' }, 'Basic', 'SmallDeck'),
      ];

      mockAnkiClient.findCards.mockResolvedValueOnce(mockCardIds);
      mockAnkiClient.getCardsInfo.mockResolvedValueOnce(mockCardsInfo);
      mockFieldMapper.suggestMappings.mockReturnValueOnce({});

      const result = await deckAnalyzer.analyzeDeck('SmallDeck', 10); // Request 10 but only 2 available

      expect(mockAnkiClient.getCardsInfo).toHaveBeenCalledWith([1, 2]);
      expect(result.sampleSize).toBe(2);
    });
  });

  describe('analyzeFieldContent', () => {
    it('should analyze field content and return purpose description', () => {
      const samples = ['Hello', 'Good morning', 'How are you?'];
      
      const result = deckAnalyzer.analyzeFieldContent('Front', samples);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should identify pronunciation fields', () => {
      const samples = ['/həˈloʊ/', '/ˈmɔrnɪŋ/', '/haʊ/'];
      
      const result = deckAnalyzer.analyzeFieldContent('Pronunciation', samples);
      
      expect(result).toContain('pronunciation');
    });

    it('should identify example sentence fields', () => {
      const samples = [
        'Example: I said hello to my friend.',
        'Usage: Good morning everyone!',
        'Sentence: How are you today?',
      ];
      
      const result = deckAnalyzer.analyzeFieldContent('Examples', samples);
      
      expect(result).toContain('example');
    });

    it('should identify long content fields', () => {
      const samples = [
        'This is a very long detailed explanation that goes on for quite a while and contains lots of information',
        'Another lengthy description with multiple sentences. It provides comprehensive details about the topic.',
      ];
      
      const result = deckAnalyzer.analyzeFieldContent('Description', samples);
      
      expect(result.includes('Detailed') || result.includes('Long')).toBe(true);
    });

    it('should identify short content fields', () => {
      const samples = ['Hi', 'Yes', 'No', 'OK'];
      
      const result = deckAnalyzer.analyzeFieldContent('Answer', samples);
      
      expect(result).toContain('Short');
    });
  });

  describe('generateReport', () => {
    it('should generate formatted analysis report', () => {
      const analysisResult: DeckAnalysisResult = {
        deckName: 'TestDeck',
        sampleSize: 3,
        primaryNoteType: 'Basic',
        fieldAnalysis: {
          Front: 'Short questions',
          Back: 'Brief answers',
        },
        suggestedMappings: {
          primary: 'Front',
          secondary: 'Back',
        },
      };

      const report = deckAnalyzer.generateReport(analysisResult);

      expect(report).toContain('TestDeck');
      expect(report).toContain('3');
      expect(report).toContain('Basic');
      expect(report).toContain('Front');
      expect(report).toContain('Back');
      expect(report).toContain('Short questions');
      expect(report).toContain('Brief answers');
      expect(report).toContain('primary → Front');
      expect(report).toContain('secondary → Back');
    });

    it('should handle empty mappings gracefully', () => {
      const analysisResult: DeckAnalysisResult = {
        deckName: 'TestDeck',
        sampleSize: 1,
        primaryNoteType: 'Basic',
        fieldAnalysis: { Field1: 'Unknown content' },
        suggestedMappings: {},
      };

      const report = deckAnalyzer.generateReport(analysisResult);

      expect(report).toContain('TestDeck');
      expect(report).toContain('No semantic mappings suggested');
    });
  });

  describe('getFieldSamples', () => {
    it('should extract field samples from cards', () => {
      const cards: AnkiCard[] = [
        createMockCard(1, { Front: 'Question 1', Back: 'Answer 1' }),
        createMockCard(2, { Front: 'Question 2', Back: 'Answer 2' }),
      ];

      const samples = deckAnalyzer.getFieldSamples(cards);

      expect(samples).toHaveProperty('Front');
      expect(samples).toHaveProperty('Back');
      expect(samples.Front).toEqual(['Question 1', 'Question 2']);
      expect(samples.Back).toEqual(['Answer 1', 'Answer 2']);
    });

    it('should handle empty field values', () => {
      const cards: AnkiCard[] = [
        createMockCard(1, { Front: 'Question', Back: '' }),
      ];

      const samples = deckAnalyzer.getFieldSamples(cards);

      expect(samples.Front).toEqual(['Question']);
      expect(samples.Back).toEqual([]);
    });

    it('should truncate long field values', () => {
      const longText = 'A'.repeat(100);
      const cards: AnkiCard[] = [
        createMockCard(1, { Front: longText }),
      ];

      const samples = deckAnalyzer.getFieldSamples(cards);

      expect(samples.Front[0].length).toBeLessThanOrEqual(50);
    });
  });
});