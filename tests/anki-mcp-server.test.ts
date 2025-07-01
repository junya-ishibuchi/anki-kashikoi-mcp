import { AnkiMCPServer } from '../src/services/anki-mcp-server.js';
import type { AnkiConnectClient } from '../src/services/anki-connect-client.js';
import type { ConfigurationManager } from '../src/services/configuration-manager.js';
import type { FieldMapper } from '../src/services/field-mapper.js';
import type { DeckAnalyzer } from '../src/services/deck-analyzer.js';
import type { UserConfig } from '../src/types/index.js';

// Mock dependencies
const mockAnkiClient = {
  getDeckNames: jest.fn(),
  getNoteTypes: jest.fn(),
  createDeck: jest.fn(),
  addNote: jest.fn(),
  findCards: jest.fn(),
  getCardsInfo: jest.fn(),
} as jest.Mocked<Pick<AnkiConnectClient, 'getDeckNames' | 'getNoteTypes' | 'createDeck' | 'addNote' | 'findCards' | 'getCardsInfo'>>;

const mockConfigManager = {
  loadConfig: jest.fn(),
  saveConfig: jest.fn(),
  getConfigPath: jest.fn(),
  validateConfig: jest.fn(),
} as unknown as jest.Mocked<ConfigurationManager>;

const mockFieldMapper = {
  suggestMappings: jest.fn(),
  getSuggestionDetails: jest.fn(),
  validateMapping: jest.fn(),
  applyMapping: jest.fn(),
  getSemanticKeywords: jest.fn(),
} as unknown as jest.Mocked<FieldMapper>;

const mockDeckAnalyzer = {
  analyzeDeck: jest.fn(),
  analyzeFieldContent: jest.fn(),
  generateReport: jest.fn(),
  getFieldSamples: jest.fn(),
} as unknown as jest.Mocked<DeckAnalyzer>;

describe('AnkiMCPServer', () => {
  let server: AnkiMCPServer;

  beforeEach(() => {
    server = new AnkiMCPServer(
      mockAnkiClient as unknown as AnkiConnectClient,
      mockConfigManager,
      mockFieldMapper,
      mockDeckAnalyzer
    );
    jest.clearAllMocks();
  });

  describe('initializeUserConfig', () => {
    it('should load and cache user configuration', async () => {
      const mockConfig: UserConfig = {
        preferredDeck: 'TestDeck',
        preferredNoteType: 'Basic',
        fieldMappings: { primary: 'Front', secondary: 'Back' },
      };

      mockConfigManager.loadConfig.mockResolvedValueOnce(mockConfig);
      mockAnkiClient.getNoteTypes.mockResolvedValueOnce([
        { name: 'Basic', fields: ['Front', 'Back'] },
      ]);

      await server.initializeUserConfig();

      expect(mockConfigManager.loadConfig).toHaveBeenCalledTimes(1);
      expect(mockAnkiClient.getNoteTypes).toHaveBeenCalledTimes(1);
    });

    it('should only initialize configuration once', async () => {
      const mockConfig: UserConfig = {
        preferredDeck: 'TestDeck',
        preferredNoteType: 'Basic',
        fieldMappings: {},
      };

      mockConfigManager.loadConfig.mockResolvedValueOnce(mockConfig);
      mockAnkiClient.getNoteTypes.mockResolvedValueOnce([]);

      await server.initializeUserConfig();
      await server.initializeUserConfig();

      expect(mockConfigManager.loadConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe('configureAnkiSetup', () => {
    it('should configure and save new Anki setup', async () => {
      const args = {
        deck: 'NewDeck',
        noteType: 'Basic',
        fieldMappings: { primary: 'Front', secondary: 'Back' },
      };

      mockAnkiClient.createDeck.mockResolvedValueOnce();
      mockConfigManager.saveConfig.mockResolvedValueOnce();
      mockConfigManager.getConfigPath.mockReturnValueOnce('/path/to/config.json');

      const result = await server.configureAnkiSetup(args);

      expect(mockAnkiClient.createDeck).toHaveBeenCalledWith('NewDeck');
      expect(mockConfigManager.saveConfig).toHaveBeenCalledWith({
        preferredDeck: 'NewDeck',
        preferredNoteType: 'Basic',
        fieldMappings: { primary: 'Front', secondary: 'Back' },
      });

      expect(result.content[0].text).toContain('NewDeck');
      expect(result.content[0].text).toContain('Basic');
    });

    it('should handle deck creation errors gracefully', async () => {
      const args = {
        deck: 'ExistingDeck',
        noteType: 'Basic',
        fieldMappings: {},
      };

      mockAnkiClient.createDeck.mockRejectedValueOnce(new Error('Deck already exists'));
      mockConfigManager.saveConfig.mockResolvedValueOnce();
      mockConfigManager.getConfigPath.mockReturnValueOnce('/path/to/config.json');

      const result = await server.configureAnkiSetup(args);

      expect(result.content[0].text).toContain('ExistingDeck');
    });
  });

  describe('getAnkiInfo', () => {
    it('should return comprehensive Anki information', async () => {
      const mockConfig: UserConfig = {
        preferredDeck: 'Default',
        preferredNoteType: 'Basic',
        fieldMappings: { primary: 'Front' },
      };

      mockConfigManager.loadConfig.mockResolvedValueOnce(mockConfig);
      mockAnkiClient.getNoteTypes.mockResolvedValueOnce([
        { name: 'Basic', fields: ['Front', 'Back'] },
      ]);
      mockAnkiClient.getDeckNames.mockResolvedValueOnce(['Default', 'Japanese']);

      const result = await server.getAnkiInfo();

      expect(mockAnkiClient.getDeckNames).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Default');
      expect(result.content[0].text).toContain('Japanese');
      expect(result.content[0].text).toContain('Basic');
      expect(result.content[0].text).toContain('Front');
    });
  });

  describe('addSmartCard', () => {
    it('should add card with semantic mapping', async () => {
      const mockConfig: UserConfig = {
        preferredDeck: 'TestDeck',
        preferredNoteType: 'Basic',
        fieldMappings: { primary: 'Front', secondary: 'Back' },
      };

      const args = {
        content: { primary: 'Question', secondary: 'Answer' },
        tags: ['test'],
      };

      mockConfigManager.loadConfig.mockResolvedValueOnce(mockConfig);
      mockAnkiClient.getNoteTypes.mockResolvedValueOnce([]);
      mockFieldMapper.applyMapping.mockReturnValueOnce({
        Front: 'Question',
        Back: 'Answer',
      });
      mockAnkiClient.addNote.mockResolvedValueOnce(1234567890);

      const result = await server.addSmartCard(args);

      expect(mockFieldMapper.applyMapping).toHaveBeenCalledWith(
        { primary: 'Front', secondary: 'Back' },
        { primary: 'Question', secondary: 'Answer' }
      );
      expect(mockAnkiClient.addNote).toHaveBeenCalledWith({
        deckName: 'TestDeck',
        modelName: 'Basic',
        fields: { Front: 'Question', Back: 'Answer' },
        tags: ['test'],
      });
      expect(result.content[0].text).toContain('1234567890');
    });

    it('should throw error when no fields are mapped', async () => {
      const mockConfig: UserConfig = {
        preferredDeck: 'TestDeck',
        preferredNoteType: 'Basic',
        fieldMappings: { primary: 'Front' },
      };

      const args = {
        content: { unmapped: 'Content' },
      };

      mockConfigManager.loadConfig.mockResolvedValueOnce(mockConfig);
      mockAnkiClient.getNoteTypes.mockResolvedValueOnce([]);
      mockFieldMapper.applyMapping.mockReturnValueOnce({});

      await expect(server.addSmartCard(args)).rejects.toThrow(
        'No fields were mapped. Please check your configuration.'
      );
    });

    it('should use custom deck and note type when provided', async () => {
      const mockConfig: UserConfig = {
        preferredDeck: 'Default',
        preferredNoteType: 'Basic',
        fieldMappings: { primary: 'Front' },
      };

      const args = {
        content: { primary: 'Question' },
        deck: 'CustomDeck',
        noteType: 'CustomType',
      };

      mockConfigManager.loadConfig.mockResolvedValueOnce(mockConfig);
      mockAnkiClient.getNoteTypes.mockResolvedValueOnce([]);
      mockFieldMapper.applyMapping.mockReturnValueOnce({ Front: 'Question' });
      mockAnkiClient.addNote.mockResolvedValueOnce(1234567890);

      await server.addSmartCard(args);

      expect(mockAnkiClient.addNote).toHaveBeenCalledWith({
        deckName: 'CustomDeck',
        modelName: 'CustomType',
        fields: { Front: 'Question' },
        tags: [],
      });
    });
  });

  describe('suggestFieldMapping', () => {
    it('should return field mapping suggestions', async () => {
      const mockConfig: UserConfig = {
        preferredDeck: 'Default',
        preferredNoteType: 'Basic',
        fieldMappings: {},
      };

      mockConfigManager.loadConfig.mockResolvedValueOnce(mockConfig);
      mockAnkiClient.getNoteTypes.mockResolvedValueOnce([
        { name: 'Japanese', fields: ['Expression', 'Reading', 'Meaning'] },
      ]);
      mockFieldMapper.suggestMappings.mockReturnValueOnce({
        primary: 'Expression',
        reading: 'Reading',
        secondary: 'Meaning',
      });

      const result = await server.suggestFieldMapping({ noteType: 'Japanese' });

      expect(mockFieldMapper.suggestMappings).toHaveBeenCalledWith({
        name: 'Japanese',
        fields: ['Expression', 'Reading', 'Meaning'],
      });
      expect(result.content[0].text).toContain('Japanese');
      expect(result.content[0].text).toContain('primary → Expression');
    });

    it('should throw error for non-existent note type', async () => {
      const mockConfig: UserConfig = {
        preferredDeck: 'Default',
        preferredNoteType: 'Basic',
        fieldMappings: {},
      };

      mockConfigManager.loadConfig.mockResolvedValueOnce(mockConfig);
      mockAnkiClient.getNoteTypes.mockResolvedValueOnce([
        { name: 'Basic', fields: ['Front', 'Back'] },
      ]);

      await expect(server.suggestFieldMapping({ noteType: 'NonExistent' }))
        .rejects.toThrow('Note type "NonExistent" not found.');
    });
  });

  describe('analyzeExistingDeck', () => {
    it('should analyze deck and return formatted report', async () => {
      const mockAnalysisResult = {
        deckName: 'TestDeck',
        sampleSize: 3,
        primaryNoteType: 'Basic',
        fieldAnalysis: { Front: 'Questions', Back: 'Answers' },
        suggestedMappings: { primary: 'Front', secondary: 'Back' },
      };

      mockDeckAnalyzer.analyzeDeck.mockResolvedValueOnce(mockAnalysisResult);
      mockDeckAnalyzer.generateReport.mockReturnValueOnce('Analysis report text');

      const result = await server.analyzeExistingDeck({ deck: 'TestDeck', sampleSize: 3 });

      expect(mockDeckAnalyzer.analyzeDeck).toHaveBeenCalledWith('TestDeck', 3);
      expect(mockDeckAnalyzer.generateReport).toHaveBeenCalledWith(mockAnalysisResult);
      expect(result.content[0].text).toBe('Analysis report text');
    });

    it('should use default sample size when not provided', async () => {
      const mockAnalysisResult = {
        deckName: 'TestDeck',
        sampleSize: 5,
        primaryNoteType: 'Basic',
        fieldAnalysis: {},
        suggestedMappings: {},
      };

      mockDeckAnalyzer.analyzeDeck.mockResolvedValueOnce(mockAnalysisResult);
      mockDeckAnalyzer.generateReport.mockReturnValueOnce('Report');

      await server.analyzeExistingDeck({ deck: 'TestDeck' });

      expect(mockDeckAnalyzer.analyzeDeck).toHaveBeenCalledWith('TestDeck', 5);
    });
  });

  describe('autoConfigureFromDeck', () => {
    it('should return suggestions without confirmation', async () => {
      const mockAnalysisResult = {
        deckName: 'TestDeck',
        sampleSize: 5,
        primaryNoteType: 'Basic',
        fieldAnalysis: {},
        suggestedMappings: { primary: 'Front', secondary: 'Back' },
      };

      mockDeckAnalyzer.analyzeDeck.mockResolvedValueOnce(mockAnalysisResult);
      mockDeckAnalyzer.generateReport.mockReturnValueOnce('Analysis report');

      const result = await server.autoConfigureFromDeck({ deck: 'TestDeck', confirm: false });

      expect(result.content[0].text).toContain('Analysis report');
      expect(result.content[0].text).toContain('confirm: true');
      expect(mockConfigManager.saveConfig).not.toHaveBeenCalled();
    });

    it('should apply configuration when confirmed', async () => {
      const mockAnalysisResult = {
        deckName: 'TestDeck',
        sampleSize: 5,
        primaryNoteType: 'Basic',
        fieldAnalysis: {},
        suggestedMappings: { primary: 'Front', secondary: 'Back' },
      };

      mockDeckAnalyzer.analyzeDeck.mockResolvedValueOnce(mockAnalysisResult);
      mockAnkiClient.findCards.mockResolvedValueOnce([1]);
      mockAnkiClient.getCardsInfo.mockResolvedValueOnce([{
        modelName: 'Basic',
        fields: { Front: { value: 'test', order: 0 }, Back: { value: 'test', order: 1 } },
      } as any]);
      mockAnkiClient.createDeck.mockResolvedValueOnce();
      mockConfigManager.saveConfig.mockResolvedValueOnce();
      mockConfigManager.getConfigPath.mockReturnValueOnce('/path/to/config.json');

      const result = await server.autoConfigureFromDeck({ deck: 'TestDeck', confirm: true });

      expect(mockConfigManager.saveConfig).toHaveBeenCalledWith({
        preferredDeck: 'TestDeck',
        preferredNoteType: 'Basic',
        fieldMappings: { primary: 'Front', secondary: 'Back' },
      });
      expect(result.content[0].text).toContain('TestDeck');
    });
  });
});