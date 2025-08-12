#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { mavenResolver } from './tools/maven-resolver.js';
import { logger } from './logging/logger.js';
import { cacheManager } from './cache/cache-manager.js';
import { LatestVersionRequest } from './types/maven.js';

interface ServerConfig {
  mode: 'stdio' | 'http';
  port?: number;
  host?: string;
}

class MavenMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'maven-version-resolver',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private validateLatestVersionArgs(args: Record<string, unknown> | undefined): LatestVersionRequest {
    if (!args || typeof args !== 'object') {
      throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
    }

    const { groupId, artifactId } = args;

    if (typeof groupId !== 'string' || !groupId.trim()) {
      throw new McpError(ErrorCode.InvalidParams, 'groupId must be a non-empty string');
    }

    if (typeof artifactId !== 'string' || !artifactId.trim()) {
      throw new McpError(ErrorCode.InvalidParams, 'artifactId must be a non-empty string');
    }

    return { groupId: groupId.trim(), artifactId: artifactId.trim() };
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'latest_version',
            description: 'Get the latest version of a Maven artifact from Maven Central repository',
            inputSchema: {
              type: 'object',
              properties: {
                groupId: {
                  type: 'string',
                  description: 'Maven group ID (e.g., "org.springframework")',
                },
                artifactId: {
                  type: 'string',
                  description: 'Maven artifact ID (e.g., "spring-core")',
                },
              },
              required: ['groupId', 'artifactId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'latest_version') {
          const typedArgs = this.validateLatestVersionArgs(args);
          return await this.handleLatestVersionTool(typedArgs);
        } else {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
        }
      } catch (error) {
        logger.logError(name, `Tool execution failed: ${error}`);
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleLatestVersionTool(args: LatestVersionRequest) {
    const { groupId, artifactId } = args;

    if (!groupId || !artifactId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Both groupId and artifactId are required'
      );
    }

    logger.logRequest('latest_version', { groupId, artifactId });

    try {
      const result = await mavenResolver.getLatestVersion({ groupId, artifactId });
      
      logger.logResponse('latest_version', result);
      
      let responseText = `Latest version information for ${groupId}:${artifactId}:\n\n` +
                         `📦 Latest Version: ${result.latestVersion}\n` +
                         `📅 Last Updated: ${result.lastUpdated}\n` +
                         `🏪 Repository: ${result.repository}\n` +
                         `💾 From Cache: ${result.cached ? 'Yes' : 'No'}`;

      if (result.excludedVersions && result.excludedVersions.length > 0) {
        responseText += `\n🚫 Excluded Pre-releases: ${result.excludedVersions.slice(0, 3).join(', ')}`;
        if (result.excludedVersions.length > 3) {
          responseText += ` (and ${result.excludedVersions.length - 3} more)`;
        }
        if (result.totalVersions) {
          responseText += `\n📊 Total Versions Found: ${result.totalVersions}`;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
        isError: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.logError('latest_version', errorMessage, { groupId, artifactId });
      
      throw new McpError(ErrorCode.InternalError, errorMessage);
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.logError('server', `MCP Server error: ${error}`);
    };

    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.cleanup();
      process.exit(0);
    });
  }

  private cleanup(): void {
    logger.logInfo('Shutting down Maven MCP server...');
    cacheManager.destroy();
    mavenResolver.destroy();
    logger.logInfo('Server shutdown complete');
  }

  async run(config: ServerConfig): Promise<void> {
    if (config.mode === 'http') {
      await this.runHttpServer(config);
    } else {
      await this.runStdioServer();
    }
  }

  private async runStdioServer(): Promise<void> {
    const transport = new StdioServerTransport();
    
    logger.logInfo('Starting Maven MCP server in stdio mode...');
    logger.logInfo(`Cache TTL: ${cacheManager['ttlMinutes']} minutes`);
    
    await this.server.connect(transport);
    logger.logInfo('Maven MCP server is running and ready to accept requests via stdio');
  }

  private async runHttpServer(config: ServerConfig): Promise<void> {
    const port = config.port || 3001;
    const host = config.host || 'localhost';
    
    logger.logInfo(`Starting Maven MCP server in HTTP mode...`);
    logger.logInfo(`Server will be available at: http://${host}:${port}`);
    logger.logInfo(`Cache TTL: ${cacheManager['ttlMinutes']} minutes`);

    // Store active SSE transports to handle POST messages
    const activeTransports = new Map<string, any>();

    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://${host}:${port}`);

      // Add CORS headers for all requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle OPTIONS preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          service: 'maven-mcp-server',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }));
        return;
      }

      if (url.pathname === '/sse' && req.method === 'GET') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        const transport = new SSEServerTransport('/message', res);
        
        // Store the transport for message handling
        const sessionId = transport.sessionId;
        activeTransports.set(sessionId, transport);
        
        // Clean up when connection closes
        res.on('close', () => {
          activeTransports.delete(sessionId);
          logger.logInfo(`SSE connection closed for session ${sessionId}`);
        });
        
        await this.server.connect(transport);
        logger.logInfo(`SSE connection established for session ${sessionId}`);
        return;
      }

      if (url.pathname === '/message' && req.method === 'POST') {
        // Handle POST messages for SSE transport
        try {
          // Find the active transport (there should only be one typically)
          const transport = Array.from(activeTransports.values())[0];
          if (transport) {
            logger.logInfo('Handling POST message via SSE transport');
            await transport.handlePostMessage(req, res);
          } else {
            logger.logWarning('No active SSE session found for POST message');
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No active SSE session found' }));
          }
        } catch (error) {
          logger.logError('message_handler', `Error handling POST message: ${error}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
        return;
      }

      if (url.pathname === '/tools' && req.method === 'GET') {
        // Return available MCP tools
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        
        const toolsInfo = {
          service: 'maven-mcp-server',
          version: '1.0.0',
          tools: [
            {
              name: 'latest_version',
              description: 'Get the latest stable version of a Maven artifact',
              parameters: {
                groupId: 'Maven group ID (e.g., "org.springframework")',
                artifactId: 'Maven artifact ID (e.g., "spring-core")'
              },
              example: {
                groupId: 'com.fasterxml.jackson.core',
                artifactId: 'jackson-databind'
              }
            }
          ],
          features: [
            'Filters out pre-release versions (RC, preview, alpha, beta, snapshot)',
            'In-memory caching with 5-minute TTL',
            'Detailed logging of all requests and responses',
            'Semantic version comparison for accurate latest detection'
          ],
          endpoints: {
            health: '/health',
            sse: '/sse',
            tools: '/tools'
          }
        };
        
        res.end(JSON.stringify(toolsInfo, null, 2));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found\n\nAvailable endpoints:\n- GET /sse (MCP SSE endpoint)\n- GET /health (Health check)\n- GET /tools (List available tools)');
    });

    httpServer.listen(port, host, () => {
      logger.logInfo(`Maven MCP server is running at http://${host}:${port}`);
      logger.logInfo('MCP SSE endpoint: http://' + host + ':' + port + '/sse');
      logger.logInfo('Health check: http://' + host + ':' + port + '/health');
      logger.logInfo('Tools info: http://' + host + ':' + port + '/tools');
    });
  }
}

function parseCommandLineArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = { mode: 'stdio' };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    
    switch (arg) {
      case '--stdio':
        config.mode = 'stdio';
        break;
      case '--http':
        config.mode = 'http';
        break;
      case '--port':
        const portValue = args[i + 1];
        if (portValue && !isNaN(Number(portValue))) {
          config.port = Number(portValue);
          i++; // Skip next argument as it's the port value
        } else {
          logger.logError('startup', 'Invalid port number provided');
          process.exit(1);
        }
        break;
      case '--host':
        const hostValue = args[i + 1];
        if (hostValue) {
          config.host = hostValue;
          i++; // Skip next argument as it's the host value
        } else {
          logger.logError('startup', 'Host value required after --host flag');
          process.exit(1);
        }
        break;
      case '--help':
      case '-h':
        console.log(`
Maven MCP Server - Version Resolver

Usage:
  npm start                           # Start in stdio mode (default)
  npm run start:stdio                 # Start in stdio mode
  npm run start:http                  # Start in HTTP mode on port 3001
  
Command line options:
  --stdio                             # Use stdio transport (default)
  --http                              # Use HTTP transport with Server-Sent Events
  --port <number>                     # Port for HTTP mode (default: 3001)
  --host <hostname>                   # Host for HTTP mode (default: localhost)
  --help, -h                          # Show this help message

Examples:
  node dist/index.js --stdio                    # stdio mode
  node dist/index.js --http --port 3001         # HTTP on port 3001
  node dist/index.js --http --host 0.0.0.0      # HTTP on all interfaces

HTTP Mode Endpoints:
  GET  /sse       # MCP Server-Sent Events endpoint
  POST /message   # MCP message endpoint (used by SSE transport)
  GET  /health    # Health check endpoint
        `);
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          logger.logError('startup', `Unknown argument: ${arg}`);
          logger.logInfo('Use --help for usage information');
          process.exit(1);
        }
        break;
    }
  }

  return config;
}

const config = parseCommandLineArgs();
const server = new MavenMcpServer();

server.run(config).catch((error) => {
  logger.logError('startup', `Failed to start server: ${error}`);
  process.exit(1);
}); 