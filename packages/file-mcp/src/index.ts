#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const server = new Server(
  {
    name: '@skhatri/file-mcp',
    version: '0.1.0',
  }
);

const loggingEnabled = true;

interface LogEntry {
  timestamp: string;
  path: string;
  action: string;
  success: 'ok' | 'not ok';
}

async function ensureLogDirectory(): Promise<string> {
  const homeDir = os.homedir();
  const logDir = path.join(homeDir, '.file-mcp');
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
  return logDir;
}

function getLogFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `history-${year}-${month}-${day}.jsonl`;
}

async function logOperation(filePath: string, action: string, success: 'ok' | 'not ok'): Promise<void> {
  try {
    const logDir = await ensureLogDirectory();
    const logFile = path.join(logDir, getLogFileName());
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      path: filePath,
      action,
      success
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(logFile, logLine, 'utf-8');
    console.error(`[file-mcp] Logged: ${action} ${filePath} -> ${success}`);
  } catch (error) {
    // Log errors should not interrupt the main operation
    console.error('[file-mcp] Failed to write log:', error);
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to write',
            },
            content: {
              type: 'string',
              description: 'Content to write to the file',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'list_directory',
        description: 'List contents of a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory to list',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'create_directory',
        description: 'Create a new directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory to create',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'delete_file',
        description: 'Delete a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to delete',
            },
          },
          required: ['path'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args) {
    throw new Error('Missing arguments');
  }

  try {
    switch (name) {
      case 'read_file': {
        const filePath = args.path as string;
        console.error(`[file-mcp] Executing read_file: ${filePath}`);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          await logOperation(filePath, 'read_file', 'ok');
          return {
            content: [
              {
                type: 'text',
                text: content,
              },
            ],
          };
        } catch (error) {
          await logOperation(filePath, 'read_file', 'not ok');
          throw error;
        }
      }

      case 'write_file': {
        const filePath = args.path as string;
        const content = args.content as string;
        try {
          await fs.writeFile(filePath, content, 'utf-8');
          await logOperation(filePath, 'write_file', 'ok');
          return {
            content: [
              {
                type: 'text',
                text: `Successfully wrote to ${filePath}`,
              },
            ],
          };
        } catch (error) {
          await logOperation(filePath, 'write_file', 'not ok');
          throw error;
        }
      }

      case 'list_directory': {
        const dirPath = args.path as string;
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          const result = entries.map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
          }));
          await logOperation(dirPath, 'list_directory', 'ok');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          await logOperation(dirPath, 'list_directory', 'not ok');
          throw error;
        }
      }

      case 'create_directory': {
        const dirPath = args.path as string;
        try {
          await fs.mkdir(dirPath, { recursive: true });
          await logOperation(dirPath, 'create_directory', 'ok');
          return {
            content: [
              {
                type: 'text',
                text: `Successfully created directory ${dirPath}`,
              },
            ],
          };
        } catch (error) {
          await logOperation(dirPath, 'create_directory', 'not ok');
          throw error;
        }
      }

      case 'delete_file': {
        const filePath = args.path as string;
        try {
          await fs.unlink(filePath);
          await logOperation(filePath, 'delete_file', 'ok');
          return {
            content: [
              {
                type: 'text',
                text: `Successfully deleted ${filePath}`,
              },
            ],
          };
        } catch (error) {
          await logOperation(filePath, 'delete_file', 'not ok');
          throw error;
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('@skhatri/file-mcp server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});