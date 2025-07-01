import { AnkiConnectClient } from '../src/services/anki-connect-client.js';
import type { AnkiConnectResponse, AnkiNoteType, AnkiNote } from '../src/types/index.js';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('AnkiConnectClient', () => {
  let client: AnkiConnectClient;
  const mockUrl = 'http://localhost:8765';

  beforeEach(() => {
    client = new AnkiConnectClient(mockUrl);
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with default URL when none provided', () => {
      const defaultClient = new AnkiConnectClient();
      expect(defaultClient).toBeDefined();
    });

    it('should initialize with custom URL when provided', () => {
      expect(client).toBeDefined();
    });
  });

  describe('sendRequest', () => {
    it('should send request to AnkiConnect and return result on success', async () => {
      const mockResponse: AnkiConnectResponse<string[]> = {
        result: ['Default', 'Deck1'],
        error: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.sendRequest<string[]>('deckNames');

      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deckNames',
          version: 6,
          params: {},
        }),
      });

      expect(result).toEqual(['Default', 'Deck1']);
    });

    it('should throw error when AnkiConnect returns error', async () => {
      const mockResponse: AnkiConnectResponse<null> = {
        result: null,
        error: 'AnkiConnect error message',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(client.sendRequest('invalidAction')).rejects.toThrow(
        'AnkiConnect error: AnkiConnect error message'
      );
    });

    it('should throw error when network request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.sendRequest('deckNames')).rejects.toThrow('Network error');
    });

    it('should send request with parameters', async () => {
      const mockResponse: AnkiConnectResponse<string[]> = {
        result: ['Front', 'Back'],
        error: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.sendRequest<string[]>('modelFieldNames', {
        modelName: 'Basic',
      });

      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modelFieldNames',
          version: 6,
          params: { modelName: 'Basic' },
        }),
      });

      expect(result).toEqual(['Front', 'Back']);
    });
  });

  describe('getDeckNames', () => {
    it('should return array of deck names', async () => {
      const mockResponse: AnkiConnectResponse<string[]> = {
        result: ['Default', 'Japanese', 'Math'],
        error: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.getDeckNames();

      expect(result).toEqual(['Default', 'Japanese', 'Math']);
      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deckNames',
          version: 6,
          params: {},
        }),
      });
    });
  });

  describe('getNoteTypes', () => {
    it('should return array of note types with their fields', async () => {
      const mockNoteTypeNames = ['Basic', 'Cloze'];
      const mockBasicFields = ['Front', 'Back'];
      const mockClozeFields = ['Text', 'Extra'];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockNoteTypeNames, error: null }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockBasicFields, error: null }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockClozeFields, error: null }),
        } as Response);

      const result = await client.getNoteTypes();

      const expected: AnkiNoteType[] = [
        { name: 'Basic', fields: ['Front', 'Back'] },
        { name: 'Cloze', fields: ['Text', 'Extra'] },
      ];

      expect(result).toEqual(expected);
    });
  });

  describe('createDeck', () => {
    it('should create deck and return success', async () => {
      const mockResponse: AnkiConnectResponse<null> = {
        result: null,
        error: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(client.createDeck('NewDeck')).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createDeck',
          version: 6,
          params: { deck: 'NewDeck' },
        }),
      });
    });

    it('should handle deck already exists error gracefully', async () => {
      const mockResponse: AnkiConnectResponse<null> = {
        result: null,
        error: 'deck already exists',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(client.createDeck('ExistingDeck')).resolves.not.toThrow();
    });
  });

  describe('addNote', () => {
    it('should add note and return note ID', async () => {
      const mockResponse: AnkiConnectResponse<number> = {
        result: 1234567890,
        error: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const note: AnkiNote = {
        deckName: 'Default',
        modelName: 'Basic',
        fields: { Front: 'Question', Back: 'Answer' },
        tags: ['test'],
      };

      const result = await client.addNote(note);

      expect(result).toBe(1234567890);
      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addNote',
          version: 6,
          params: { note },
        }),
      });
    });
  });

  describe('findCards', () => {
    it('should find cards and return card IDs', async () => {
      const mockResponse: AnkiConnectResponse<number[]> = {
        result: [1, 2, 3],
        error: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.findCards('deck:"Default"');

      expect(result).toEqual([1, 2, 3]);
      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'findCards',
          version: 6,
          params: { query: 'deck:"Default"' },
        }),
      });
    });
  });

  describe('getCardsInfo', () => {
    it('should get cards info and return card details', async () => {
      const mockCardInfo = {
        cardId: 1,
        fields: { Front: { value: 'Question', order: 0 } },
        modelName: 'Basic',
        deckName: 'Default',
      };

      const mockResponse: AnkiConnectResponse<typeof mockCardInfo[]> = {
        result: [mockCardInfo],
        error: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.getCardsInfo([1]);

      expect(result).toEqual([mockCardInfo]);
      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cardsInfo',
          version: 6,
          params: { cards: [1] },
        }),
      });
    });
  });
});