export interface UserConfig {
  readonly preferredDeck: string;
  readonly preferredNoteType: string;
  readonly fieldMappings: Record<string, string>;
}

export interface ConfigOptions {
  readonly deck: string;
  readonly noteType: string;
  readonly fieldMappings?: Record<string, string>;
}

export interface SmartCardContent {
  readonly content: Record<string, string>;
  readonly deck?: string;
  readonly noteType?: string;
  readonly tags?: readonly string[];
}

export interface FieldMappingSuggestion {
  readonly semantic: string;
  readonly field: string;
  readonly confidence: number;
}

export interface DeckAnalysisResult {
  readonly deckName: string;
  readonly sampleSize: number;
  readonly primaryNoteType: string;
  readonly fieldAnalysis: Record<string, string>;
  readonly suggestedMappings: Record<string, string>;
}