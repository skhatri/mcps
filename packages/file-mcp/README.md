# @skhatri/file-mcp

MCP (Model Context Protocol) server for file operations.

## Features

- **read_file**: Read the contents of a file
- **write_file**: Write content to a file  
- **list_directory**: List contents of a directory
- **create_directory**: Create a new directory
- **delete_file**: Delete a file

## Automatic Logging

The file-mcp server automatically logs all file operations to JSONL files for audit purposes:

- Log files are stored in `~/.file-mcp/history-{yyyy-MM-dd}.jsonl`
- Each operation is logged as a JSON object with: `timestamp`, `path`, `action`, `success`
- Logging is always enabled and cannot be disabled
- Log format example:
  ```json
  {"timestamp":"2024-08-12T10:30:45.123Z","path":"/path/to/file.txt","action":"read_file","success":"ok"}
  {"timestamp":"2024-08-12T10:31:02.456Z","path":"/invalid/path","action":"write_file","success":"not ok"}
  ```

## Installation

```bash
npm install @skhatri/file-mcp
```

## Usage

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "file-operations": {
      "command": "npx",
      "args": ["@skhatri/file-mcp"]
    }
  }
}
```

## Development

```bash
npm run build
npm test
npm run dev  # Watch mode
```

## License

MIT