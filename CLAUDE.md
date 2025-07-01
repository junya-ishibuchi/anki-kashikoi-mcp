# Anki Kashikoi MCP Server

## Project Overview

This is a Model Context Protocol (MCP) server implementation for intelligent Anki flashcard management. The server provides semantic field mapping capabilities, allowing users to add flashcards using meaningful names like "primary", "secondary", "meaning" instead of specific field names.

## Architecture

The project follows Test-Driven Development (TDD) principles with a modular architecture:

```
src/
├── index.ts                     # Main entry point
├── types/                       # TypeScript type definitions
│   ├── index.ts                # Barrel file for types
│   ├── anki.ts                 # AnkiConnect API types
│   ├── config.ts               # Configuration types
│   └── mcp.ts                  # MCP-specific types
└── services/                    # Business logic services
    ├── anki-connect-client.ts   # AnkiConnect API client
    ├── configuration-manager.ts # User configuration management
    ├── field-mapper.ts          # Semantic to actual field mapping
    ├── deck-analyzer.ts         # Existing deck analysis
    └── anki-mcp-server.ts       # Main MCP server implementation
```

## Key Features

1. **Semantic Field Mapping**: Map semantic names (primary, secondary, etc.) to actual Anki field names
2. **Auto-Configuration**: Analyze existing decks to automatically suggest field mappings
3. **Multi-Note Type Support**: Works with any Anki note type
4. **Persistent Configuration**: Saves user preferences to disk

## Available MCP Tools

### configure_anki_setup
Initialize and customize Anki configuration. This should be run first to set up your preferences.

**Parameters:**
- `deck` (required): Default deck name
- `noteType` (required): Default note type
- `fieldMappings` (optional): Semantic to actual field mappings

### get_anki_info
Retrieve information about available decks, note types, and current configuration.

### add_smart_card
Add cards using semantic field names based on your configuration.

**Parameters:**
- `content` (required): Object with semantic field names and values
- `deck` (optional): Override default deck
- `noteType` (optional): Override default note type
- `tags` (optional): Array of tags

### suggest_field_mapping
Get AI-powered suggestions for field mappings based on a note type.

**Parameters:**
- `noteType` (required): Note type to analyze

### analyze_existing_deck
Analyze an existing deck to understand field usage patterns.

**Parameters:**
- `deck` (required): Deck name to analyze
- `sampleSize` (optional): Number of cards to sample (default: 5)

### auto_configure_from_deck
Automatically configure settings by analyzing an existing deck.

**Parameters:**
- `deck` (required): Deck to use as template
- `confirm` (optional): Apply configuration immediately (default: false)

## Development Guidelines

### Test-Driven Development
All components are developed using TDD methodology:
1. Write failing tests first
2. Implement minimal code to pass tests
3. Refactor while keeping tests green

### Type Safety
- Minimal use of `any` type
- Strict TypeScript configuration
- All functions have explicit return types
- Use readonly modifiers where appropriate

### Code Organization
- Each service has a single responsibility
- Business logic is separated from MCP protocol handling
- Types are centralized in the types directory
- Low cyclic complexity maintained throughout

### Testing
Run tests with:
```bash
npm test              # Run all tests
npm test -- --watch   # Run tests in watch mode
npm test -- <file>    # Run specific test file
```

### Building and Running
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm start            # Start the MCP server
npm run dev          # Run in development mode
npm run typecheck    # Type check without building
```

## Configuration

The server saves configuration to:
- Linux/Mac: `~/.config/anki-kashikoi-mcp/config.json`

Example configuration:
```json
{
  "preferredDeck": "Japanese",
  "preferredNoteType": "Japanese (recognition)",
  "fieldMappings": {
    "primary": "Expression",
    "reading": "Reading",
    "secondary": "Meaning",
    "example": "Sentence"
  }
}
```

## Usage Examples

### Initial Setup
```javascript
// Configure for Japanese learning
configure_anki_setup({
  deck: "Japanese",
  noteType: "Japanese (recognition)",
  fieldMappings: {
    primary: "Expression",
    reading: "Reading",
    secondary: "Meaning",
    example: "Sentence"
  }
})
```

### Adding Cards
```javascript
// Add a Japanese vocabulary card
add_smart_card({
  content: {
    primary: "勉強",
    reading: "べんきょう",
    secondary: "study",
    example: "毎日日本語を勉強します。"
  },
  tags: ["N5", "verb"]
})
```

### Auto-Configuration
```javascript
// Analyze existing deck
analyze_existing_deck({
  deck: "Japanese Vocabulary"
})

// Apply suggested configuration
auto_configure_from_deck({
  deck: "Japanese Vocabulary",
  confirm: true
})
```

## Error Handling

The server handles common errors gracefully:
- Deck already exists errors are ignored
- Missing field mappings provide helpful error messages
- Network errors are properly propagated
- Invalid note types throw descriptive errors

## Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- TypeScript: Type safety and modern JavaScript features
- Jest: Testing framework
- ts-jest: TypeScript support for Jest

## Notes for Future Development

1. **Adding New Tools**: Add handler in `setupToolHandlers()` and implement in `AnkiMCPServer`
2. **New Field Mappings**: Extend patterns in `FieldMapper` class
3. **Configuration Changes**: Update `UserConfig` interface and migration logic
4. **Testing**: Maintain >80% code coverage, test edge cases

## Troubleshooting

### AnkiConnect Connection Issues
- Ensure Anki is running with AnkiConnect addon installed
- Check AnkiConnect is listening on `http://localhost:8765`
- Verify firewall settings allow local connections

### Configuration Not Saving
- Check write permissions for config directory
- Look for error messages in console output

### Field Mapping Issues
- Use `suggest_field_mapping` to get recommendations
- Verify field names match exactly (case-sensitive)
- Use `get_anki_info` to see available fields