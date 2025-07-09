// Direct field mapping types
export interface DeckConfig {
  readonly noteType: string;
  readonly fields: readonly string[];
}

export interface UserConfigNew {
  readonly decks: Record<string, DeckConfig>;
  readonly defaultDeck?: string;
}

export interface AddCardParams {
  readonly deck?: string;
  readonly content: Record<string, string>;
}