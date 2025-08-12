# @skhatri/git-mcp

MCP (Model Context Protocol) server for Git operations on the current repository.

## Features

### Git Information
- **git_top_committer**: Get the top committers in the repository
- **git_last_commit**: Get information about the last commit
- **git_commit_info**: Get detailed information about a specific commit by hash
- **git_status**: Get current Git status

### Branch Operations
- **git_branches**: List local branches
- **git_remote_branches**: List remote branches
- **git_merged_branches**: List branches that have been merged
- **git_unmerged_branches**: List branches that have not been merged

### Rebase Operations
- **git_rebase_from_remote**: Rebase current branch from a remote branch
- **git_rebase_branch_to_branch**: Rebase one branch onto another
- **git_rebase_range**: Rebase a range of commits to a branch

### Remote Operations
- **git_push_to_origin**: Push current branch to origin
- **git_pull_from_origin**: Pull from origin for current branch
- **git_fetch_from_origin**: Fetch from origin

### Commit Operations
- **git_commit**: Create a commit with an appropriate message
- **git_commit_files**: Commit specific files or file patterns

## Installation

```bash
npm install @skhatri/git-mcp
```

## Usage

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "git-operations": {
      "command": "npx",
      "args": ["@skhatri/git-mcp"]
    }
  }
}
```

## Requirements

- Git must be installed and available in PATH
- Must be run from within a Git repository
- Appropriate Git permissions for the operations being performed

## Development

```bash
npm run build
npm test
npm run dev  # Watch mode
```

## License

MIT