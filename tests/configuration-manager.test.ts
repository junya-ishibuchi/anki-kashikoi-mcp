import { ConfigurationManager } from '../src/services/configuration-manager.js';
import type { UserConfig } from '../src/types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock fs and os modules
jest.mock('fs/promises');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  const mockHomedir = '/home/testuser';
  
  beforeAll(() => {
    mockOs.homedir.mockReturnValue(mockHomedir);
  });

  beforeEach(() => {
    mockFs.readFile.mockClear();
    mockFs.writeFile.mockClear();
    mockFs.mkdir.mockClear();
    configManager = new ConfigurationManager();
  });

  const getExpectedConfigPath = (): string => {
    const configDir = path.join(mockHomedir, '.config');
    return path.join(configDir, 'anki-kashikoi-mcp', 'config.json');
  };

  describe('constructor', () => {
    it('should initialize with default config path using home directory', () => {
      expect(configManager).toBeDefined();
    });

  });

  describe('loadConfig', () => {
    it('should load existing configuration from file', async () => {
      const mockConfig: UserConfig = {
        preferredDeck: 'CustomDeck',
        preferredNoteType: 'CustomType',
        fieldMappings: {
          primary: 'Front',
          secondary: 'Back',
        },
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig));

      const result = await configManager.loadConfig();

      expect(mockFs.readFile).toHaveBeenCalledWith(getExpectedConfigPath(), 'utf-8');
      expect(result).toEqual(mockConfig);
    });

    it('should return default configuration when file does not exist', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

      const result = await configManager.loadConfig();

      const expectedDefault: UserConfig = {
        preferredDeck: 'Default',
        preferredNoteType: 'Basic',
        fieldMappings: {
          primary: 'Front',
          secondary: 'Back',
        },
      };

      expect(result).toEqual(expectedDefault);
      consoleErrorSpy.mockRestore();
    });

    it('should return default configuration when file contains invalid JSON', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFs.readFile.mockResolvedValueOnce('invalid json content');

      const result = await configManager.loadConfig();

      const expectedDefault: UserConfig = {
        preferredDeck: 'Default',
        preferredNoteType: 'Basic',
        fieldMappings: {
          primary: 'Front',
          secondary: 'Back',
        },
      };

      expect(result).toEqual(expectedDefault);
      consoleErrorSpy.mockRestore();
    });

    it('should handle file system errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFs.readFile.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await configManager.loadConfig();

      const expectedDefault: UserConfig = {
        preferredDeck: 'Default',
        preferredNoteType: 'Basic',
        fieldMappings: {
          primary: 'Front',
          secondary: 'Back',
        },
      };

      expect(result).toEqual(expectedDefault);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('saveConfig', () => {
    it('should save configuration to file', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const config: UserConfig = {
        preferredDeck: 'TestDeck',
        preferredNoteType: 'TestType',
        fieldMappings: {
          question: 'Question',
          answer: 'Answer',
        },
      };

      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce();

      await configManager.saveConfig(config);

      const expectedConfigPath = getExpectedConfigPath();
      const expectedConfigDir = path.dirname(expectedConfigPath);
      expect(mockFs.mkdir).toHaveBeenCalledWith(expectedConfigDir, { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expectedConfigPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should throw error when write fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const config: UserConfig = {
        preferredDeck: 'TestDeck',
        preferredNoteType: 'TestType',
        fieldMappings: {},
      };

      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockRejectedValueOnce(new Error('Write permission denied'));

      await expect(configManager.saveConfig(config)).rejects.toThrow(
        'Failed to save configuration: Write permission denied'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should throw error when directory creation fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const config: UserConfig = {
        preferredDeck: 'TestDeck',
        preferredNoteType: 'TestType',
        fieldMappings: {},
      };

      mockFs.mkdir.mockRejectedValueOnce(new Error('Directory creation failed'));

      await expect(configManager.saveConfig(config)).rejects.toThrow(
        'Failed to save configuration: Directory creation failed'
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getConfigPath', () => {
    it('should return the configuration file path', () => {
      const configPath = configManager.getConfigPath();
      expect(configPath).toBe(getExpectedConfigPath());
    });

  });

  describe('validateConfig', () => {
    it('should return true for valid configuration', () => {
      const validConfig: UserConfig = {
        preferredDeck: 'ValidDeck',
        preferredNoteType: 'ValidType',
        fieldMappings: {
          primary: 'Front',
          secondary: 'Back',
        },
      };

      const result = configManager.validateConfig(validConfig);
      expect(result).toBe(true);
    });

    it('should return false for configuration with missing required fields', () => {
      const invalidConfig = {
        preferredDeck: 'ValidDeck',
        // missing preferredNoteType
        fieldMappings: {},
      } as UserConfig;

      const result = configManager.validateConfig(invalidConfig);
      expect(result).toBe(false);
    });

    it('should return false for configuration with invalid types', () => {
      const invalidConfig = {
        preferredDeck: 123, // should be string
        preferredNoteType: 'ValidType',
        fieldMappings: {},
      } as unknown as UserConfig;

      const result = configManager.validateConfig(invalidConfig);
      expect(result).toBe(false);
    });

    it('should return false for null or undefined config', () => {
      expect(configManager.validateConfig(null as unknown as UserConfig)).toBe(false);
      expect(configManager.validateConfig(undefined as unknown as UserConfig)).toBe(false);
    });
  });
});