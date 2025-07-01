export interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export interface ConfigureAnkiSetupArgs {
  readonly deck: string;
  readonly noteType: string;
  readonly fieldMappings?: Record<string, string>;
}

export interface AddSmartCardArgs {
  readonly content: Record<string, string>;
  readonly deck?: string;
  readonly noteType?: string;
  readonly tags?: readonly string[];
}

export interface SuggestFieldMappingArgs {
  readonly noteType: string;
}

export interface AnalyzeExistingDeckArgs {
  readonly deck: string;
  readonly sampleSize?: number;
}

export interface AutoConfigureFromDeckArgs {
  readonly deck: string;
  readonly confirm?: boolean;
}