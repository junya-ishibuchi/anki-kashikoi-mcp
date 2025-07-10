# Anki Kashikoi MCP Server

## Project Overview

This is a Desktop Extension (DXT) implementation of a Model Context Protocol (MCP) server for intelligent Anki flashcard management. The server provides direct field mapping capabilities, allowing users to add flashcards using the actual field names after analyzing existing decks.

As a DXT, this extension can be easily installed and distributed as a single zip archive, making it compatible with multiple AI applications that support the MCP protocol.

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
    ├── deck-analyzer.ts         # Existing deck analysis
    └── anki-mcp-server.ts       # Main MCP server implementation
```

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

The compiled DXT file can be installed directly in compatible AI applications that support the MCP protocol.

## DXT Requirements

### Prerequisites
- **Anki**: Must be running with AnkiConnect addon installed
- **Node.js**: Runtime environment (bundled with the DXT)
- **Compatible AI Application**: Supporting MCP protocol and DXT extensions

### Installation
1. Download the `.dxt` file
2. Install in your AI application following the application's extension installation process
3. Ensure Anki is running with AnkiConnect addon
4. The extension will automatically connect to AnkiConnect at `http://localhost:8765`

## Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- TypeScript: Type safety and modern JavaScript features
- Jest: Testing framework
- ts-jest: TypeScript support for Jest
- ESLint: Code linting and style checking
- tsx: TypeScript execution for development

## Notes for Future Development

1. **Adding New Tools**: Add handler in `setupToolHandlers()` and implement in `AnkiMCPServer`
2. **New Deck Configuration**: Extend `DeckConfig` interface and analyzer logic
3. **Configuration Changes**: Update `UserConfigNew` interface and migration logic
4. **Testing**: Maintain >80% code coverage, test edge cases