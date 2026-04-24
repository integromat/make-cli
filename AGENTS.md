# Make CLI - AI Agents Guide

## Overview

This document provides instructions for AI agents on how to work with and extend the Make CLI repository. The CLI is a standalone command-line tool that interacts with the Make automation platform. It depends on `@makehq/sdk` for all API access, types, and tool definitions.

## Repository Structure

```
make-cli/
├── src/
│   ├── index.ts        # Executable entry point: sets up Commander, registers all commands
│   ├── commands.ts     # Builds CLI commands from @makehq/sdk tool definitions
│   ├── auth.ts         # Resolves API key and zone from flags, env vars, or config file
│   ├── config.ts       # Reads/writes local credentials file (~/.config/make-cli/config.json)
│   ├── login.ts        # Hand-crafted login, logout, whoami commands
│   ├── output.ts       # Output formatting: json, compact, table
│   ├── categories.ts   # Display titles and groupings for command categories
│   └── version.ts      # Auto-generated version constant (from scripts/build-version.mjs)
├── test/
│   ├── commands.spec.ts  # Unit tests for CLI utilities and command building
│   ├── auth.spec.ts      # Unit tests for resolveAuth config file fallback
│   └── config.spec.ts    # Unit tests for config file path resolution and I/O
├── scripts/
│   └── build-version.mjs     # Writes src/version.ts from package.json version
└── dist/                     # Compiled output (auto-generated)
    └── index.js              # The executable CLI (ESM with shebang)
```

## Dependency on `@makehq/sdk`

All API functionality comes from the `@makehq/sdk` package. The CLI imports:

| Import        | Source              | Purpose                                             |
| ------------- | ------------------- | --------------------------------------------------- |
| `Make`        | `@makehq/sdk`       | API client — instantiated per command invocation    |
| `MakeError`   | `@makehq/sdk`       | Typed API error with `statusCode` and `message`     |
| `JSONValue`   | `@makehq/sdk`       | Generic JSON value type                             |
| `MakeTools`   | `@makehq/sdk/tools` | Array of all Make SDK tool definitions              |
| `MakeTool`    | `@makehq/sdk/tools` | Type describing a single tool                       |
| `JSONSchema`  | `@makehq/sdk/tools` | JSON Schema type for tool input parameters          |

## How the CLI Works

The CLI uses an **auto-discovery pattern**: it reads the `MakeTools` array from `@makehq/sdk/tools` and dynamically registers each tool as a CLI subcommand. No command wiring is done by hand.

### Command registration flow

1. `src/index.ts` creates a Commander program with global flags (`--api-key`, `--zone`, `--output`)
2. It calls `buildCommands(program, MakeTools)` from `src/commands.ts`
3. `buildCommands` groups tools by `tool.category` and creates nested subcommands:
    - Category → top-level command (e.g. `scenarios`, `data-stores`, `sdk-apps`)
    - Tool action → subcommand (e.g. `list`, `get`, `create`)
4. Each subcommand's options are derived from `tool.inputSchema.properties`
5. On execution, the tool's `execute(make, args)` function is called

### Positional argument for resource-level actions

Tools that operate on a single resource (typically `get` / `update` / `delete` / action-style tools) declare the owning input property via `tool.resourceId` (e.g. `dataStructureId` for `data-structures_get`, `executionId` for `executions_get`, `key` for `data-store-records_update`). For these tools the CLI exposes that value as a positional argument. The original descriptive long-form flag is kept as an alternative for scripted / explicit use, so both of these work and map to the same SDK input:

```
make-cli data-structures get 178
make-cli data-structures get --data-structure-id=178
```

When the tool also declares a parent scope (`tool.scopeId`), that stays a named flag — only the resource's own id becomes positional:

```
make-cli executions get abc --scenario-id=925
```

Behavior details:

- The positional argument is registered as optional at the Commander level (`[resource-id]`) so either invocation style parses cleanly. Presence is enforced in the action handler based on the JSON Schema's `required` list.
- Supplying the value both positionally and via the flag is rejected with an explicit error.
- The positional is not registered when `tool.resourceId` is unset (collection-level `list` / `create`) or when it points at a property that isn't part of the schema.
- Generated help text shows the positional in the Usage line and in an `Arguments:` section; built-in examples are rendered using the positional form.

See `deriveSelfIdentifier` and `registerToolAsCommand` in `src/commands.ts`.

### Tool name → CLI command mapping

Tool names follow `{category}_{action}` where category dots become hyphens:

```
scenarios_list          → make scenarios list
data-stores_get         → make data-stores get
sdk-apps_get-section    → make sdk-apps get-section
```

### Auth resolution

Every command resolves credentials via `resolveAuth()` in `src/auth.ts` (async). Priority order:

1. `--api-key` / `--zone` CLI flags
2. `MAKE_API_KEY` / `MAKE_ZONE` environment variables
3. Local config file (see below)
4. Throws with a message directing the user to run `make-cli login`

### Local credentials file

`src/config.ts` manages a JSON file at:

- **macOS / Linux**: `$XDG_CONFIG_HOME/make-cli/config.json` (default: `~/.config/make-cli/config.json`)
- **Windows**: `%APPDATA%\make-cli\config.json`

File format: `{ "apiKey": "...", "zone": "eu1.make.com" }`

The file is written with mode `0o600` (owner-read/write only on Unix) and uses an atomic write (write to `.tmp`, then rename).

### Login commands

`src/login.ts` registers three hand-crafted commands (grouped under `Others:` in `--help`) via `registerLoginCommands(program)` in `src/index.ts`:

| Command            | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `make-cli login`   | Interactive wizard: select zone, open browser, paste API key, validate, save |
| `make-cli logout`  | Removes the local credentials file                                 |
| `make-cli whoami`  | Calls `make.users.me()` and prints `name`, `email`, and `zone`    |

These are intentionally separate from `buildCommands` — they are not auto-discovered from SDK tools.

### Output formatting

Controlled by the global `--output` flag (default: `json`):

- `json` — pretty-printed JSON
- `compact` — single-line JSON
- `table` — ASCII table (for arrays of objects)

## Adding New Commands

New CLI commands come automatically from new SDK tools added in `@makehq/sdk`. To add a command:

1. Add or update a `.tool.ts` file in the `@makehq/sdk` repository following its conventions (setting `resourceId` on resource-level tools so the CLI can register the positional argument)
2. Bump and publish a new version of `@makehq/sdk`
3. Update `@makehq/sdk` version in this repo's `package.json` and run `npm install`
4. No code changes needed in this repo — the new tool is auto-discovered

To customize how a **category** is displayed (title, help group), update `src/categories.ts`.

## Testing Patterns

### Unit Tests

Tests do **not** mock HTTP requests. All test files mock `src/config.js` so the local credentials file is never touched during tests.

**`test/commands.spec.ts`** — CLI utilities and command building:
- `deriveActionName`, `camelToKebab`, `coerceValue`, `buildCommands`, `resolveAuth`, `formatOutput`
- Includes one end-to-end execution test: calls `program.parseAsync()` with real args and asserts `execute` was called and output written to stdout

**`test/auth.spec.ts`** — `resolveAuth` config file fallback tier:
- Verifies flags and env vars take priority over the config file
- Verifies error message mentions `make-cli login` when no credentials are found

**`test/config.spec.ts`** — config file I/O:
- `getConfigPath()` for each platform and env combination
- `writeConfig` / `readConfig` round-trip
- Handles absent file and malformed JSON gracefully

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
- All imports from `@makehq/sdk` and `@makehq/sdk/tools` use the package name (never relative paths into node_modules)
- Use `.js` extensions in relative imports (e.g. `import { run } from './index.js'`)

## Quality Checklist

Before completing any change:

- [ ] `npm run lint` passes (TypeScript + ESLint)
- [ ] `npm test` passes
- [ ] `npm run build` succeeds and produces `dist/index.js`
- [ ] `node dist/index.js --help` shows expected commands
