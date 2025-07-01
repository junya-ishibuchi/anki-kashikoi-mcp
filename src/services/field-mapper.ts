import type { AnkiNoteType, FieldMappingSuggestion } from '../types/index.js';

interface SemanticPattern {
  readonly semantic: string;
  readonly keywords: readonly string[];
}

export class FieldMapper {
  private readonly patterns: readonly SemanticPattern[] = [
    { semantic: 'primary', keywords: ['front', 'question', 'word', 'term', 'kanji', '表', '問題'] },
    { semantic: 'secondary', keywords: ['back', 'answer', 'meaning', 'definition', '裏', '答え'] },
    { semantic: 'reading', keywords: ['reading', 'pronunciation', 'phonetic', 'kana', '読み', '発音'] },
    { semantic: 'example', keywords: ['example', 'sentence', 'usage', 'context', '例文', '使用例'] },
    { semantic: 'notes', keywords: ['notes', 'memo', 'hint', 'extra', 'remarks', 'メモ', 'ヒント'] },
    { semantic: 'source', keywords: ['source', 'reference', 'origin', '出典', '参考'] },
    { semantic: 'image', keywords: ['image', 'picture', 'photo', 'visual', '画像', '写真'] },
    { semantic: 'audio', keywords: ['audio', 'sound', 'voice', '音声'] },
    { semantic: 'category', keywords: ['category', 'type', 'class', 'group', '分類', 'カテゴリ'] },
    { semantic: 'difficulty', keywords: ['difficulty', 'level', 'grade', '難易度', 'レベル'] },
  ];

  suggestMappings(noteType: AnkiNoteType): Record<string, string> {
    const mappings: Record<string, string> = {};
    const usedFields = new Set<string>();

    // First pass: exact matches with high confidence
    for (const pattern of this.patterns) {
      const bestMatch = this.findBestFieldMatch(noteType.fields, pattern.keywords, usedFields);
      if (bestMatch.field && bestMatch.confidence > 0.8) {
        mappings[pattern.semantic] = bestMatch.field;
        usedFields.add(bestMatch.field);
      }
    }

    // Second pass: good matches for remaining patterns
    for (const pattern of this.patterns) {
      if (mappings[pattern.semantic]) continue; // Already mapped

      const bestMatch = this.findBestFieldMatch(noteType.fields, pattern.keywords, usedFields);
      if (bestMatch.field && bestMatch.confidence > 0.5) {
        mappings[pattern.semantic] = bestMatch.field;
        usedFields.add(bestMatch.field);
      }
    }

    // Fallback: assign first two fields as primary/secondary if not mapped yet
    if (!mappings.primary && noteType.fields.length > 0 && !usedFields.has(noteType.fields[0])) {
      mappings.primary = noteType.fields[0];
      usedFields.add(noteType.fields[0]);
    }
    if (!mappings.secondary && noteType.fields.length > 1 && !usedFields.has(noteType.fields[1])) {
      mappings.secondary = noteType.fields[1];
      usedFields.add(noteType.fields[1]);
    }

    return mappings;
  }

  getSuggestionDetails(noteType: AnkiNoteType): FieldMappingSuggestion[] {
    const suggestions: FieldMappingSuggestion[] = [];
    const usedFields = new Set<string>();

    for (const pattern of this.patterns) {
      const bestMatch = this.findBestFieldMatch(noteType.fields, pattern.keywords, usedFields);
      if (bestMatch.field) {
        suggestions.push({
          semantic: pattern.semantic,
          field: bestMatch.field,
          confidence: bestMatch.confidence,
        });
        usedFields.add(bestMatch.field);
      }
    }

    // Add fallback suggestions for unmapped semantics
    const mappedSemantics = new Set(suggestions.map(s => s.semantic));
    
    if (!mappedSemantics.has('primary') && noteType.fields.length > 0) {
      const field = noteType.fields.find(f => !usedFields.has(f));
      if (field) {
        suggestions.push({
          semantic: 'primary',
          field,
          confidence: 0.3,
        });
        usedFields.add(field);
      }
    }

    if (!mappedSemantics.has('secondary') && noteType.fields.length > 1) {
      const field = noteType.fields.find(f => !usedFields.has(f));
      if (field) {
        suggestions.push({
          semantic: 'secondary',
          field,
          confidence: 0.3,
        });
      }
    }

    return suggestions;
  }

  validateMapping(noteType: AnkiNoteType, mapping: Record<string, string>): boolean {
    const availableFields = new Set(noteType.fields);
    const usedFields = new Set<string>();

    for (const [, field] of Object.entries(mapping)) {
      // Check if field exists in note type
      if (!availableFields.has(field)) {
        return false;
      }

      // Check for duplicate field assignments
      if (usedFields.has(field)) {
        return false;
      }

      usedFields.add(field);
    }

    return true;
  }

  applyMapping(mapping: Record<string, string>, semanticContent: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [semantic, content] of Object.entries(semanticContent)) {
      const actualField = mapping[semantic];
      
      if (actualField && content && content.trim() !== '') {
        if (result[actualField]) {
          // Merge content if field is already mapped
          result[actualField] += `\\n${content}`;
        } else {
          result[actualField] = content;
        }
      }
    }

    return result;
  }

  getSemanticKeywords(): Record<string, readonly string[]> {
    const keywords: Record<string, readonly string[]> = {};
    
    for (const pattern of this.patterns) {
      keywords[pattern.semantic] = pattern.keywords;
    }

    return keywords;
  }

  private findBestFieldMatch(
    fields: readonly string[],
    keywords: readonly string[],
    usedFields: Set<string>
  ): { field: string | null; confidence: number } {
    let bestField: string | null = null;
    let bestConfidence = 0;

    for (const field of fields) {
      if (usedFields.has(field)) continue;

      const fieldLower = field.toLowerCase();
      let confidence = 0;

      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        
        if (fieldLower === keywordLower) {
          confidence = 1.0; // Exact match
          break;
        } else if (fieldLower.includes(keywordLower) && keywordLower.length > 2) {
          confidence = Math.max(confidence, 0.8); // Contains keyword (avoid short matches)
        } else if (keywordLower.includes(fieldLower) && fieldLower.length >= 4 && keywordLower.length - fieldLower.length <= 3) {
          confidence = Math.max(confidence, 0.6); // Keyword contains field name (be more conservative)
        }
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestField = field;
      }
    }

    return { field: bestField, confidence: bestConfidence };
  }
}