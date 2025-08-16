#!/usr/bin/env node

/**
 * Random MCP Server - A Model Context Protocol server for generating random data
 * 
 * This MCP server provides tools for generating:
 * - Random UUIDs (version 4 and simple time-based)
 * - Random numbers within specified ranges
 * - Random strings with various character sets
 * 
 * Uses pure NDJSON framing for maximum compatibility with Java MCP clients.
 * 
 * @author skhatri
 * @version 0.2.2
 */

const crypto = require('crypto');

class RandomMCPServer {
    constructor() {
        this.tools = [
            {
                name: "generate_uuid",
                description: "Generate a random UUID",
                inputSchema: {
                    type: "object",
                    properties: {
                        version: {
                            type: "integer",
                            description: "UUID version (4 for random, 1 for time-based)",
                            default: 4
                        }
                    }
                }
            },
            {
                name: "random_number",
                description: "Generate a random number within a specified range",
                inputSchema: {
                    type: "object",
                    properties: {
                        min: {
                            type: "integer",
                            description: "Minimum value (inclusive)",
                            default: 0
                        },
                        max: {
                            type: "integer", 
                            description: "Maximum value (exclusive)",
                            default: 100
                        }
                    },
                    required: ["min", "max"]
                }
            },
            {
                name: "random_string",
                description: "Generate a random string of specified length",
                inputSchema: {
                    type: "object",
                    properties: {
                        length: {
                            type: "integer",
                            description: "Length of random string",
                            default: 16
                        },
                        charset: {
                            type: "string",
                            description: "Character set to use (alphanumeric, hex, alpha)",
                            default: "alphanumeric"
                        }
                    }
                }
            }
        ];
        
        this.messageId = 1;
        this.initialized = false;
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }

    sendMessage(message) {
        const json = JSON.stringify(message);
        this.log(`Sending: ${json}`, 'debug');
        process.stdout.write(json + '\n');
        this.log(`Flushed to stdout`, 'debug');
    }

    sendResponse(id, result = null, error = null) {
        this.sendMessage({
            jsonrpc: "2.0",
            id: id,
            result: result,
            error: error
        });
    }

    sendNotification(method, params = {}) {
        this.sendMessage({
            jsonrpc: "2.0",
            method: method,
            params: params
        });
    }

    handleInitialize(id, params) {
        this.log('Received initialize request');
        this.log(`Initialize params: ${JSON.stringify(params)}`, 'debug');
        
        const result = {
            protocolVersion: "2024-11-05",
            capabilities: {
                tools: {},
                resources: {}
            },
            serverInfo: {
                name: "Random MCP Server",
                version: "0.2.2"
            }
        };
        
        this.sendResponse(id, result);
        this.log('Sent initialize response');
    }

    handleInitialized(params) {
        this.log('Received initialized notification');
        this.initialized = true;
        this.log('Random MCP server is now ready');
    }

    handleToolsList(id, params) {
        this.log('Received tools/list request');
        const result = {
            tools: this.tools
        };
        this.sendResponse(id, result);
        this.log(`Sent ${this.tools.length} tools in response`);
    }

    handleToolCall(id, params) {
        const { name, arguments: args } = params;
        this.log(`Received tool call: ${name} with args: ${JSON.stringify(args)}`);

        try {
            let result;
            
            switch (name) {
                case "generate_uuid":
                    const version = args?.version || 4;
                    if (version === 4) {
                        result = { uuid: crypto.randomUUID() };
                    } else if (version === 1) {
                        // Simple time-based UUID simulation
                        const timestamp = Date.now().toString(16);
                        const random = crypto.randomBytes(6).toString('hex');
                        result = { uuid: `${timestamp}-${random}` };
                    } else {
                        throw new Error(`Unsupported UUID version: ${version}`);
                    }
                    break;

                case "random_number":
                    const min = args?.min || 0;
                    const max = args?.max || 100;
                    if (min >= max) {
                        throw new Error("min must be less than max");
                    }
                    const number = Math.floor(Math.random() * (max - min)) + min;
                    result = { number: number, min: min, max: max };
                    break;

                case "random_string":
                    const length = args?.length || 16;
                    const charset = args?.charset || "alphanumeric";
                    let chars;
                    
                    switch (charset) {
                        case "hex":
                            chars = "0123456789abcdef";
                            break;
                        case "alpha":
                            chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
                            break;
                        case "alphanumeric":
                        default:
                            chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
                            break;
                    }
                    
                    let randomString = "";
                    for (let i = 0; i < length; i++) {
                        randomString += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    result = { string: randomString, length: length, charset: charset };
                    break;

                default:
                    throw new Error(`Unknown tool: ${name}`);
            }

            this.sendResponse(id, result);
            this.log(`Tool ${name} executed successfully`);

        } catch (error) {
            this.log(`Tool ${name} failed: ${error.message}`, 'error');
            this.sendResponse(id, null, {
                code: -32000,
                message: error.message
            });
        }
    }

    handleMessage(message) {
        this.log(`Received: ${JSON.stringify(message)}`, 'debug');

        try {
            if (message.method) {
                // Request or notification
                switch (message.method) {
                    case "initialize":
                        this.handleInitialize(message.id, message.params);
                        break;
                    case "initialized":
                        this.handleInitialized(message.params);
                        break;
                    case "tools/list":
                        this.handleToolsList(message.id, message.params);
                        break;
                    case "tools/call":
                        this.handleToolCall(message.id, message.params);
                        break;
                    default:
                        if (message.id) {
                            this.sendResponse(message.id, null, {
                                code: -32601,
                                message: `Method not found: ${message.method}`
                            });
                        }
                        this.log(`Unknown method: ${message.method}`, 'warn');
                        break;
                }
            }
        } catch (error) {
            this.log(`Error handling message: ${error.message}`, 'error');
            if (message.id) {
                this.sendResponse(message.id, null, {
                    code: -32603,
                    message: "Internal error"
                });
            }
        }
    }

    start() {
        this.log('Random MCP Server v0.2.2 starting...');
        this.log('Using NDJSON framing (newline-delimited)');
        this.log('Available tools: generate_uuid, random_number, random_string');
        
        process.stdin.setEncoding('utf8');
        
        let buffer = '';
        process.stdin.on('data', (data) => {
            buffer += data;
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the incomplete line
            
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line.trim());
                        this.handleMessage(message);
                    } catch (error) {
                        this.log(`Failed to parse JSON: ${line.trim()}`, 'error');
                        this.log(`Parse error: ${error.message}`, 'error');
                    }
                }
            }
        });

        process.stdin.on('end', () => {
            this.log('STDIN closed, shutting down...');
            process.exit(0);
        });

        process.on('SIGINT', () => {
            this.log('Received SIGINT, shutting down...');
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            this.log('Received SIGTERM, shutting down...');
            process.exit(0);
        });

        this.log('Random MCP server ready and waiting for connections');
    }
}

// Check for CLI arguments for help or version
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Random MCP Server v0.2.2

A Model Context Protocol server for generating random data.

USAGE:
    random-mcp [--help] [--version]

TOOLS:
    generate_uuid    Generate random UUIDs (v4 or simple time-based)
    random_number    Generate random numbers within specified ranges
    random_string    Generate random strings with configurable character sets

EXAMPLES:
    # Start the server (STDIO mode)
    random-mcp

    # Use with Java MCP client
    ./gradlew :java-mcp-client:runStdio -Pargs="random-mcp"

    # Use with npx
    npx @skhatri/random-mcp

For more information, visit: https://github.com/skhatri/mcps/tree/main/packages/random-mcp
`);
    process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
    console.log('0.2.2');
    process.exit(0);
}

// Start the server
const server = new RandomMCPServer();
server.start();