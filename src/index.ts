#!/usr/bin/env node

import { AnkiMCPServer } from './services/anki-mcp-server.js';
import { AnkiConnectClient } from './services/anki-connect-client.js';
import { ConfigurationManager } from './services/configuration-manager.js';
import { FieldMapper } from './services/field-mapper.js';
import { DeckAnalyzer } from './services/deck-analyzer.js';

async function main(): Promise<void> {
  // Initialize all services
  const ankiClient = new AnkiConnectClient();
  const configManager = new ConfigurationManager();
  const fieldMapper = new FieldMapper();
  const deckAnalyzer = new DeckAnalyzer(ankiClient, fieldMapper);

  // Create and run the MCP server
  const server = new AnkiMCPServer(ankiClient, configManager, fieldMapper, deckAnalyzer);
  await server.run();
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the server
main().catch((error) => {
  console.error('Failed to start Dynamic Anki MCP Server:', error);
  process.exit(1);
});
