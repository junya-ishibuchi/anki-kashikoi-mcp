import type {
  AnkiConnectRequest,
  AnkiConnectResponse,
  AnkiNoteType,
  AnkiNote,
  AnkiCard,
} from '../types/index.js';

export class AnkiConnectClient {
  private readonly ankiConnectUrl: string;
  private readonly version = 6;

  constructor(ankiConnectUrl = 'http://localhost:8765') {
    this.ankiConnectUrl = ankiConnectUrl;
  }

  async sendRequest<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const request: AnkiConnectRequest = {
      action,
      version: this.version,
      params,
    };

    try {
      const response = await fetch(this.ankiConnectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const data: AnkiConnectResponse<T> = await response.json();

      if (data.error) {
        throw new Error(`AnkiConnect error: ${data.error}`);
      }

      return data.result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Unknown error occurred: ${String(error)}`);
    }
  }

  async getDeckNames(): Promise<string[]> {
    return this.sendRequest<string[]>('deckNames');
  }

  async getNoteTypes(): Promise<AnkiNoteType[]> {
    const noteTypeNames = await this.sendRequest<string[]>('modelNames');
    const noteTypes: AnkiNoteType[] = [];

    for (const name of noteTypeNames) {
      const fields = await this.sendRequest<string[]>('modelFieldNames', {
        modelName: name,
      });
      noteTypes.push({ name, fields });
    }

    return noteTypes;
  }

  async createDeck(deckName: string): Promise<void> {
    try {
      await this.sendRequest('createDeck', { deck: deckName });
    } catch (error) {
      if (error instanceof Error && error.message.includes('deck already exists')) {
        return; // Ignore error if deck already exists
      }
      throw error;
    }
  }

  async addNote(note: AnkiNote): Promise<number> {
    return this.sendRequest<number>('addNote', { note });
  }

  async findCards(query: string): Promise<number[]> {
    return this.sendRequest<number[]>('findCards', { query });
  }

  async getCardsInfo(cardIds: number[]): Promise<AnkiCard[]> {
    return this.sendRequest<AnkiCard[]>('cardsInfo', { cards: cardIds });
  }
}