#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: '@skhatri/date-mcp',
    version: '0.1.0',
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'current_datetime',
        description: 'Get the current date and time',
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              description: 'Format string (ISO, locale, or custom)',
              default: 'ISO',
            },
            timezone: {
              type: 'string',
              description: 'Timezone (e.g., UTC, America/New_York)',
              default: 'local',
            },
          },
        },
      },
      {
        name: 'format_date',
        description: 'Format a date string into different formats',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date string to format',
            },
            format: {
              type: 'string',
              description: 'Target format (ISO, locale, custom)',
              default: 'ISO',
            },
            timezone: {
              type: 'string',
              description: 'Target timezone',
              default: 'local',
            },
          },
          required: ['date'],
        },
      },
      {
        name: 'date_diff',
        description: 'Calculate difference between two dates',
        inputSchema: {
          type: 'object',
          properties: {
            date1: {
              type: 'string',
              description: 'First date string',
            },
            date2: {
              type: 'string',
              description: 'Second date string',
            },
            unit: {
              type: 'string',
              description: 'Unit for difference (days, hours, minutes, seconds)',
              default: 'days',
            },
          },
          required: ['date1', 'date2'],
        },
      },
      {
        name: 'add_time',
        description: 'Add time to a date',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Base date string',
            },
            amount: {
              type: 'number',
              description: 'Amount to add',
            },
            unit: {
              type: 'string',
              description: 'Unit to add (days, hours, minutes, seconds)',
              default: 'days',
            },
          },
          required: ['date', 'amount'],
        },
      },
      {
        name: 'is_valid_date',
        description: 'Check if a date string is valid',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date string to validate',
            },
          },
          required: ['date'],
        },
      },
      {
        name: 'days_since',
        description: 'Calculate days since a given date from now',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date string to calculate days since',
            },
          },
          required: ['date'],
        },
      },
      {
        name: 'days_between',
        description: 'Calculate the number of days between two dates',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date string',
            },
            end_date: {
              type: 'string',
              description: 'End date string',
            },
          },
          required: ['start_date', 'end_date'],
        },
      },
      {
        name: 'day_of_year',
        description: 'Get the day of the year (1-366) for a given date',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date string to get day of year for (defaults to current date)',
            },
          },
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
      case 'current_datetime': {
        const format = args.format || 'ISO';
        const timezone = args.timezone || 'local';
        const now = new Date();

        let result: string;
        if (format === 'ISO') {
          result = now.toISOString();
        } else if (format === 'locale') {
          result = now.toLocaleString();
        } else {
          result = now.toString();
        }

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'format_date': {
        const dateStr = args.date as string;
        const format = args.format || 'ISO';
        const date = new Date(dateStr);

        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date: ${dateStr}`);
        }

        let result: string;
        if (format === 'ISO') {
          result = date.toISOString();
        } else if (format === 'locale') {
          result = date.toLocaleString();
        } else {
          result = date.toString();
        }

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'date_diff': {
        const date1Str = args.date1 as string;
        const date2Str = args.date2 as string;
        const unit = args.unit || 'days';

        const date1 = new Date(date1Str);
        const date2 = new Date(date2Str);

        if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
          throw new Error('Invalid date format');
        }

        const diffMs = date2.getTime() - date1.getTime();
        let result: number;

        switch (unit) {
          case 'seconds':
            result = diffMs / 1000;
            break;
          case 'minutes':
            result = diffMs / (1000 * 60);
            break;
          case 'hours':
            result = diffMs / (1000 * 60 * 60);
            break;
          case 'days':
            result = diffMs / (1000 * 60 * 60 * 24);
            break;
          default:
            throw new Error(`Invalid unit: ${unit}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `${result} ${unit}`,
            },
          ],
        };
      }

      case 'add_time': {
        const dateStr = args.date as string;
        const amount = args.amount as number;
        const unit = args.unit || 'days';

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date: ${dateStr}`);
        }

        switch (unit) {
          case 'seconds':
            date.setSeconds(date.getSeconds() + amount);
            break;
          case 'minutes':
            date.setMinutes(date.getMinutes() + amount);
            break;
          case 'hours':
            date.setHours(date.getHours() + amount);
            break;
          case 'days':
            date.setDate(date.getDate() + amount);
            break;
          default:
            throw new Error(`Invalid unit: ${unit}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: date.toISOString(),
            },
          ],
        };
      }

      case 'is_valid_date': {
        const dateStr = args.date as string;
        const date = new Date(dateStr);
        const isValid = !isNaN(date.getTime());

        return {
          content: [
            {
              type: 'text',
              text: isValid ? 'true' : 'false',
            },
          ],
        };
      }

      case 'days_since': {
        const dateStr = args.date as string;
        const date = new Date(dateStr);
        
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date: ${dateStr}`);
        }

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return {
          content: [
            {
              type: 'text',
              text: `${daysDiff}`,
            },
          ],
        };
      }

      case 'days_between': {
        const startDateStr = args.start_date as string;
        const endDateStr = args.end_date as string;
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date format');
        }

        const diffMs = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return {
          content: [
            {
              type: 'text',
              text: `${daysDiff}`,
            },
          ],
        };
      }

      case 'day_of_year': {
        const dateStr = args.date as string;
        const date = dateStr ? new Date(dateStr) : new Date();
        
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date: ${dateStr}`);
        }

        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const diffMs = date.getTime() - startOfYear.getTime();
        const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

        return {
          content: [
            {
              type: 'text',
              text: `${dayOfYear}`,
            },
          ],
        };
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
  console.error('@skhatri/date-mcp server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});