# Make CLI

A command-line interface for interacting with the [Make](https://www.make.com) automation platform.

## Installation

### Homebrew

```bash
brew install integromat/tap/make-cli
```

### npm

```bash
npm install -g @makehq/cli
```

### Binary releases

Pre-built binaries are available for download from the [GitHub Releases](https://github.com/integromat/make-cli/releases) page:

| Platform | Architecture          | File                            |
| -------- | --------------------- | ------------------------------- |
| Linux    | x86_64                | `make-cli-linux-amd64.tar.gz`   |
| Linux    | arm64                 | `make-cli-linux-arm64.tar.gz`   |
| macOS    | x86_64 (Intel)        | `make-cli-darwin-amd64.tar.gz`  |
| macOS    | arm64 (Apple Silicon) | `make-cli-darwin-arm64.tar.gz`  |
| Windows  | x86_64                | `make-cli-windows-amd64.tar.gz` |

Download and extract the archive for your platform, then place the binary somewhere on your `PATH`.

### Debian/Ubuntu

`.deb` packages are also available for Linux:

| Architecture | File                       |
| ------------ | -------------------------- |
| x86_64       | `make-cli-linux-amd64.deb` |
| arm64        | `make-cli-linux-arm64.deb` |

```bash
sudo dpkg -i make-cli-linux-amd64.deb
```

## Authentication

### Login (recommended)

Run the interactive login wizard to save your credentials locally:

```bash
make-cli login
```

This guides you through selecting your zone, opening the Make API keys page in your browser, and validating your key. Credentials are saved to:

- **macOS / Linux**: `~/.config/make-cli/config.json`
- **Windows**: `%APPDATA%\make-cli\config.json`

Once logged in, all commands work without any extra flags. To check who you're logged in as:

```bash
make-cli whoami
```

To remove saved credentials:

```bash
make-cli logout
```

### Environment variables

```bash
export MAKE_API_KEY="your-api-key"
export MAKE_ZONE="eu2.make.com"
```

### Per-command flags

```bash
make-cli --api-key your-api-key --zone eu2.make.com scenarios list --team-id 1
```

Flags take priority over environment variables, which take priority over saved credentials.

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
- `devices` — Devices

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
