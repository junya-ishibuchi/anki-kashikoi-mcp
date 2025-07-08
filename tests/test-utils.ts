import type { AnkiCard } from '../src/types/index.js';

export function createMockAnkiCard(overrides: Partial<AnkiCard> = {}): AnkiCard {
  return {
    cardId: 1,
    fields: {},
    fieldOrder: 0,
    question: 'Q',
    answer: 'A',
    modelName: 'Basic',
    deckName: 'Default',
    css: '',
    factor: 2500,
    interval: 1,
    note: 1,
    type: 0,
    queue: 0,
    due: 0,
    reps: 0,
    lapses: 0,
    left: 0,
    odue: 0,
    odid: 0,
    mod: 0,
    usn: 0,
    ...overrides
  };
}