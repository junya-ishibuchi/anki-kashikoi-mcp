import type { AnkiConnectClient } from './anki-connect-client.js';
import type { AnkiNoteInfo, DeckConfig } from '../types/index.js';

export interface DeckAnalysisResult {
  readonly noteType: string;
  readonly fields: readonly string[];
}

export class DeckAnalyzer {
  constructor(
    private readonly ankiClient: AnkiConnectClient
  ) {}

  async analyzeDeck(deckName: string, sampleSize = 5): Promise<DeckAnalysisResult> {
    const notesInfo = await this.ankiClient.getNotesInfo({ query: `deck:"${deckName}"` });
    
    if (notesInfo.length === 0) {
      throw new Error(`Deck "${deckName}" contains no cards`);
    }

    const actualSampleSize = Math.min(sampleSize, notesInfo.length);
    const sampleNotes = notesInfo.slice(0, actualSampleSize);

    const primaryNoteType = this.getPrimaryNoteTypeFromNotes(sampleNotes);
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


  private getPrimaryNoteTypeFromNotes(notes: AnkiNoteInfo[]): string {
    const noteTypeCounts: Record<string, number> = {};

    for (const note of notes) {
      if (note.modelName) {
        noteTypeCounts[note.modelName] = (noteTypeCounts[note.modelName] || 0) + 1;
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