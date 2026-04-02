# Make CLI - AI Agents Guide

## Overview

This document provides instructions for AI agents on how to work with and extend the Make CLI repository. The CLI is a standalone command-line tool that interacts with the Make automation platform. It depends on `@makehq/sdk` for all API access, types, and MCP tool definitions.

## Repository Structure

```
make-cli/
├── src/
│   ├── cli.ts          # Executable entry point: sets up Commander, registers all commands
│   ├── commands.ts     # Builds CLI commands from @makehq/sdk MCP tool definitions
│   ├── auth.ts         # Resolves API key and zone from flags or env vars
│   ├── output.ts       # Output formatting: json, compact, table
│   ├── categories.ts   # Display titles and groupings for command categories
│   └── version.ts      # Auto-generated version constant (from scripts/build-version.mjs)
├── test/
│   └── commands.spec.ts  # Unit tests for CLI utilities and command building
├── scripts/
│   └── build-version.mjs     # Writes src/version.ts from package.json version
└── dist/                     # Compiled output (auto-generated)
    └── cli.js                # The executable CLI (ESM with shebang)
```

## Dependency on `@makehq/sdk`

All API functionality comes from the `@makehq/sdk` package. The CLI imports:

| Import         | Source            | Purpose                                          |
| -------------- | ----------------- | ------------------------------------------------ |
| `Make`         | `@makehq/sdk`     | API client — instantiated per command invocation |
| `MakeError`    | `@makehq/sdk`     | Typed API error with `statusCode` and `message`  |
| `JSONValue`    | `@makehq/sdk`     | Generic JSON value type                          |
| `MakeMCPTools` | `@makehq/sdk/mcp` | Array of all MCP tool definitions                |
| `MakeMCPTool`  | `@makehq/sdk/mcp` | Type describing a single MCP tool                |
| `JSONSchema`   | `@makehq/sdk/mcp` | JSON Schema type for tool input parameters       |

## How the CLI Works

The CLI uses an **auto-discovery pattern**: it reads the `MakeMCPTools` array from `@makehq/sdk/mcp` and dynamically registers each tool as a CLI subcommand. No command wiring is done by hand.

### Command registration flow

1. `src/index.ts` creates a Commander program with global flags (`--api-key`, `--zone`, `--output`)
2. It calls `buildCommands(program, MakeMCPTools)` from `src/commands.ts`
3. `buildCommands` groups tools by `tool.category` and creates nested subcommands:
    - Category → top-level command (e.g. `scenarios`, `data-stores`, `sdk-apps`)
    - Tool action → subcommand (e.g. `list`, `get`, `create`)
4. Each subcommand's options are derived from `tool.inputSchema.properties`
5. On execution, the tool's `execute(make, args)` function is called

### Tool name → CLI command mapping

Tool names follow `{category}_{action}` where category dots become hyphens:

```
scenarios_list          → make scenarios list
data-stores_get         → make data-stores get
sdk-apps_get-section    → make sdk-apps get-section
```

### Auth resolution

Every command resolves credentials via `resolveAuth()` in `src/auth.ts`:

- Checks `--api-key` / `--zone` flags first
- Falls back to `MAKE_API_KEY` / `MAKE_ZONE` environment variables
- Throws if either is missing

### Output formatting

Controlled by the global `--output` flag (default: `json`):

- `json` — pretty-printed JSON
- `compact` — single-line JSON
- `table` — ASCII table (for arrays of objects)

## Adding New Commands

New CLI commands come automatically from new MCP tools added in `@makehq/sdk`. To add a command:

1. Add or update a `.mcp.ts` file in the `@makehq/sdk` repository following its conventions
2. Bump and publish a new version of `@makehq/sdk`
3. Update `@makehq/sdk` version in this repo's `package.json` and run `npm install`
4. No code changes needed in this repo — the new tool is auto-discovered

To customize how a **category** is displayed (title, help group), update `src/categories.ts`.

## Testing Patterns

### Unit Tests (`test/commands.spec.ts`)

Tests cover the helper functions and command-building logic using mock tool definitions:

```typescript
import { describe, expect, it } from '@jest/globals';
import { Command } from 'commander';
import { deriveActionName, camelToKebab, coerceValue, buildCommands } from '../src/commands.js';
import { resolveAuth } from '../src/auth.js';
import { formatOutput } from '../src/output.js';
import type { MakeMCPTool } from '@makehq/sdk/mcp';

const makeTool = (overrides: Partial<MakeMCPTool> = {}): MakeMCPTool => ({
    name: 'scenarios_list',
    title: 'List scenarios',
    description: 'List all scenarios',
    category: 'scenarios',
    inputSchema: { type: 'object', properties: {}, required: [] },
    execute: async () => [],
    ...overrides,
});
```

Tests do **not** mock HTTP requests — they only test pure CLI logic (argument parsing, type coercion, output formatting, command structure).

## Build and Development

### Scripts

- `npm run build` — compile `src/index.ts` to `dist/index.js` (ESM with shebang)
- `npm run build:version` — write current package.json version to `src/version.ts`
- `npm test` — run unit tests in `test/`
- `npm run lint` — TypeScript type-check + ESLint
- `npm run format` — format with Prettier

### Output

The build produces a single file: `dist/index.js` — an ESM executable with `#!/usr/bin/env node`.

## TypeScript Guidelines

- Use `type` imports for type-only imports
- All imports from `@makehq/sdk` and `@makehq/sdk/mcp` use the package name (never relative paths into node_modules)
- Use `.js` extensions in relative imports (e.g. `import { run } from './index.js'`)

## Quality Checklist

Before completing any change:

- [ ] `npm run lint` passes (TypeScript + ESLint)
- [ ] `npm test` passes
- [ ] `npm run build` succeeds and produces `dist/index.js`
- [ ] `node dist/index.js --help` shows expected commands
