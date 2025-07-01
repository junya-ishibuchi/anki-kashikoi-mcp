import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { UserConfig } from '../types/index.js';

export class ConfigurationManager {
  private readonly configFilePath: string;

  constructor() {
    const configDir = path.join(os.homedir(), '.config');
    this.configFilePath = path.join(configDir, 'anki-kashikoi-mcp', 'config.json');
  }

  async loadConfig(): Promise<UserConfig> {
    try {
      const configData = await fs.readFile(this.configFilePath, 'utf-8');
      const config = JSON.parse(configData);
      
      if (this.validateConfig(config)) {
        return config;
      }
      
      console.error('Invalid configuration file format, using defaults');
      return this.getDefaultConfig();
    } catch (error) {
      console.error('Configuration file not found or unreadable, using defaults');
      return this.getDefaultConfig();
    }
  }

  async saveConfig(config: UserConfig): Promise<void> {
    try {
      const configDir = path.dirname(this.configFilePath);
      await fs.mkdir(configDir, { recursive: true });
      
      await fs.writeFile(
        this.configFilePath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      
      console.error(`Configuration saved to: ${this.configFilePath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to save configuration: ${errorMessage}`);
      throw new Error(`Failed to save configuration: ${errorMessage}`);
    }
  }

  getConfigPath(): string {
    return this.configFilePath;
  }

  validateConfig(config: unknown): config is UserConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const candidate = config as Record<string, unknown>;

    return (
      typeof candidate.preferredDeck === 'string' &&
      typeof candidate.preferredNoteType === 'string' &&
      typeof candidate.fieldMappings === 'object' &&
      candidate.fieldMappings !== null &&
      !Array.isArray(candidate.fieldMappings)
    );
  }

  private getDefaultConfig(): UserConfig {
    return {
      preferredDeck: 'Default',
      preferredNoteType: 'Basic',
      fieldMappings: {
        primary: 'Front',
        secondary: 'Back',
      },
    };
  }
}