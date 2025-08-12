# @skhatri/date-mcp

MCP (Model Context Protocol) server for date and time operations.

## Features

- **current_datetime**: Get the current date and time
- **format_date**: Format a date string into different formats
- **date_diff**: Calculate difference between two dates  
- **add_time**: Add time to a date
- **is_valid_date**: Check if a date string is valid
- **days_since**: Calculate days since a given date from now
- **days_between**: Calculate the number of days between two dates
- **day_of_year**: Get the day of the year (1-366) for a given date

## Installation

```bash
npm install @skhatri/date-mcp
```

## Usage

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "date-operations": {
      "command": "npx",
      "args": ["@skhatri/date-mcp"]
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