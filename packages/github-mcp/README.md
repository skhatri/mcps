# GitHub MCP Server

A Model Context Protocol (MCP) server that provides GitHub integration tools for pull requests, reviews, and repository operations.

## Features

- **Pull Request Management**
  - List pull requests with filtering
  - Get detailed PR information and file changes
  - Create new pull requests

- **Code Review Tools**
  - Add review comments to specific lines
  - Approve pull requests
  - Submit comprehensive reviews (approve/request changes/comment)
  - Request reviews from users and teams
  - List all review comments

- **Issue Management**
  - Create, update, and close issues
  - List issues with advanced filtering
  - Add comments to issues
  - Assign users to issues
  - Complete issue lifecycle management

- **Repository Operations**
  - Get repository information and statistics
  - Browse commit history and details
  - List and create branches
  - Read and update file contents
  - Direct file manipulation via API

- **Labels & Organization**
  - List and create repository labels
  - Manage milestones
  - Organize issues and PRs with metadata

- **Collaboration Tools**
  - List repository collaborators
  - Check user permissions
  - Manage issue assignments
  - Team and user management

- **Search & Discovery**
  - Search repositories across GitHub
  - Search issues and pull requests
  - Search code within repositories
  - Advanced filtering and sorting

- **GitHub Actions Integration**
  - List repository workflows
  - Manually trigger workflows
  - Monitor automation status

## Installation

```bash
npm install @skhatri/github-mcp
```

## Setup

### 1. GitHub Authentication

Choose one of the following authentication methods:

#### Option A: Personal Access Token (PAT)
Create a GitHub Personal Access Token with the following permissions:
- `repo` (Full control of private repositories)
- `pull_requests:write` (Create and update pull requests)

#### Option B: GitHub App Installation Token
If using a GitHub App, you'll need an installation token with these permissions:
- `Contents: Read` (to read repository files)
- `Pull requests: Write` (to create/modify pull requests)
- `Metadata: Read` (basic repository information)

GitHub App tokens are preferable for organizations as they provide:
- Fine-grained repository access
- Better security and audit logging
- Organization-level management

### 2. Environment Variables

Set your GitHub token as an environment variable:

**For Personal Access Token:**
```bash
export GITHUB_TOKEN=ghp_your_personal_access_token_here
export OWNER=your_github_username_or_org  # Optional: set default owner
```

**For GitHub App Installation Token:**
```bash
export GITHUB_TOKEN=ghs_your_installation_token_here
export OWNER=your_github_username_or_org  # Optional: set default owner
```

Or create a `.env` file:

```env
# Personal Access Token (starts with ghp_)
GITHUB_TOKEN=ghp_your_personal_access_token_here

# OR GitHub App Installation Token (starts with ghs_)
GITHUB_TOKEN=ghs_your_installation_token_here

# Optional: Default owner for repository operations
OWNER=your_github_username_or_org
```

**Environment Variables:**
- `GITHUB_TOKEN` (required): Your GitHub authentication token
- `OWNER` (optional): Default repository owner/organization name

**Note**: The MCP server automatically detects the token type. Both Personal Access Tokens and GitHub App Installation Tokens work seamlessly.

### 3. MCP Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["@skhatri/github-mcp"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here",
        "OWNER": "your_github_username_or_org"
      }
    }
  }
}
```

**Configuration Options:**
- `GITHUB_TOKEN`: Required GitHub authentication token
- `OWNER`: Optional default owner/organization name. When set, you can omit the `owner` parameter from tool calls

## Available Tools

**Total: 32 tools covering the complete GitHub workflow**

### Owner Parameter Behavior

All repository-related tools support flexible owner parameter handling:

1. **Explicit owner**: Provide `owner` parameter in tool calls
   ```javascript
   // Always works regardless of environment configuration
   await mcp.callTool('list_pull_requests', {
     owner: 'facebook',
     repo: 'react'
   });
   ```

2. **Default owner from environment**: Set `OWNER` environment variable and omit owner parameter
   ```javascript
   // Works when OWNER env var is set to 'myorg'
   await mcp.callTool('list_pull_requests', {
     repo: 'myrepo'  // owner defaults to OWNER env var
   });
   ```

3. **Fallback behavior**: 
   - If `owner` is provided → use provided owner
   - If `owner` is omitted but `OWNER` env var is set → use `OWNER` env var
   - If both are missing → error: "Owner parameter is required"

This allows you to configure a default organization/user and avoid repeating the owner parameter for every call, while still supporting explicit owner specification when needed.

**Note**: All repository-related tools listed below now have **optional** `owner` parameters. If `OWNER` environment variable is set, the `owner` parameter can be omitted from tool calls.

### Pull Request Management

### `list_pull_requests`
List pull requests for a repository.

**Parameters:**
- `owner` (optional): Repository owner (required if OWNER env var not set)
- `repo` (required): Repository name
- `state` (optional): Filter by state ('open', 'closed', 'all')
- `per_page` (optional): Number of results (default: 30, max: 100)

**Examples:**
```json
// With explicit owner
{
  "owner": "microsoft",
  "repo": "vscode",
  "state": "open",
  "per_page": 10
}

// Without owner (uses OWNER env var)
{
  "repo": "myrepo",
  "state": "open"
}
```

### `list_pull_requests_for_review`
List pull requests that are assigned for review to the authenticated user.

**Parameters:**
- `state` (optional): Filter by state ('open', 'closed', 'all') - default: 'open'
- `per_page` (optional): Number of results (default: 30, max: 100)

**Example:**
```json
{
  "state": "open",
  "per_page": 20
}
```

**Note**: This tool uses the authenticated user's token to find PRs where they are requested as a reviewer. No owner/repo parameters needed as it searches across all accessible repositories.

### `get_pull_request`
Get detailed information about a specific pull request.

**Parameters:**
- `owner` (optional): Repository owner (required if OWNER env var not set)
- `repo` (required): Repository name  
- `pull_number` (required): Pull request number

### `get_pull_request_files`
Get the files changed in a pull request.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `pull_number` (required): Pull request number

### `create_pull_request`
Create a new pull request.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `title` (required): Pull request title
- `head` (required): Branch containing changes
- `base` (required): Target branch
- `body` (optional): Pull request description
- `draft` (optional): Create as draft PR

### `add_review_comment`
Add a review comment to a specific line in a pull request.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `pull_number` (required): Pull request number
- `body` (required): Comment text
- `commit_id` (required): SHA of the commit
- `path` (required): File path
- `line` (required): Line number (1-based)

### `approve_pull_request`
Approve a pull request.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `pull_number` (required): Pull request number
- `body` (optional): Review message

### `request_review`
Request reviews for a pull request from users or teams.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `pull_number` (required): Pull request number
- `reviewers` (optional): Array of usernames
- `team_reviewers` (optional): Array of team names

### `submit_review`
Submit a comprehensive pull request review.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `pull_number` (required): Pull request number
- `event` (required): 'APPROVE', 'REQUEST_CHANGES', or 'COMMENT'
- `body` (optional): Review summary comment

### `list_review_comments`
List all review comments for a pull request.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `pull_number` (required): Pull request number

## Issue Management

### `create_issue`
Create a new issue in a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `title` (required): Issue title
- `body` (optional): Issue description
- `assignees` (optional): Array of usernames to assign
- `milestone` (optional): Milestone number
- `labels` (optional): Array of label names

### `list_issues`
List issues in a repository with filtering options.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `state` (optional): 'open', 'closed', or 'all' (default: 'open')
- `labels` (optional): Comma-separated label names
- `assignee` (optional): Username assigned to issues
- `milestone` (optional): Milestone title or number
- `per_page` (optional): Results per page (max 100)

### `get_issue`
Get detailed information about a specific issue.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issue_number` (required): Issue number

### `update_issue`
Update an existing issue's properties.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issue_number` (required): Issue number
- `title` (optional): Issue title
- `body` (optional): Issue description
- `state` (optional): 'open' or 'closed'
- `assignees` (optional): Array of usernames to assign
- `labels` (optional): Array of label names

### `close_issue`
Close an issue with optional reason.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issue_number` (required): Issue number
- `reason` (optional): 'completed' or 'not_planned'

### `add_issue_comment`
Add a comment to an issue.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issue_number` (required): Issue number
- `body` (required): Comment text

### `assign_issue`
Assign users to an issue.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issue_number` (required): Issue number
- `assignees` (required): Array of usernames to assign

## Repository Operations

### `get_repository`
Get comprehensive repository information and statistics.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name

### `list_commits`
List commits in a repository with optional filtering.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `sha` (optional): Branch, tag, or commit SHA
- `path` (optional): File path to filter commits
- `per_page` (optional): Results per page (max 100)

### `get_commit`
Get detailed information about a specific commit including file changes.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `ref` (required): Commit SHA

### `list_branches`
List all branches in a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `protected` (optional): Filter by protection status
- `per_page` (optional): Results per page (max 100)

### `create_branch`
Create a new branch from a specific commit.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `ref` (required): New branch name (refs/heads/branch-name)
- `sha` (required): SHA to create branch from

### `get_file_content`
Read file contents from repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `path` (required): File path
- `ref` (optional): Branch, tag, or commit SHA (default: main)

### `update_file`
Create or update a file in the repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `path` (required): File path
- `message` (required): Commit message
- `content` (required): File content (base64 encoded)
- `sha` (optional): SHA of file being replaced (for updates)
- `branch` (optional): Branch name (default: main)

## Labels & Organization

### `list_labels`
List all labels in a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `per_page` (optional): Results per page (max 100)

### `create_label`
Create a new label in the repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `name` (required): Label name
- `color` (required): Hex color code without #
- `description` (optional): Label description

### `list_milestones`
List repository milestones.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `state` (optional): 'open', 'closed', or 'all' (default: 'open')
- `per_page` (optional): Results per page (max 100)

### `create_milestone`
Create a new milestone.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `title` (required): Milestone title
- `description` (optional): Milestone description
- `due_on` (optional): Due date (ISO 8601 format)

## Collaboration Tools

### `list_collaborators`
List repository collaborators with their permissions.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `affiliation` (optional): 'outside', 'direct', or 'all' (default: 'all')
- `per_page` (optional): Results per page (max 100)

### `check_user_permissions`
Check a user's permission level for a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `username` (required): Username to check

## Search & Advanced Features

### `search_repositories`
Search for repositories across GitHub.

**Parameters:**
- `q` (required): Search query
- `sort` (optional): 'stars', 'forks', or 'updated'
- `order` (optional): 'asc' or 'desc' (default: 'desc')
- `per_page` (optional): Results per page (max 100)

### `search_issues`
Search for issues and pull requests.

**Parameters:**
- `q` (required): Search query
- `sort` (optional): 'comments', 'reactions', 'created', or 'updated'
- `order` (optional): 'asc' or 'desc' (default: 'desc')
- `per_page` (optional): Results per page (max 100)

### `search_code`
Search for code within repositories.

**Parameters:**
- `q` (required): Search query
- `sort` (optional): 'indexed'
- `order` (optional): 'asc' or 'desc' (default: 'desc')
- `per_page` (optional): Results per page (max 100)

### `list_workflows`
List GitHub Actions workflows in a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `per_page` (optional): Results per page (max 100)

### `trigger_workflow`
Manually trigger a GitHub Actions workflow.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `workflow_id` (required): Workflow ID or filename
- `ref` (required): Git reference (branch or tag)
- `inputs` (optional): Input parameters for workflow

## Usage Examples

### List Open Pull Requests
```javascript
// With explicit owner
await mcp.callTool('list_pull_requests', {
  owner: 'facebook',
  repo: 'react',
  state: 'open'
});

// Without owner (uses OWNER env var)
await mcp.callTool('list_pull_requests', {
  repo: 'react',
  state: 'open'
});
```

### List Pull Requests for Review
```javascript
// Get all PRs assigned for review to the authenticated user
await mcp.callTool('list_pull_requests_for_review', {
  state: 'open'
});

// Get recent review requests across all repositories
await mcp.callTool('list_pull_requests_for_review', {
  per_page: 10
});
```

### Create a Pull Request
```javascript
// With explicit owner
await mcp.callTool('create_pull_request', {
  owner: 'myorg',
  repo: 'myrepo',
  title: 'Add new feature',
  head: 'feature-branch',
  base: 'main',
  body: 'This PR adds a new feature...'
});

// Without owner (uses OWNER env var set to 'myorg')
await mcp.callTool('create_pull_request', {
  repo: 'myrepo',
  title: 'Add new feature',
  head: 'feature-branch',
  base: 'main',
  body: 'This PR adds a new feature...'
});
```

### Add Review Comment
```javascript
// Simplified when OWNER env var is set
await mcp.callTool('add_review_comment', {
  repo: 'myrepo',
  pull_number: 42,
  body: 'Consider using const instead of let here',
  commit_id: 'abc123def456',
  path: 'src/index.ts',
  line: 15
});
```

### Approve Pull Request
```javascript
// Simplified when OWNER env var is set
await mcp.callTool('approve_pull_request', {
  repo: 'myrepo',
  pull_number: 42,
  body: 'LGTM! Great work on this feature.'
});
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## Security

### For Personal Access Tokens:
- Always keep your GitHub token secure
- Use environment variables, never hardcode tokens
- Consider using fine-grained personal access tokens for better security
- Review the permissions granted to your token regularly

### For GitHub App Tokens:
- GitHub App tokens are more secure than PATs for organizations
- They provide repository-specific access and better audit logging
- Installation tokens automatically expire (typically 1 hour)
- App permissions are managed centrally by organization admins

### Best Practices:
- Use GitHub App tokens for production/organizational deployments
- Use Personal Access Tokens for development/personal projects
- Store tokens in secure environment variable management systems
- Rotate tokens regularly (especially PATs)
- Monitor token usage through GitHub's audit logs

## License

MIT