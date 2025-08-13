#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';

dotenv.config();

class GitHubMCPServer {
  private server: Server;
  private octokit: Octokit;

  constructor() {
    this.server = new Server(
      {
        name: 'github-mcp',
        version: '0.2.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    this.octokit = new Octokit({
      auth: githubToken,
      authStrategy: undefined,
    });

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_pull_requests',
            description: 'List pull requests for a repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                state: {
                  type: 'string',
                  enum: ['open', 'closed', 'all'],
                  description: 'PR state filter',
                  default: 'open',
                },
                per_page: {
                  type: 'number',
                  description: 'Number of results per page (max 100)',
                  default: 30,
                },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'get_pull_request',
            description: 'Get detailed information about a pull request',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                pull_number: {
                  type: 'number',
                  description: 'Pull request number',
                },
              },
              required: ['owner', 'repo', 'pull_number'],
            },
          },
          {
            name: 'get_pull_request_files',
            description: 'Get the files changed in a pull request',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                pull_number: {
                  type: 'number',
                  description: 'Pull request number',
                },
              },
              required: ['owner', 'repo', 'pull_number'],
            },
          },
          {
            name: 'create_pull_request',
            description: 'Create a new pull request',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                title: {
                  type: 'string',
                  description: 'Pull request title',
                },
                head: {
                  type: 'string',
                  description: 'Branch containing changes',
                },
                base: {
                  type: 'string',
                  description: 'Target branch',
                },
                body: {
                  type: 'string',
                  description: 'Pull request description',
                },
                draft: {
                  type: 'boolean',
                  description: 'Create as draft PR',
                  default: false,
                },
              },
              required: ['owner', 'repo', 'title', 'head', 'base'],
            },
          },
          {
            name: 'add_review_comment',
            description: 'Add a review comment to a pull request',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                pull_number: {
                  type: 'number',
                  description: 'Pull request number',
                },
                body: {
                  type: 'string',
                  description: 'Review comment body',
                },
                commit_id: {
                  type: 'string',
                  description: 'SHA of commit to comment on',
                },
                path: {
                  type: 'string',
                  description: 'File path for line comment',
                },
                line: {
                  type: 'number',
                  description: 'Line number for comment (1-based)',
                },
              },
              required: ['owner', 'repo', 'pull_number', 'body', 'commit_id', 'path', 'line'],
            },
          },
          {
            name: 'approve_pull_request',
            description: 'Approve a pull request',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                pull_number: {
                  type: 'number',
                  description: 'Pull request number',
                },
                body: {
                  type: 'string',
                  description: 'Optional review message',
                },
              },
              required: ['owner', 'repo', 'pull_number'],
            },
          },
          {
            name: 'create_issue',
            description: 'Create a new issue in a repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                title: { type: 'string', description: 'Issue title' },
                body: { type: 'string', description: 'Issue description' },
                assignees: { type: 'array', items: { type: 'string' }, description: 'Usernames to assign' },
                milestone: { type: 'number', description: 'Milestone number' },
                labels: { type: 'array', items: { type: 'string' }, description: 'Label names' },
              },
              required: ['owner', 'repo', 'title'],
            },
          },
          {
            name: 'list_issues',
            description: 'List issues in a repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Issue state', default: 'open' },
                labels: { type: 'string', description: 'Comma-separated label names' },
                assignee: { type: 'string', description: 'Username assigned to issues' },
                milestone: { type: 'string', description: 'Milestone title or number' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'get_issue',
            description: 'Get details of a specific issue',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                issue_number: { type: 'number', description: 'Issue number' },
              },
              required: ['owner', 'repo', 'issue_number'],
            },
          },
          {
            name: 'update_issue',
            description: 'Update an existing issue',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                issue_number: { type: 'number', description: 'Issue number' },
                title: { type: 'string', description: 'Issue title' },
                body: { type: 'string', description: 'Issue description' },
                state: { type: 'string', enum: ['open', 'closed'], description: 'Issue state' },
                assignees: { type: 'array', items: { type: 'string' }, description: 'Usernames to assign' },
                labels: { type: 'array', items: { type: 'string' }, description: 'Label names' },
              },
              required: ['owner', 'repo', 'issue_number'],
            },
          },
          {
            name: 'close_issue',
            description: 'Close an issue',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                issue_number: { type: 'number', description: 'Issue number' },
                reason: { type: 'string', enum: ['completed', 'not_planned'], description: 'Reason for closing' },
              },
              required: ['owner', 'repo', 'issue_number'],
            },
          },
          {
            name: 'add_issue_comment',
            description: 'Add a comment to an issue',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                issue_number: { type: 'number', description: 'Issue number' },
                body: { type: 'string', description: 'Comment text' },
              },
              required: ['owner', 'repo', 'issue_number', 'body'],
            },
          },
          {
            name: 'get_repository',
            description: 'Get repository information and statistics',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'list_commits',
            description: 'List commits in a repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                sha: { type: 'string', description: 'Branch, tag, or commit SHA' },
                path: { type: 'string', description: 'File path to filter commits' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'get_commit',
            description: 'Get details of a specific commit',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                ref: { type: 'string', description: 'Commit SHA' },
              },
              required: ['owner', 'repo', 'ref'],
            },
          },
          {
            name: 'list_branches',
            description: 'List repository branches',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                protected: { type: 'boolean', description: 'Filter by protection status' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'create_branch',
            description: 'Create a new branch',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                ref: { type: 'string', description: 'New branch name (refs/heads/branch-name)' },
                sha: { type: 'string', description: 'SHA to create branch from' },
              },
              required: ['owner', 'repo', 'ref', 'sha'],
            },
          },
          {
            name: 'get_file_content',
            description: 'Get file contents from repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                path: { type: 'string', description: 'File path' },
                ref: { type: 'string', description: 'Branch, tag, or commit SHA', default: 'main' },
              },
              required: ['owner', 'repo', 'path'],
            },
          },
          {
            name: 'update_file',
            description: 'Create or update a file in repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                path: { type: 'string', description: 'File path' },
                message: { type: 'string', description: 'Commit message' },
                content: { type: 'string', description: 'File content (base64 encoded)' },
                sha: { type: 'string', description: 'SHA of file being replaced (for updates)' },
                branch: { type: 'string', description: 'Branch name', default: 'main' },
              },
              required: ['owner', 'repo', 'path', 'message', 'content'],
            },
          },
          {
            name: 'request_review',
            description: 'Request reviews for a pull request',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' },
                reviewers: { type: 'array', items: { type: 'string' }, description: 'Usernames to request reviews from' },
                team_reviewers: { type: 'array', items: { type: 'string' }, description: 'Team names to request reviews from' },
              },
              required: ['owner', 'repo', 'pull_number'],
            },
          },
          {
            name: 'submit_review',
            description: 'Submit a pull request review',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' },
                event: { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'], description: 'Review action' },
                body: { type: 'string', description: 'Review summary comment' },
              },
              required: ['owner', 'repo', 'pull_number', 'event'],
            },
          },
          {
            name: 'list_review_comments',
            description: 'List review comments for a pull request',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' },
              },
              required: ['owner', 'repo', 'pull_number'],
            },
          },
          {
            name: 'list_labels',
            description: 'List repository labels',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'create_label',
            description: 'Create a new label',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                name: { type: 'string', description: 'Label name' },
                color: { type: 'string', description: 'Hex color code without #' },
                description: { type: 'string', description: 'Label description' },
              },
              required: ['owner', 'repo', 'name', 'color'],
            },
          },
          {
            name: 'list_milestones',
            description: 'List repository milestones',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Milestone state', default: 'open' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'create_milestone',
            description: 'Create a new milestone',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                title: { type: 'string', description: 'Milestone title' },
                description: { type: 'string', description: 'Milestone description' },
                due_on: { type: 'string', description: 'Due date (ISO 8601 format)' },
              },
              required: ['owner', 'repo', 'title'],
            },
          },
          {
            name: 'list_collaborators',
            description: 'List repository collaborators',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                affiliation: { type: 'string', enum: ['outside', 'direct', 'all'], description: 'Filter by affiliation', default: 'all' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'check_user_permissions',
            description: 'Check user permissions for repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                username: { type: 'string', description: 'Username to check' },
              },
              required: ['owner', 'repo', 'username'],
            },
          },
          {
            name: 'assign_issue',
            description: 'Assign users to an issue',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                issue_number: { type: 'number', description: 'Issue number' },
                assignees: { type: 'array', items: { type: 'string' }, description: 'Usernames to assign' },
              },
              required: ['owner', 'repo', 'issue_number', 'assignees'],
            },
          },
          {
            name: 'search_repositories',
            description: 'Search for repositories',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string', description: 'Search query' },
                sort: { type: 'string', enum: ['stars', 'forks', 'updated'], description: 'Sort results by' },
                order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order', default: 'desc' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
              },
              required: ['q'],
            },
          },
          {
            name: 'search_issues',
            description: 'Search for issues and pull requests',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string', description: 'Search query' },
                sort: { type: 'string', enum: ['comments', 'reactions', 'created', 'updated'], description: 'Sort results by' },
                order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order', default: 'desc' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
              },
              required: ['q'],
            },
          },
          {
            name: 'search_code',
            description: 'Search for code within repositories',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string', description: 'Search query' },
                sort: { type: 'string', enum: ['indexed'], description: 'Sort results by' },
                order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order', default: 'desc' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
              },
              required: ['q'],
            },
          },
          {
            name: 'list_workflows',
            description: 'List repository workflows',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'trigger_workflow',
            description: 'Manually trigger a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                workflow_id: { type: 'string', description: 'Workflow ID or filename' },
                ref: { type: 'string', description: 'Git reference (branch or tag)' },
                inputs: { type: 'object', description: 'Input parameters for workflow', additionalProperties: true },
              },
              required: ['owner', 'repo', 'workflow_id', 'ref'],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_pull_requests':
            return await this.listPullRequests(args as any);
          case 'get_pull_request':
            return await this.getPullRequest(args as any);
          case 'get_pull_request_files':
            return await this.getPullRequestFiles(args as any);
          case 'create_pull_request':
            return await this.createPullRequest(args as any);
          case 'add_review_comment':
            return await this.addReviewComment(args as any);
          case 'approve_pull_request':
            return await this.approvePullRequest(args as any);
          case 'create_issue':
            return await this.createIssue(args as any);
          case 'list_issues':
            return await this.listIssues(args as any);
          case 'get_issue':
            return await this.getIssue(args as any);
          case 'update_issue':
            return await this.updateIssue(args as any);
          case 'close_issue':
            return await this.closeIssue(args as any);
          case 'add_issue_comment':
            return await this.addIssueComment(args as any);
          case 'get_repository':
            return await this.getRepository(args as any);
          case 'list_commits':
            return await this.listCommits(args as any);
          case 'get_commit':
            return await this.getCommit(args as any);
          case 'list_branches':
            return await this.listBranches(args as any);
          case 'create_branch':
            return await this.createBranch(args as any);
          case 'get_file_content':
            return await this.getFileContent(args as any);
          case 'update_file':
            return await this.updateFile(args as any);
          case 'request_review':
            return await this.requestReview(args as any);
          case 'submit_review':
            return await this.submitReview(args as any);
          case 'list_review_comments':
            return await this.listReviewComments(args as any);
          case 'list_labels':
            return await this.listLabels(args as any);
          case 'create_label':
            return await this.createLabel(args as any);
          case 'list_milestones':
            return await this.listMilestones(args as any);
          case 'create_milestone':
            return await this.createMilestone(args as any);
          case 'list_collaborators':
            return await this.listCollaborators(args as any);
          case 'check_user_permissions':
            return await this.checkUserPermissions(args as any);
          case 'assign_issue':
            return await this.assignIssue(args as any);
          case 'search_repositories':
            return await this.searchRepositories(args as any);
          case 'search_issues':
            return await this.searchIssues(args as any);
          case 'search_code':
            return await this.searchCode(args as any);
          case 'list_workflows':
            return await this.listWorkflows(args as any);
          case 'trigger_workflow':
            return await this.triggerWorkflow(args as any);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async listPullRequests(args: {
    owner: string;
    repo: string;
    state?: 'open' | 'closed' | 'all';
    per_page?: number;
  }) {
    const { data: pullRequests } = await this.octokit.rest.pulls.list({
      owner: args.owner,
      repo: args.repo,
      state: args.state || 'open',
      per_page: args.per_page || 30,
    });

    const summary = pullRequests.map(pr => ({
      number: pr.number,
      title: pr.title,
      author: pr.user?.login,
      state: pr.state,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      head_branch: pr.head.ref,
      base_branch: pr.base.ref,
      url: pr.html_url,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async getPullRequest(args: {
    owner: string;
    repo: string;
    pull_number: number;
  }) {
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: args.owner,
      repo: args.repo,
      pull_number: args.pull_number,
    });

    const summary = {
      number: pr.number,
      title: pr.title,
      body: pr.body,
      author: pr.user?.login,
      state: pr.state,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      head_branch: pr.head.ref,
      base_branch: pr.base.ref,
      commits: pr.commits,
      additions: pr.additions,
      deletions: pr.deletions,
      changed_files: pr.changed_files,
      url: pr.html_url,
      mergeable: pr.mergeable,
      merged: pr.merged,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async getPullRequestFiles(args: {
    owner: string;
    repo: string;
    pull_number: number;
  }) {
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      owner: args.owner,
      repo: args.repo,
      pull_number: args.pull_number,
    });

    const summary = files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async createPullRequest(args: {
    owner: string;
    repo: string;
    title: string;
    head: string;
    base: string;
    body?: string;
    draft?: boolean;
  }) {
    const { data: pr } = await this.octokit.rest.pulls.create({
      owner: args.owner,
      repo: args.repo,
      title: args.title,
      head: args.head,
      base: args.base,
      body: args.body,
      draft: args.draft || false,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Created pull request #${pr.number}: ${pr.title}\nURL: ${pr.html_url}`,
        },
      ],
    };
  }

  private async addReviewComment(args: {
    owner: string;
    repo: string;
    pull_number: number;
    body: string;
    commit_id: string;
    path: string;
    line: number;
  }) {
    const { data: comment } = await this.octokit.rest.pulls.createReviewComment({
      owner: args.owner,
      repo: args.repo,
      pull_number: args.pull_number,
      body: args.body,
      commit_id: args.commit_id,
      path: args.path,
      line: args.line,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Added review comment on ${args.path}:${args.line}\nComment ID: ${comment.id}\nURL: ${comment.html_url}`,
        },
      ],
    };
  }

  private async approvePullRequest(args: {
    owner: string;
    repo: string;
    pull_number: number;
    body?: string;
  }) {
    const { data: review } = await this.octokit.rest.pulls.createReview({
      owner: args.owner,
      repo: args.repo,
      pull_number: args.pull_number,
      event: 'APPROVE',
      body: args.body,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Approved pull request #${args.pull_number}\nReview ID: ${review.id}${args.body ? `\nMessage: ${args.body}` : ''}`,
        },
      ],
    };
  }

  private async createIssue(args: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    assignees?: string[];
    milestone?: number;
    labels?: string[];
  }) {
    const { data: issue } = await this.octokit.rest.issues.create({
      owner: args.owner,
      repo: args.repo,
      title: args.title,
      body: args.body,
      assignees: args.assignees,
      milestone: args.milestone,
      labels: args.labels,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Created issue #${issue.number}: ${issue.title}\nURL: ${issue.html_url}`,
        },
      ],
    };
  }

  private async listIssues(args: {
    owner: string;
    repo: string;
    state?: 'open' | 'closed' | 'all';
    labels?: string;
    assignee?: string;
    milestone?: string;
    per_page?: number;
  }) {
    const { data: issues } = await this.octokit.rest.issues.listForRepo({
      owner: args.owner,
      repo: args.repo,
      state: args.state || 'open',
      labels: args.labels,
      assignee: args.assignee,
      milestone: args.milestone,
      per_page: args.per_page || 30,
    });

    const summary = issues.map(issue => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      user: issue.user?.login,
      labels: issue.labels.map(label => typeof label === 'string' ? label : label.name),
      assignees: issue.assignees?.map(assignee => assignee?.login),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      url: issue.html_url,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async getIssue(args: {
    owner: string;
    repo: string;
    issue_number: number;
  }) {
    const { data: issue } = await this.octokit.rest.issues.get({
      owner: args.owner,
      repo: args.repo,
      issue_number: args.issue_number,
    });

    const summary = {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      user: issue.user?.login,
      labels: issue.labels.map(label => typeof label === 'string' ? label : label.name),
      assignees: issue.assignees?.map(assignee => assignee?.login),
      milestone: issue.milestone?.title,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
      url: issue.html_url,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async updateIssue(args: {
    owner: string;
    repo: string;
    issue_number: number;
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    assignees?: string[];
    labels?: string[];
  }) {
    const { data: issue } = await this.octokit.rest.issues.update({
      owner: args.owner,
      repo: args.repo,
      issue_number: args.issue_number,
      title: args.title,
      body: args.body,
      state: args.state,
      assignees: args.assignees,
      labels: args.labels,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Updated issue #${issue.number}: ${issue.title}\nState: ${issue.state}\nURL: ${issue.html_url}`,
        },
      ],
    };
  }

  private async closeIssue(args: {
    owner: string;
    repo: string;
    issue_number: number;
    reason?: 'completed' | 'not_planned';
  }) {
    const { data: issue } = await this.octokit.rest.issues.update({
      owner: args.owner,
      repo: args.repo,
      issue_number: args.issue_number,
      state: 'closed',
      state_reason: args.reason,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Closed issue #${issue.number}: ${issue.title}\nReason: ${args.reason || 'not specified'}\nURL: ${issue.html_url}`,
        },
      ],
    };
  }

  private async addIssueComment(args: {
    owner: string;
    repo: string;
    issue_number: number;
    body: string;
  }) {
    const { data: comment } = await this.octokit.rest.issues.createComment({
      owner: args.owner,
      repo: args.repo,
      issue_number: args.issue_number,
      body: args.body,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Added comment to issue #${args.issue_number}\nComment ID: ${comment.id}\nURL: ${comment.html_url}`,
        },
      ],
    };
  }

  private async getRepository(args: {
    owner: string;
    repo: string;
  }) {
    const { data: repo } = await this.octokit.rest.repos.get({
      owner: args.owner,
      repo: args.repo,
    });

    const summary = {
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      fork: repo.fork,
      stargazers_count: repo.stargazers_count,
      watchers_count: repo.watchers_count,
      forks_count: repo.forks_count,
      open_issues_count: repo.open_issues_count,
      default_branch: repo.default_branch,
      language: repo.language,
      size: repo.size,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      clone_url: repo.clone_url,
      html_url: repo.html_url,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async listCommits(args: {
    owner: string;
    repo: string;
    sha?: string;
    path?: string;
    per_page?: number;
  }) {
    const { data: commits } = await this.octokit.rest.repos.listCommits({
      owner: args.owner,
      repo: args.repo,
      sha: args.sha,
      path: args.path,
      per_page: args.per_page || 30,
    });

    const summary = commits.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author?.name,
        email: commit.commit.author?.email,
        date: commit.commit.author?.date,
      },
      committer: {
        name: commit.commit.committer?.name,
        email: commit.commit.committer?.email,
        date: commit.commit.committer?.date,
      },
      url: commit.html_url,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async getCommit(args: {
    owner: string;
    repo: string;
    ref: string;
  }) {
    const { data: commit } = await this.octokit.rest.repos.getCommit({
      owner: args.owner,
      repo: args.repo,
      ref: args.ref,
    });

    const summary = {
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author?.name,
        email: commit.commit.author?.email,
        date: commit.commit.author?.date,
      },
      stats: commit.stats,
      files: commit.files?.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
      })),
      url: commit.html_url,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async listBranches(args: {
    owner: string;
    repo: string;
    protected?: boolean;
    per_page?: number;
  }) {
    const { data: branches } = await this.octokit.rest.repos.listBranches({
      owner: args.owner,
      repo: args.repo,
      protected: args.protected,
      per_page: args.per_page || 30,
    });

    const summary = branches.map(branch => ({
      name: branch.name,
      commit: {
        sha: branch.commit.sha,
        url: branch.commit.url,
      },
      protected: branch.protected,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async createBranch(args: {
    owner: string;
    repo: string;
    ref: string;
    sha: string;
  }) {
    const { data: ref } = await this.octokit.rest.git.createRef({
      owner: args.owner,
      repo: args.repo,
      ref: args.ref,
      sha: args.sha,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Created branch: ${ref.ref}\nSHA: ${ref.object.sha}\nURL: ${ref.url}`,
        },
      ],
    };
  }

  private async getFileContent(args: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  }) {
    const { data: file } = await this.octokit.rest.repos.getContent({
      owner: args.owner,
      repo: args.repo,
      path: args.path,
      ref: args.ref,
    });

    if (Array.isArray(file)) {
      return {
        content: [
          {
            type: 'text',
            text: `Path is a directory with ${file.length} items:\n${file.map(item => `${item.type}: ${item.name}`).join('\n')}`,
          },
        ],
      };
    }

    const content = file.type === 'file' ? 
      Buffer.from(file.content, 'base64').toString('utf-8') : 
      'File is not a regular file';

    return {
      content: [
        {
          type: 'text',
          text: `File: ${file.name}\nSize: ${file.size} bytes\nSHA: ${file.sha}\n\nContent:\n${content}`,
        },
      ],
    };
  }

  private async updateFile(args: {
    owner: string;
    repo: string;
    path: string;
    message: string;
    content: string;
    sha?: string;
    branch?: string;
  }) {
    const { data: result } = await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: args.owner,
      repo: args.repo,
      path: args.path,
      message: args.message,
      content: args.content,
      sha: args.sha,
      branch: args.branch,
    });

    return {
      content: [
        {
          type: 'text',
          text: `${args.sha ? 'Updated' : 'Created'} file: ${args.path}\nCommit SHA: ${result.commit.sha}\nURL: ${result.commit.html_url}`,
        },
      ],
    };
  }

  private async requestReview(args: {
    owner: string;
    repo: string;
    pull_number: number;
    reviewers?: string[];
    team_reviewers?: string[];
  }) {
    const { data: result } = await this.octokit.rest.pulls.requestReviewers({
      owner: args.owner,
      repo: args.repo,
      pull_number: args.pull_number,
      reviewers: args.reviewers,
      team_reviewers: args.team_reviewers,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Requested reviews for PR #${args.pull_number}\nReviewers: ${args.reviewers?.join(', ') || 'none'}\nTeam reviewers: ${args.team_reviewers?.join(', ') || 'none'}`,
        },
      ],
    };
  }

  private async submitReview(args: {
    owner: string;
    repo: string;
    pull_number: number;
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    body?: string;
  }) {
    const { data: review } = await this.octokit.rest.pulls.createReview({
      owner: args.owner,
      repo: args.repo,
      pull_number: args.pull_number,
      event: args.event,
      body: args.body,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Submitted ${args.event} review for PR #${args.pull_number}\nReview ID: ${review.id}\nURL: ${review.html_url}`,
        },
      ],
    };
  }

  private async listReviewComments(args: {
    owner: string;
    repo: string;
    pull_number: number;
  }) {
    const { data: comments } = await this.octokit.rest.pulls.listReviewComments({
      owner: args.owner,
      repo: args.repo,
      pull_number: args.pull_number,
    });

    const summary = comments.map(comment => ({
      id: comment.id,
      user: comment.user?.login,
      body: comment.body,
      path: comment.path,
      line: comment.line,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      url: comment.html_url,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async listLabels(args: {
    owner: string;
    repo: string;
    per_page?: number;
  }) {
    const { data: labels } = await this.octokit.rest.issues.listLabelsForRepo({
      owner: args.owner,
      repo: args.repo,
      per_page: args.per_page || 30,
    });

    const summary = labels.map(label => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async createLabel(args: {
    owner: string;
    repo: string;
    name: string;
    color: string;
    description?: string;
  }) {
    const { data: label } = await this.octokit.rest.issues.createLabel({
      owner: args.owner,
      repo: args.repo,
      name: args.name,
      color: args.color,
      description: args.description,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Created label: ${label.name}\nColor: #${label.color}\nDescription: ${label.description || 'none'}`,
        },
      ],
    };
  }

  private async listMilestones(args: {
    owner: string;
    repo: string;
    state?: 'open' | 'closed' | 'all';
    per_page?: number;
  }) {
    const { data: milestones } = await this.octokit.rest.issues.listMilestones({
      owner: args.owner,
      repo: args.repo,
      state: args.state || 'open',
      per_page: args.per_page || 30,
    });

    const summary = milestones.map(milestone => ({
      number: milestone.number,
      title: milestone.title,
      description: milestone.description,
      state: milestone.state,
      open_issues: milestone.open_issues,
      closed_issues: milestone.closed_issues,
      due_on: milestone.due_on,
      created_at: milestone.created_at,
      updated_at: milestone.updated_at,
      url: milestone.html_url,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async createMilestone(args: {
    owner: string;
    repo: string;
    title: string;
    description?: string;
    due_on?: string;
  }) {
    const { data: milestone } = await this.octokit.rest.issues.createMilestone({
      owner: args.owner,
      repo: args.repo,
      title: args.title,
      description: args.description,
      due_on: args.due_on,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Created milestone: ${milestone.title}\nNumber: ${milestone.number}\nDue: ${milestone.due_on || 'not set'}\nURL: ${milestone.html_url}`,
        },
      ],
    };
  }

  private async listCollaborators(args: {
    owner: string;
    repo: string;
    affiliation?: 'outside' | 'direct' | 'all';
    per_page?: number;
  }) {
    const { data: collaborators } = await this.octokit.rest.repos.listCollaborators({
      owner: args.owner,
      repo: args.repo,
      affiliation: args.affiliation || 'all',
      per_page: args.per_page || 30,
    });

    const summary = collaborators.map(collaborator => ({
      login: collaborator.login,
      id: collaborator.id,
      type: collaborator.type,
      site_admin: collaborator.site_admin,
      permissions: collaborator.permissions,
      url: collaborator.html_url,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async checkUserPermissions(args: {
    owner: string;
    repo: string;
    username: string;
  }) {
    try {
      const { data: permission } = await this.octokit.rest.repos.getCollaboratorPermissionLevel({
        owner: args.owner,
        repo: args.repo,
        username: args.username,
      });

      return {
        content: [
          {
            type: 'text',
            text: `User ${args.username} permissions:\nLevel: ${permission.permission}\nUser: ${permission.user?.login}\nType: ${permission.user?.type}`,
          },
        ],
      };
    } catch (error: any) {
      if (error.status === 404) {
        return {
          content: [
            {
              type: 'text',
              text: `User ${args.username} is not a collaborator on ${args.owner}/${args.repo}`,
            },
          ],
        };
      }
      throw error;
    }
  }

  private async assignIssue(args: {
    owner: string;
    repo: string;
    issue_number: number;
    assignees: string[];
  }) {
    const { data: issue } = await this.octokit.rest.issues.addAssignees({
      owner: args.owner,
      repo: args.repo,
      issue_number: args.issue_number,
      assignees: args.assignees,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Assigned issue #${issue.number} to: ${args.assignees.join(', ')}\nURL: ${issue.html_url}`,
        },
      ],
    };
  }

  private async searchRepositories(args: {
    q: string;
    sort?: 'stars' | 'forks' | 'updated';
    order?: 'asc' | 'desc';
    per_page?: number;
  }) {
    const { data: result } = await this.octokit.rest.search.repos({
      q: args.q,
      sort: args.sort,
      order: args.order || 'desc',
      per_page: args.per_page || 30,
    });

    const summary = {
      total_count: result.total_count,
      incomplete_results: result.incomplete_results,
      items: result.items.map(repo => ({
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        updated_at: repo.updated_at,
        url: repo.html_url,
      })),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async searchIssues(args: {
    q: string;
    sort?: 'comments' | 'reactions' | 'created' | 'updated';
    order?: 'asc' | 'desc';
    per_page?: number;
  }) {
    const { data: result } = await this.octokit.rest.search.issuesAndPullRequests({
      q: args.q,
      sort: args.sort,
      order: args.order || 'desc',
      per_page: args.per_page || 30,
    });

    const summary = {
      total_count: result.total_count,
      incomplete_results: result.incomplete_results,
      items: result.items.map(item => ({
        number: item.number,
        title: item.title,
        state: item.state,
        user: item.user?.login,
        labels: item.labels?.map(label => typeof label === 'string' ? label : label.name),
        created_at: item.created_at,
        updated_at: item.updated_at,
        url: item.html_url,
        repository_url: item.repository_url,
      })),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async searchCode(args: {
    q: string;
    sort?: 'indexed';
    order?: 'asc' | 'desc';
    per_page?: number;
  }) {
    const { data: result } = await this.octokit.rest.search.code({
      q: args.q,
      sort: args.sort,
      order: args.order || 'desc',
      per_page: args.per_page || 30,
    });

    const summary = {
      total_count: result.total_count,
      incomplete_results: result.incomplete_results,
      items: result.items.map(item => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        url: item.html_url,
        git_url: item.git_url,
        repository: {
          name: item.repository.name,
          full_name: item.repository.full_name,
          url: item.repository.html_url,
        },
      })),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async listWorkflows(args: {
    owner: string;
    repo: string;
    per_page?: number;
  }) {
    const { data: workflows } = await this.octokit.rest.actions.listRepoWorkflows({
      owner: args.owner,
      repo: args.repo,
      per_page: args.per_page || 30,
    });

    const summary = workflows.workflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      path: workflow.path,
      state: workflow.state,
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
      url: workflow.html_url,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async triggerWorkflow(args: {
    owner: string;
    repo: string;
    workflow_id: string;
    ref: string;
    inputs?: { [key: string]: unknown };
  }) {
    await this.octokit.rest.actions.createWorkflowDispatch({
      owner: args.owner,
      repo: args.repo,
      workflow_id: args.workflow_id,
      ref: args.ref,
      inputs: args.inputs,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Triggered workflow: ${args.workflow_id}\nRef: ${args.ref}\nInputs: ${JSON.stringify(args.inputs || {}, null, 2)}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GitHub MCP server running on stdio');
  }
}

if (require.main === module) {
  const server = new GitHubMCPServer();
  server.run().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
}