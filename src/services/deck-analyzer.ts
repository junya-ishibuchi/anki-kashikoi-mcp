import type { AnkiConnectClient } from './anki-connect-client.js';
import type { AnkiCard, DeckConfig } from '../types/index.js';

export interface DeckAnalysisResult {
  readonly noteType: string;
  readonly fields: readonly string[];
}

export class DeckAnalyzer {
  constructor(
    private readonly ankiClient: AnkiConnectClient
  ) {}

  async analyzeDeck(deckName: string, sampleSize = 5): Promise<DeckAnalysisResult> {
    const cardIds = await this.ankiClient.findCards(`deck:"${deckName}"`);
    
    if (cardIds.length === 0) {
      throw new Error(`Deck "${deckName}" contains no cards`);
    }

    const actualSampleSize = Math.min(sampleSize, cardIds.length);
    const sampleCardIds = cardIds.slice(0, actualSampleSize);
    const cardsInfo = await this.ankiClient.getCardsInfo(sampleCardIds);

    const primaryNoteType = this.getPrimaryNoteType(cardsInfo);
    const fields = await this.getFieldsForNoteType(primaryNoteType);

    return {
      noteType: primaryNoteType,
      fields
    };
  }

  async getFieldsForDeck(deckName: string): Promise<DeckConfig> {
    return await this.analyzeDeck(deckName, 1);
  }

  private async getFieldsForNoteType(noteTypeName: string): Promise<readonly string[]> {
    const fields = await this.ankiClient.getModelFieldNames(noteTypeName);
    return fields;
  }

  private getPrimaryNoteType(cards: AnkiCard[]): string {
    const noteTypeCounts: Record<string, number> = {};

    for (const card of cards) {
      if (card.modelName) {
        noteTypeCounts[card.modelName] = (noteTypeCounts[card.modelName] || 0) + 1;
      }
    }

    let primaryType = '';
    let maxCount = 0;

    for (const [noteType, count] of Object.entries(noteTypeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryType = noteType;
      }
    }

    return primaryType;
  }

}