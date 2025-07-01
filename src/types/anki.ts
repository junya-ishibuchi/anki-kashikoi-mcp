export interface AnkiConnectRequest {
  readonly action: string;
  readonly version: number;
  readonly params?: Record<string, unknown>;
}

export interface AnkiConnectResponse<T = unknown> {
  readonly result: T;
  readonly error: string | null;
}

export interface AnkiNoteType {
  readonly name: string;
  readonly fields: readonly string[];
}

export interface AnkiNote {
  readonly deckName: string;
  readonly modelName: string;
  readonly fields: Record<string, string>;
  readonly tags?: readonly string[];
}

export interface AnkiCard {
  readonly cardId: number;
  readonly fields: Record<string, { value: string; order: number }>;
  readonly fieldOrder: number;
  readonly question: string;
  readonly answer: string;
  readonly modelName: string;
  readonly deckName: string;
  readonly css: string;
  readonly factor: number;
  readonly interval: number;
  readonly note: number;
  readonly type: number;
  readonly queue: number;
  readonly due: number;
  readonly reps: number;
  readonly lapses: number;
  readonly left: number;
  readonly odue: number;
  readonly odid: number;
  readonly mod: number;
  readonly usn: number;
}

export interface DeckInfo {
  readonly name: string;
  readonly id: number;
}