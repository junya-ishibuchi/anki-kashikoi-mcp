import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigurationManager } from '../src/services/configuration-manager.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { UserConfigNew, DeckConfig } from '../src/types/index.js';

jest.mock('fs/promises');
jest.mock('os');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedOs = os as jest.Mocked<typeof os>;

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  const mockHomedir = '/mock/home';
  const configPath = path.join(mockHomedir, '.config', 'anki-kashikoi-mcp', 'config.json');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedOs.homedir.mockReturnValue(mockHomedir);
    configManager = new ConfigurationManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should set config file path correctly', () => {
      expect(configManager.getConfigPath()).toBe(configPath);
    });
  });

  describe('loadConfig', () => {
    it('should load and parse valid configuration', async () => {
      const mockConfig: UserConfigNew = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: ['Expression', 'Reading', 'Meaning', 'Sentence']
          },
          'Medical': {
            noteType: 'Medical Card',
            fields: ['Term', 'Definition', 'Category']
          }
        },
        defaultDeck: 'Japanese'
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const config = await configManager.loadConfig();

      expect(config).toEqual(mockConfig);
      expect(mockedFs.readFile).toHaveBeenCalledWith(configPath, 'utf-8');
    });

    it('should throw error when file does not exist', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(configManager.loadConfig()).rejects.toThrow(
        `Configuration file not found at: ${configPath}. Please run configuration setup first.`
      );
    });

    it('should throw error when JSON is invalid', async () => {
      mockedFs.readFile.mockResolvedValue('invalid json');

      await expect(configManager.loadConfig()).rejects.toThrow(
        `Configuration file not found at: ${configPath}. Please run configuration setup first.`
      );
    });

    it('should throw error when file format is invalid', async () => {
      const invalidConfig = {
        // Missing required 'decks' property
        defaultDeck: 'Japanese'
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(configManager.loadConfig()).rejects.toThrow(
        'Invalid configuration file format'
      );
    });
  });

  describe('saveConfig', () => {
    it('should create directory and save configuration', async () => {
      const config: UserConfigNew = {
        decks: {
          'Spanish': {
            noteType: 'Basic',
            fields: ['Front', 'Back', 'Extra']
          }
        },
        defaultDeck: 'Spanish'
      };

      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await configManager.saveConfig(config);

      expect(mockedFs.mkdir).toHaveBeenCalledWith(
        path.dirname(configPath),
        { recursive: true }
      );
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    });

    it('should throw error when save fails', async () => {
      const config: UserConfigNew = {
        decks: {}
      };

      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(configManager.saveConfig(config)).rejects.toThrow('Failed to save configuration: Permission denied');
    });
  });

  describe('addDeckConfig', () => {
    it('should add new deck configuration', async () => {
      const existingConfig: UserConfigNew = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: ['Expression', 'Reading', 'Meaning']
          }
        }
      };

      const newDeckConfig: DeckConfig = {
        noteType: 'Spanish Card',
        fields: ['Spanish', 'English', 'Example']
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(existingConfig));
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await configManager.addDeckConfig('Spanish', newDeckConfig);

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify({
          decks: {
            'Japanese': existingConfig.decks['Japanese'],
            'Spanish': newDeckConfig
          }
        }, null, 2),
        'utf-8'
      );
    });

    it('should overwrite existing deck configuration', async () => {
      const existingConfig: UserConfigNew = {
        decks: {
          'Japanese': {
            noteType: 'Basic',
            fields: ['Front', 'Back']
          }
        }
      };

      const updatedDeckConfig: DeckConfig = {
        noteType: 'Japanese (recognition)',
        fields: ['Expression', 'Reading', 'Meaning', 'Sentence']
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(existingConfig));
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await configManager.addDeckConfig('Japanese', updatedDeckConfig);

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify({
          decks: {
            'Japanese': updatedDeckConfig
          }
        }, null, 2),
        'utf-8'
      );
    });

    it('should create new config when file does not exist', async () => {
      const newDeckConfig: DeckConfig = {
        noteType: 'Basic',
        fields: ['Front', 'Back']
      };

      mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await configManager.addDeckConfig('English', newDeckConfig);

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify({
          decks: {
            'English': newDeckConfig
          },
          defaultDeck: 'English'
        }, null, 2),
        'utf-8'
      );
    });
  });

  describe('setDefaultDeck', () => {
    it('should set default deck', async () => {
      const config: UserConfigNew = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: ['Expression', 'Reading', 'Meaning']
          },
          'Spanish': {
            noteType: 'Basic',
            fields: ['Front', 'Back']
          }
        },
        defaultDeck: 'Japanese'
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(config));
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await configManager.setDefaultDeck('Spanish');

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify({
          ...config,
          defaultDeck: 'Spanish'
        }, null, 2),
        'utf-8'
      );
    });

    it('should add default deck when none exists', async () => {
      const config: UserConfigNew = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: ['Expression', 'Reading', 'Meaning']
          }
        }
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(config));
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await configManager.setDefaultDeck('Japanese');

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify({
          ...config,
          defaultDeck: 'Japanese'
        }, null, 2),
        'utf-8'
      );
    });
  });

  describe('getDeckConfig', () => {
    it('should return deck configuration for existing deck', async () => {
      const config: UserConfigNew = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: ['Expression', 'Reading', 'Meaning']
          }
        }
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(config));

      const deckConfig = await configManager.getDeckConfig('Japanese');

      expect(deckConfig).toEqual({
        noteType: 'Japanese (recognition)',
        fields: ['Expression', 'Reading', 'Meaning']
      });
    });

    it('should return undefined for non-existent deck', async () => {
      const config: UserConfigNew = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: ['Expression', 'Reading', 'Meaning']
          }
        }
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(config));

      const deckConfig = await configManager.getDeckConfig('Spanish');

      expect(deckConfig).toBeUndefined();
    });

    it('should return undefined when config file does not exist', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const deckConfig = await configManager.getDeckConfig('Japanese');

      expect(deckConfig).toBeUndefined();
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const validConfig = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: ['Expression', 'Reading']
          }
        },
        defaultDeck: 'Japanese'
      };

      expect(configManager.validateConfig(validConfig)).toBe(true);
    });

    it('should validate configuration without defaultDeck', () => {
      const validConfig = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: ['Expression', 'Reading']
          }
        }
      };

      expect(configManager.validateConfig(validConfig)).toBe(true);
    });

    it('should reject null configuration', () => {
      expect(configManager.validateConfig(null)).toBe(false);
    });

    it('should reject non-object configuration', () => {
      expect(configManager.validateConfig('string')).toBe(false);
      expect(configManager.validateConfig(123)).toBe(false);
      expect(configManager.validateConfig(true)).toBe(false);
    });

    it('should reject configuration without decks property', () => {
      const invalidConfig = {
        defaultDeck: 'Japanese'
      };

      expect(configManager.validateConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with non-object decks', () => {
      expect(configManager.validateConfig({ decks: 'string' })).toBe(false);
      expect(configManager.validateConfig({ decks: [] })).toBe(false);
      expect(configManager.validateConfig({ decks: null })).toBe(false);
    });

    it('should reject configuration with invalid deck config', () => {
      const invalidConfig = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)'
            // Missing fields
          }
        }
      };

      expect(configManager.validateConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with non-string noteType', () => {
      const invalidConfig = {
        decks: {
          'Japanese': {
            noteType: 123,
            fields: ['Expression', 'Reading']
          }
        }
      };

      expect(configManager.validateConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with non-array fields', () => {
      const invalidConfig = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: 'Expression,Reading'
          }
        }
      };

      expect(configManager.validateConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with non-string field elements', () => {
      const invalidConfig = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: ['Expression', 123, 'Meaning']
          }
        }
      };

      expect(configManager.validateConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with non-string defaultDeck', () => {
      const invalidConfig = {
        decks: {
          'Japanese': {
            noteType: 'Japanese (recognition)',
            fields: ['Expression', 'Reading']
          }
        },
        defaultDeck: 123
      };

      expect(configManager.validateConfig(invalidConfig)).toBe(false);
    });
  });
});