# Make CLI

A command-line interface for interacting with the [Make](https://www.make.com) automation platform.

## Installation

```bash
npm install -g @makehq/cli
```

## Authentication

The CLI requires an API key and zone. These can be provided as flags or environment variables:

```bash
export MAKE_API_KEY="your-api-key"
export MAKE_ZONE="eu2.make.com"
```

Or passed directly to any command:

```bash
make-cli --api-key your-api-key --zone eu2.make.com scenarios list --team-id 1
```

## Usage

```
make-cli [options] <category> <action> [options]
```

### Global Options

| Option      | Description                                         |
| ----------- | --------------------------------------------------- |
| `--api-key` | Make API key                                        |
| `--zone`    | Make zone (e.g. `eu2.make.com`)                     |
| `--output`  | Output format: `json` (default), `compact`, `table` |

### Examples

```bash
make-cli scenarios list --team-id=123
make-cli scenarios get --scenario-id=456
make-cli connections list --team-id=123
make-cli data-stores list --team-id=123
make-cli data-store-records list --data-store-id=1
make-cli teams list --organization-id=1
make-cli users me

# Creating a scenario
make-cli scenarios create \
  --team-id=123 \
  --scheduling='{"type":"on-demand"}' \
  --blueprint='{"name":"My Scenario","flow":[],"metadata":{}}'

# Output formatting
make-cli scenarios list --team-id=123 --output=table
```

### Commands

Commands are organized by category:

**Scenarios**

- `scenarios` — Scenarios
- `executions` — Scenario Executions
- `incomplete-executions` — Incomplete Executions
- `folders` — Scenario Folders
- `functions` — Custom Functions
- `hooks` — Webhooks

**Credentials**

- `connections` — Connections
- `keys` — Keys
- `credential-requests` — Credential Requests

**Data Stores**

- `data-stores` — Data Stores
- `data-store-records` — Data Store Records
- `data-structures` — Data Structures

**Account Management**

- `teams` — Teams
- `organizations` — Organizations
- `users` — Users
- `enums` — Enums

**Custom App Development**

- `sdk-apps` — App Definitions
- `sdk-connections` — App Connections
- `sdk-functions` — App Functions
- `sdk-modules` — App Modules
- `sdk-rpcs` — App Remote Procedures
- `sdk-webhooks` — App Webhooks

Run `make-cli --help` or `make-cli <category> --help` for the full list of actions and options.

## Building

```bash
npm run build
```

## Testing

```bash
npm test
```
