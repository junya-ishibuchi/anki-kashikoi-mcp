import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { UserConfigNew, DeckConfig } from '../types/index.js';

export class ConfigurationManager {
  private readonly configFilePath: string;

  constructor() {
    const configDir = path.join(os.homedir(), '.config');
    this.configFilePath = path.join(configDir, 'anki-kashikoi-mcp', 'config.json');
  }

  async loadConfig(): Promise<UserConfigNew> {
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

  async saveConfig(config: UserConfigNew): Promise<void> {
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

  async addDeckConfig(deckName: string, deckConfig: DeckConfig): Promise<void> {
    const config = await this.loadConfig();
    const updatedConfig: UserConfigNew = {
      ...config,
      decks: {
        ...config.decks,
        [deckName]: deckConfig
      }
    };
    await this.saveConfig(updatedConfig);
  }

  async setDefaultDeck(deckName: string): Promise<void> {
    const config = await this.loadConfig();
    const updatedConfig: UserConfigNew = {
      ...config,
      defaultDeck: deckName
    };
    await this.saveConfig(updatedConfig);
  }

  async getDeckConfig(deckName: string): Promise<DeckConfig | undefined> {
    const config = await this.loadConfig();
    return config.decks[deckName];
  }

  getConfigPath(): string {
    return this.configFilePath;
  }

  validateConfig(config: unknown): config is UserConfigNew {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const candidate = config as Record<string, unknown>;

    // Check if decks property exists and is an object
    if (!candidate.decks || typeof candidate.decks !== 'object' || Array.isArray(candidate.decks)) {
      return false;
    }

    // Validate each deck configuration
    const decks = candidate.decks as Record<string, unknown>;
    for (const deckConfig of Object.values(decks)) {
      if (!this.validateDeckConfig(deckConfig)) {
        return false;
      }
    }

    // defaultDeck is optional but must be a string if present
    if (candidate.defaultDeck !== undefined && typeof candidate.defaultDeck !== 'string') {
      return false;
    }

    return true;
  }

  private validateDeckConfig(config: unknown): config is DeckConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const candidate = config as Record<string, unknown>;

    return (
      typeof candidate.noteType === 'string' &&
      Array.isArray(candidate.fields) &&
      candidate.fields.every((field: unknown) => typeof field === 'string')
    );
  }

  private getDefaultConfig(): UserConfigNew {
    return {
      decks: {
        'Default': {
          noteType: 'Basic',
          fields: ['Front', 'Back']
        }
      },
      defaultDeck: 'Default'
    };
  }
}