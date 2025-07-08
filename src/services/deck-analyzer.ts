import type { AnkiConnectClient } from './anki-connect-client.js';
import type { AnkiCard, DeckConfig } from '../types/index.js';

export interface DeckAnalysisResult {
  readonly deckName: string;
  readonly noteType: string;
  readonly fields: readonly string[];
  readonly sampleSize: number;
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
      deckName,
      noteType: primaryNoteType,
      fields,
      sampleSize: cardsInfo.length
    };
  }

  async getFieldsForDeck(deckName: string): Promise<DeckConfig> {
    const analysis = await this.analyzeDeck(deckName, 1);
    return {
      noteType: analysis.noteType,
      fields: analysis.fields
    };
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

  generateReport(analysisResult: DeckAnalysisResult): string {
    let report = `=== Deck Analysis Report ===\\n\\n`;
    report += `Deck: ${analysisResult.deckName}\\n`;
    report += `Note Type: ${analysisResult.noteType}\\n`;
    report += `Sample size: ${analysisResult.sampleSize}\\n\\n`;

    report += `Fields:\\n`;
    for (const field of analysisResult.fields) {
      report += `- ${field}\\n`;
    }

    return report;
  }
}