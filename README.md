# @skhatri/mcps

Multi-module MCP (Model Context Protocol) packages collection.

## Packages

- **[@skhatri/file-mcp](./packages/file-mcp)**: File operations MCP server with automatic logging
- **[@skhatri/date-mcp](./packages/date-mcp)**: Date and time operations MCP server
- **[@skhatri/git-mcp](./packages/git-mcp)**: Git operations MCP server for version control

## Development

This is a workspace-based monorepo. Use npm workspaces for development:

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Test all packages
npm run test

# Clean all packages
npm run clean
```

## Publishing

Each package can be published independently:

```bash
# Publish all packages
npm run publish-all

# Or publish individual packages
cd packages/file-mcp && npm publish
cd packages/date-mcp && npm publish
```

## License

Apache 2.0

