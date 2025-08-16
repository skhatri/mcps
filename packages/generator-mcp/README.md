# @skhatri/random-mcp

A Model Context Protocol (MCP) server for generating random data including UUIDs, numbers, and strings.

## Features

- **generate_uuid**: Generate random UUIDs (version 4 or simple time-based)
- **random_number**: Generate random numbers within specified ranges  
- **random_string**: Generate random strings with configurable character sets

## Installation

```bash
npm install -g @skhatri/random-mcp
```

## Usage

### Standalone

```bash
random-mcp
```

### With Java MCP Client

```bash
./gradlew :java-mcp-client:runStdio -Pargs="random-mcp"
```

### With npx

```bash
npx @skhatri/random-mcp
```

## Tools

### generate_uuid

Generate a random UUID.

**Parameters:**
- `version` (integer, optional): UUID version (4 for random, 1 for time-based). Default: 4

**Example:**
```json
{
  "name": "generate_uuid",
  "arguments": {
    "version": 4
  }
}
```

**Response:**
```json
{
  "uuid": "6fea1433-49e7-476e-96df-877573b64e24"
}
```

### random_number

Generate a random number within a specified range.

**Parameters:**
- `min` (integer, required): Minimum value (inclusive)
- `max` (integer, required): Maximum value (exclusive)

**Example:**
```json
{
  "name": "random_number", 
  "arguments": {
    "min": 1,
    "max": 100
  }
}
```

**Response:**
```json
{
  "number": 42,
  "min": 1,
  "max": 100
}
```

### random_string

Generate a random string of specified length.

**Parameters:**
- `length` (integer, optional): Length of random string. Default: 16
- `charset` (string, optional): Character set to use. Options: "alphanumeric", "hex", "alpha". Default: "alphanumeric"

**Example:**
```json
{
  "name": "random_string",
  "arguments": {
    "length": 8,
    "charset": "hex"
  }
}
```

**Response:**
```json
{
  "string": "50e389e9",
  "length": 8,
  "charset": "hex"
}
```

## Protocol Details

This MCP server uses:
- **NDJSON framing** (newline-delimited JSON) for maximum compatibility
- **MCP Protocol version**: 2024-11-05
- **Transport**: STDIO only
- **No external dependencies** for runtime

## Development

```bash
# Build
npm run build

# Test locally
npm run dev

# Link for global use
npm run link:local
```

## Compatibility

- **Node.js**: >=18.0.0
- **Java MCP Client**: Full compatibility with STDIO transport
- **Standard MCP Clients**: Compatible with any MCP client supporting STDIO transport

## License

MIT

## Repository

Part of the [@skhatri/mcps](https://github.com/skhatri/mcps) monorepo.