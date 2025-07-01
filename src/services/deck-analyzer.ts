import type { AnkiConnectClient } from './anki-connect-client.js';
import type { FieldMapper } from './field-mapper.js';
import type { AnkiCard, DeckAnalysisResult, AnkiNoteType } from '../types/index.js';

export class DeckAnalyzer {
  constructor(
    private readonly ankiClient: AnkiConnectClient,
    private readonly fieldMapper: FieldMapper
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
    const fieldSamples = this.getFieldSamples(cardsInfo);
    const fieldAnalysis = this.analyzeFields(fieldSamples);
    
    const mockNoteType: AnkiNoteType = {
      name: primaryNoteType,
      fields: Object.keys(fieldSamples),
    };
    const suggestedMappings = this.fieldMapper.suggestMappings(mockNoteType);

    return {
      deckName,
      sampleSize: actualSampleSize,
      primaryNoteType,
      fieldAnalysis,
      suggestedMappings,
    };
  }

  analyzeFieldContent(fieldName: string, samples: string[]): string {
    const fieldLower = fieldName.toLowerCase();
    const contentSample = samples.join(' ').toLowerCase();

    // Field name analysis
    if (fieldLower.includes('expression') || fieldLower.includes('pronunciation')) {
      return 'English expressions or pronunciation';
    }
    if (fieldLower.includes('phonetic') || fieldLower.includes('pronunciation')) {
      return 'Pronunciation or phonetic information';
    }
    if (fieldLower.includes('example') || fieldLower.includes('sentence')) {
      return 'Usage examples or sample sentences';
    }
    if (fieldLower.includes('meaning') || fieldLower.includes('translation')) {
      return 'Meaning or translation';
    }
    if (fieldLower.includes('explanation') || fieldLower.includes('description')) {
      return 'Detailed explanation or description';
    }
    if (fieldLower.includes('grammar')) {
      return 'Grammar information';
    }
    if (fieldLower.includes('synonym') || fieldLower.includes('related')) {
      return 'Synonyms or related words';
    }
    if (fieldLower.includes('collocation')) {
      return 'Word collocations';
    }

    // Content analysis
    if (/\/.*\//.test(contentSample)) {
      return 'Likely pronunciation symbols';
    }
    if (contentSample.includes('example:') || contentSample.includes('usage:')) {
      return 'Examples or usage demonstrations';
    }
    if (samples.some(s => s.length > 100)) {
      return 'Long detailed explanations';
    }
    if (samples.some(s => s.length < 20)) {
      return 'Short words or phrases';
    }

    return 'General content (purpose unclear)';
  }

  generateReport(analysisResult: DeckAnalysisResult): string {
    let report = `=== Deck Analysis Report ===\\n\\n`;
    report += `Deck: ${analysisResult.deckName}\\n`;
    report += `Sample size: ${analysisResult.sampleSize}\\n`;
    report += `Primary note type: ${analysisResult.primaryNoteType}\\n\\n`;

    report += `Field Analysis:\\n`;
    for (const [field, analysis] of Object.entries(analysisResult.fieldAnalysis)) {
      report += `- ${field}: ${analysis}\\n`;
    }

    report += `\\nSuggested Semantic Mappings:\\n`;
    if (Object.keys(analysisResult.suggestedMappings).length === 0) {
      report += `No semantic mappings suggested\\n`;
    } else {
      for (const [semantic, field] of Object.entries(analysisResult.suggestedMappings)) {
        report += `- ${semantic} → ${field}\\n`;
      }
    }

    return report;
  }

  getFieldSamples(cards: AnkiCard[]): Record<string, string[]> {
    const fieldSamples: Record<string, string[]> = {};

    for (const card of cards) {
      for (const [fieldName, fieldData] of Object.entries(card.fields)) {
        if (!fieldSamples[fieldName]) {
          fieldSamples[fieldName] = [];
        }

        if (fieldData.value && fieldData.value.trim() !== '') {
          const truncatedValue = fieldData.value.length > 50 
            ? fieldData.value.substring(0, 50) 
            : fieldData.value;
          fieldSamples[fieldName].push(truncatedValue);
        }
      }
    }

    return fieldSamples;
  }

  private getPrimaryNoteType(cards: AnkiCard[]): string {
    const noteTypeCounts: Record<string, number> = {};

    for (const card of cards) {
      noteTypeCounts[card.modelName] = (noteTypeCounts[card.modelName] || 0) + 1;
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

  private analyzeFields(fieldSamples: Record<string, string[]>): Record<string, string> {
    const analysis: Record<string, string> = {};

    for (const [fieldName, samples] of Object.entries(fieldSamples)) {
      analysis[fieldName] = this.analyzeFieldContent(fieldName, samples);
    }

    return analysis;
  }
}