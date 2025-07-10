import type { AnkiConnectClient } from './anki-connect-client.js';
import type { DeckConfig } from '../types/index.js';

export class DeckAnalyzer {
  constructor(
    private readonly ankiClient: AnkiConnectClient
  ) {}

  async analyzeDeck(deckName: string): Promise<DeckConfig> {
    const notesInfo = await this.ankiClient.getNotesInfo({ query: `deck:"${deckName}"` });
    
    if (notesInfo.length === 0) {
      throw new Error(`Deck "${deckName}" contains no cards`);
    }

    const noteType = notesInfo[0].modelName;
    if (!noteType || noteType === '') {
      throw new Error('First note in deck has no model name');
    }
    
    const fields = await this.ankiClient.getModelFieldNames(noteType);

    return {
      noteType,
      fields
    };
  }

  async getFieldsForDeck(deckName: string): Promise<DeckConfig> {
    return this.analyzeDeck(deckName);
  }
}