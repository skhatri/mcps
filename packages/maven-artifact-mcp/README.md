# Maven Version Resolver MCP Server

A TypeScript-based Model Context Protocol (MCP) server that provides Maven2 module version resolution capabilities with caching and logging.

## Features

- Latest stable version resolution from Maven Central
- Pre-release filtering (excludes preview, RC, alpha, beta, snapshot, milestone versions)
- 5-minute in-memory cache with automatic cleanup
- Request/response logging
- Error handling and input validation



## Installation from Source

```bash
npm install
npm run build
```

## Usage

### Stdio Mode (Default)
For MCP clients like Cursor:

```bash
npm start
```

### Remote HTTP Server Mode
Run as a standalone network service:

```bash
# Start HTTP server on port 3001
npm run start:http

# Or with custom port
npm run dev:http -- --port 8080
```

### Development Mode

```bash
# Stdio mode
npm run dev

# HTTP mode
npm run dev:http
```

## Setup

### Stdio Mode (Recommended for Cursor)
Add to your `.cursor-settings.json`:
```json
{
  "mcp": {
    "mcpServers": {
      "maven-resolver": {
        "command": "npx",
        "args": ["@skhatri/maven-artifact-mcp", "--stdio"],
        "env": {
          "CACHE_TTL_MINUTES": "5",
          "MAVEN_API_TIMEOUT": "10000"
        }
      }
    }
  }
}
```

### Remote HTTP Mode
Start the server: `npm run start:http`, then configure:
```json
{
  "mcp": {
    "mcpServers": {
      "maven-resolver-remote": {
        "command": "http",
        "args": ["http://localhost:3001/sse"],
        "env": {
          "CACHE_TTL_MINUTES": "5",
          "MAVEN_API_TIMEOUT": "10000"
        }
      }
    }
  }
}
```

**HTTP Endpoints:**
- `GET /sse` - MCP Server-Sent Events endpoint
- `GET /health` - Health check endpoint
- `GET /tools` - List available MCP tools and capabilities

**Example `/tools` response:**
```bash
curl http://localhost:3001/tools
```
```json
{
  "service": "maven-mcp-server",
  "tools": [{"name": "latest_version", "description": "Get the latest stable version of a Maven artifact"}],
  "features": ["Filters out pre-release versions", "In-memory caching with 5-minute TTL"],
  "endpoints": {"health": "/health", "sse": "/sse", "tools": "/tools"}
}
```

Other environment variables like 

        "HTTPS_PROXY": "http://myorg.proxy:8080",
        "HTTP_PROXY": "http://myorg.proxy:8080",
        "NO_PROXY": "localhost,127.0.0.1,.local"
        "LOG_LEVEL": "debug",
        "NODE_ENV": "development"       

can also be provided.

## MCP Tool: `latest_version`

Retrieves the latest version information for a Maven artifact.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | string | Yes | Maven group ID (e.g., "org.springframework") |
| `artifactId` | string | Yes | Maven artifact ID (e.g., "spring-core") |

### Example Usage

```json
{
  "tool": "latest_version",
  "arguments": {
    "groupId": "org.springframework",
    "artifactId": "spring-core"
  }
}
```

Response includes latest version, last updated timestamp, repository, cache status, and excluded pre-release versions.

## Version Filtering

Automatically filters out pre-release versions:

- Preview versions (e.g., `6.1.0-preview`)
- Release candidates (e.g., `6.1.0-RC1`)
- Alpha/Beta versions (e.g., `6.1.0-alpha`)
- Snapshots (e.g., `6.1.0-SNAPSHOT`)
- Milestones (e.g., `7.0.0-M1`)

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAVEN_API_TIMEOUT` | 10000 | API request timeout in milliseconds |
| `CACHE_TTL_MINUTES` | 5 | Cache TTL in minutes |
| `LOG_LEVEL` | info | Logging verbosity level |


### Npm Tasks

- `npm run build` - Compile TypeScript
- `npm start` - Start the server
- `npm run dev` - Build and start in development mode
- `npm test` - Run test suite
- `npm run test:coverage` - Run tests with coverage



## License

Apache 2.0 License 

