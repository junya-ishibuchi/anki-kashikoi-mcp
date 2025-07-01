import { FieldMapper } from '../src/services/field-mapper.js';
import type { AnkiNoteType } from '../src/types/index.js';

describe('FieldMapper', () => {
  let fieldMapper: FieldMapper;

  beforeEach(() => {
    fieldMapper = new FieldMapper();
  });

  describe('suggestMappings', () => {
    it('should suggest mappings for basic note type', () => {
      const noteType: AnkiNoteType = {
        name: 'Basic',
        fields: ['Front', 'Back'],
      };

      const suggestions = fieldMapper.suggestMappings(noteType);

      expect(suggestions).toEqual({
        primary: 'Front',
        secondary: 'Back',
      });
    });

    it('should suggest mappings for Japanese note type', () => {
      const noteType: AnkiNoteType = {
        name: 'Japanese (recognition)',
        fields: ['Expression', 'Reading', 'Meaning', 'Sentence'],
      };

      const suggestions = fieldMapper.suggestMappings(noteType);

      expect(suggestions).toEqual({
        primary: 'Expression',
        reading: 'Reading',
        secondary: 'Meaning',
        example: 'Sentence',
      });
    });

    it('should handle note types with mixed case field names', () => {
      const noteType: AnkiNoteType = {
        name: 'Custom',
        fields: ['question', 'ANSWER', 'Example', 'notes'],
      };

      const suggestions = fieldMapper.suggestMappings(noteType);

      expect(suggestions.primary).toBe('question');
      expect(suggestions.secondary).toBe('ANSWER');
    });

    it('should suggest mappings for cloze note type', () => {
      const noteType: AnkiNoteType = {
        name: 'Cloze',
        fields: ['Text', 'Extra'],
      };

      const suggestions = fieldMapper.suggestMappings(noteType);

      expect(suggestions).toEqual({
        example: 'Text',
        notes: 'Extra',
      });
    });

    it('should handle note types with no recognizable patterns', () => {
      const noteType: AnkiNoteType = {
        name: 'Custom',
        fields: ['Field1', 'Field2', 'Field3'],
      };

      const suggestions = fieldMapper.suggestMappings(noteType);

      expect(suggestions.primary).toBe('Field1');
      expect(suggestions.secondary).toBe('Field2');
    });

    it('should prioritize better matches over field order', () => {
      const noteType: AnkiNoteType = {
        name: 'Custom',
        fields: ['Notes', 'Question', 'Answer'],
      };

      const suggestions = fieldMapper.suggestMappings(noteType);

      expect(suggestions.primary).toBe('Question');
      expect(suggestions.secondary).toBe('Answer');
      expect(suggestions.notes).toBe('Notes');
    });
  });

  describe('getSuggestionDetails', () => {
    it('should return detailed suggestions with confidence scores', () => {
      const noteType: AnkiNoteType = {
        name: 'Basic',
        fields: ['Front', 'Back'],
      };

      const details = fieldMapper.getSuggestionDetails(noteType);

      expect(details).toHaveLength(2);
      expect(details[0]).toEqual({
        semantic: 'primary',
        field: 'Front',
        confidence: expect.any(Number),
      });
      expect(details[1]).toEqual({
        semantic: 'secondary',
        field: 'Back',
        confidence: expect.any(Number),
      });
    });

    it('should assign higher confidence to exact matches', () => {
      const noteType: AnkiNoteType = {
        name: 'Custom',
        fields: ['question', 'answer'],
      };

      const details = fieldMapper.getSuggestionDetails(noteType);

      const primarySuggestion = details.find(d => d.semantic === 'primary');
      const secondarySuggestion = details.find(d => d.semantic === 'secondary');

      expect(primarySuggestion?.confidence).toBeGreaterThan(0.8);
      expect(secondarySuggestion?.confidence).toBeGreaterThan(0.8);
    });

    it('should assign lower confidence to fallback mappings', () => {
      const noteType: AnkiNoteType = {
        name: 'Custom',
        fields: ['Field1', 'Field2'],
      };

      const details = fieldMapper.getSuggestionDetails(noteType);

      const primarySuggestion = details.find(d => d.semantic === 'primary');
      const secondarySuggestion = details.find(d => d.semantic === 'secondary');

      expect(primarySuggestion?.confidence).toBeLessThan(0.5);
      expect(secondarySuggestion?.confidence).toBeLessThan(0.5);
    });
  });

  describe('validateMapping', () => {
    it('should return true for valid mappings', () => {
      const noteType: AnkiNoteType = {
        name: 'Basic',
        fields: ['Front', 'Back'],
      };

      const mapping = {
        primary: 'Front',
        secondary: 'Back',
      };

      const isValid = fieldMapper.validateMapping(noteType, mapping);
      expect(isValid).toBe(true);
    });

    it('should return false for mappings with non-existent fields', () => {
      const noteType: AnkiNoteType = {
        name: 'Basic',
        fields: ['Front', 'Back'],
      };

      const mapping = {
        primary: 'Front',
        secondary: 'NonExistent',
      };

      const isValid = fieldMapper.validateMapping(noteType, mapping);
      expect(isValid).toBe(false);
    });

    it('should return false for mappings with duplicate field assignments', () => {
      const noteType: AnkiNoteType = {
        name: 'Basic',
        fields: ['Front', 'Back'],
      };

      const mapping = {
        primary: 'Front',
        secondary: 'Front', // Duplicate assignment
      };

      const isValid = fieldMapper.validateMapping(noteType, mapping);
      expect(isValid).toBe(false);
    });

    it('should return true for empty mappings', () => {
      const noteType: AnkiNoteType = {
        name: 'Basic',
        fields: ['Front', 'Back'],
      };

      const mapping = {};

      const isValid = fieldMapper.validateMapping(noteType, mapping);
      expect(isValid).toBe(true);
    });
  });

  describe('applyMapping', () => {
    it('should map semantic content to actual fields', () => {
      const mapping = {
        primary: 'Front',
        secondary: 'Back',
        notes: 'Extra',
      };

      const semanticContent = {
        primary: 'Question content',
        secondary: 'Answer content',
        notes: 'Additional notes',
        unmapped: 'This should not appear',
      };

      const result = fieldMapper.applyMapping(mapping, semanticContent);

      expect(result).toEqual({
        Front: 'Question content',
        Back: 'Answer content',
        Extra: 'Additional notes',
      });
    });

    it('should handle empty content gracefully', () => {
      const mapping = {
        primary: 'Front',
        secondary: 'Back',
      };

      const semanticContent = {};

      const result = fieldMapper.applyMapping(mapping, semanticContent);

      expect(result).toEqual({});
    });

    it('should merge duplicate field assignments', () => {
      const mapping = {
        primary: 'Front',
        secondary: 'Front', // Same field mapped twice
      };

      const semanticContent = {
        primary: 'First content',
        secondary: 'Second content',
      };

      const result = fieldMapper.applyMapping(mapping, semanticContent);

      expect(result).toEqual({
        Front: 'First content\\nSecond content',
      });
    });

    it('should ignore empty or null values', () => {
      const mapping = {
        primary: 'Front',
        secondary: 'Back',
        notes: 'Extra',
      };

      const semanticContent = {
        primary: 'Question content',
        secondary: '', // Empty
        notes: null as unknown as string, // Null
      };

      const result = fieldMapper.applyMapping(mapping, semanticContent);

      expect(result).toEqual({
        Front: 'Question content',
      });
    });
  });

  describe('getSemanticKeywords', () => {
    it('should return semantic keywords mapping', () => {
      const keywords = fieldMapper.getSemanticKeywords();

      expect(keywords).toHaveProperty('primary');
      expect(keywords).toHaveProperty('secondary');
      expect(keywords).toHaveProperty('reading');
      expect(keywords).toHaveProperty('example');

      expect(keywords.primary).toContain('front');
      expect(keywords.primary).toContain('question');
      expect(keywords.secondary).toContain('back');
      expect(keywords.secondary).toContain('answer');
    });

    it('should return consistent keywords across calls', () => {
      const keywords1 = fieldMapper.getSemanticKeywords();
      const keywords2 = fieldMapper.getSemanticKeywords();

      expect(keywords1).toEqual(keywords2);
    });
  });
});