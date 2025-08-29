#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const server = new Server(
  {
    name: '@skhatri/git-mcp',
    version: '0.5.0',
  }
);

async function runGitCommand(command: string, workingDir?: string): Promise<string> {
  try {
    // Priority: explicit workingDir > PWD env var > process.cwd()
    const cwd = workingDir || process.env.PWD || process.cwd();
    
    // Use git -C option to specify directory instead of relying on cwd option
    const gitPath = process.env.GIT_PATH || '/usr/bin/git';
    const fullCommand = `${gitPath} -C "${cwd}" ${command}`;
    
    console.error(`[git-mcp] Running command: ${fullCommand}`);
    console.error(`[git-mcp] Working directory: ${cwd}`);
    console.error(`[git-mcp] PWD env var: ${process.env.PWD}`);
    console.error(`[git-mcp] process.cwd(): ${process.cwd()}`);
    
    const { stdout, stderr } = await execAsync(fullCommand, { 
      timeout: 10000,
      env: { ...process.env } // Preserve all environment variables including PATH
    });
    console.error(`[git-mcp] Command output: ${stdout.trim()}`);
    if (stderr && stderr.trim()) {
      console.error(`[git-mcp] Command stderr: ${stderr.trim()}`);
    }
    return stdout.trim();
  } catch (error: any) {
    console.error(`[git-mcp] Command failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error.stdout) console.error(`[git-mcp] Failed command stdout: ${error.stdout}`);
    if (error.stderr) console.error(`[git-mcp] Failed command stderr: ${error.stderr}`);
    if (error.code) console.error(`[git-mcp] Exit code: ${error.code}`);
    throw new Error(`Git command failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Git Info Tools
      {
        name: 'git_top_committer',
        description: 'Get the top committer in the repository',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of top committers to show (default: 5)',
            },
            working_dir: {
              type: 'string',
              description: 'Working directory path (defaults to current directory)',
            },
          },
        },
      },
      {
        name: 'git_last_commit',
        description: 'Get information about the last commit',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'git_commit_info',
        description: 'Get detailed information about a specific commit',
        inputSchema: {
          type: 'object',
          properties: {
            hash: {
              type: 'string',
              description: 'Commit hash to get info for',
            },
          },
          required: ['hash'],
        },
      },
      // Branch Operations
      {
        name: 'git_branches',
        description: 'List local branches',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'git_remote_branches',
        description: 'List remote branches',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'git_merged_branches',
        description: 'List branches that have been merged',
        inputSchema: {
          type: 'object',
          properties: {
            target_branch: {
              type: 'string',
              description: 'Target branch to check merges against (default: current branch)',
            },
          },
        },
      },
      {
        name: 'git_unmerged_branches',
        description: 'List branches that have not been merged',
        inputSchema: {
          type: 'object',
          properties: {
            target_branch: {
              type: 'string',
              description: 'Target branch to check merges against (default: current branch)',
            },
          },
        },
      },
      // Rebase Operations
      {
        name: 'git_rebase_from_remote',
        description: 'Rebase current branch from a remote branch',
        inputSchema: {
          type: 'object',
          properties: {
            remote_branch: {
              type: 'string',
              description: 'Remote branch to rebase from (e.g., origin/main)',
            },
          },
          required: ['remote_branch'],
        },
      },
      {
        name: 'git_rebase_branch_to_branch',
        description: 'Rebase one branch onto another',
        inputSchema: {
          type: 'object',
          properties: {
            source_branch: {
              type: 'string',
              description: 'Branch to rebase',
            },
            target_branch: {
              type: 'string',
              description: 'Branch to rebase onto',
            },
          },
          required: ['source_branch', 'target_branch'],
        },
      },
      {
        name: 'git_rebase_range',
        description: 'Rebase a range of commits to a branch',
        inputSchema: {
          type: 'object',
          properties: {
            start_commit: {
              type: 'string',
              description: 'Start commit hash or reference',
            },
            end_commit: {
              type: 'string',
              description: 'End commit hash or reference',
            },
            target_branch: {
              type: 'string',
              description: 'Target branch to rebase onto',
            },
          },
          required: ['start_commit', 'end_commit', 'target_branch'],
        },
      },
      // Remote Operations
      {
        name: 'git_push_to_origin',
        description: 'Push current branch to origin',
        inputSchema: {
          type: 'object',
          properties: {
            branch: {
              type: 'string',
              description: 'Branch to push (defaults to current branch)',
            },
            force: {
              type: 'boolean',
              description: 'Force push (use with caution)',
              default: false,
            },
          },
        },
      },
      {
        name: 'git_pull_from_origin',
        description: 'Pull from origin for current branch',
        inputSchema: {
          type: 'object',
          properties: {
            branch: {
              type: 'string',
              description: 'Branch to pull (defaults to current branch)',
            },
            rebase: {
              type: 'boolean',
              description: 'Use rebase instead of merge',
              default: false,
            },
          },
        },
      },
      {
        name: 'git_fetch_from_origin',
        description: 'Fetch from origin',
        inputSchema: {
          type: 'object',
          properties: {
            prune: {
              type: 'boolean',
              description: 'Remove remote tracking branches that no longer exist',
              default: true,
            },
          },
        },
      },
      // Commit Operations
      {
        name: 'git_commit',
        description: 'Create a commit with an appropriate message',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Commit message',
            },
            add_all: {
              type: 'boolean',
              description: 'Add all modified files before committing',
              default: false,
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'git_commit_files',
        description: 'Commit specific files or file patterns',
        inputSchema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of file paths or patterns to commit',
            },
            message: {
              type: 'string',
              description: 'Commit message',
            },
          },
          required: ['files', 'message'],
        },
      },
      {
        name: 'git_status',
        description: 'Get current Git status',
        inputSchema: {
          type: 'object',
          properties: {
            porcelain: {
              type: 'boolean',
              description: 'Use porcelain format for machine-readable output',
              default: false,
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.error(`[git-mcp] Tool called: ${name} with args:`, args);

  try {
    switch (name) {
      case 'git_top_committer': {
        const limit = (args && args.limit) ? args.limit as number : 5;
        const workingDir = (args && args.working_dir) ? args.working_dir as string : undefined;
        console.error(`[git-mcp] Executing git_top_committer with limit: ${limit}, working_dir: ${workingDir}`);
        
        // Use git log instead of shortlog as shortlog can hang on some repos
        const logOutput = await runGitCommand('log --pretty=format:"%an" --all', workingDir);
        const authors = logOutput.split('\n').filter(line => line.trim());
        
        // Count occurrences
        const authorCounts: { [key: string]: number } = {};
        authors.forEach(author => {
          authorCounts[author] = (authorCounts[author] || 0) + 1;
        });
        
        // Sort by count and take top N
        const sortedAuthors = Object.entries(authorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([author, count]) => `${count.toString().padStart(6)} ${author}`)
          .join('\n');
        
        console.error(`[git-mcp] Git output: ${sortedAuthors}`);
        return {
          content: [
            {
              type: 'text',
              text: sortedAuthors,
            },
          ],
        };
      }

      case 'git_last_commit': {
        const output = await runGitCommand('log -1 --pretty=format:"%H%n%an%n%ae%n%ad%n%s"');
        const lines = output.split('\n');
        const commitInfo = {
          hash: lines[0],
          author: lines[1],
          email: lines[2],
          date: lines[3],
          message: lines[4],
        };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(commitInfo, null, 2),
            },
          ],
        };
      }

      case 'git_commit_info': {
        const hash = (args && args.hash) ? args.hash as string : '';
        const output = await runGitCommand(`show ${hash} --pretty=format:"%H%n%an%n%ae%n%ad%n%s%n%n%b" --stat`);
        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      }

      case 'git_branches': {
        const output = await runGitCommand('branch');
        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      }

      case 'git_remote_branches': {
        const output = await runGitCommand('branch -r');
        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      }

      case 'git_merged_branches': {
        const targetBranch = (args && args.target_branch) ? ` ${args.target_branch}` : '';
        const output = await runGitCommand(`branch --merged${targetBranch}`);
        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      }

      case 'git_unmerged_branches': {
        const targetBranch = (args && args.target_branch) ? ` ${args.target_branch}` : '';
        const output = await runGitCommand(`branch --no-merged${targetBranch}`);
        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      }

      case 'git_rebase_from_remote': {
        const remoteBranch = (args && args.remote_branch) ? args.remote_branch as string : '';
        const output = await runGitCommand(`rebase ${remoteBranch}`);
        return {
          content: [
            {
              type: 'text',
              text: `Rebase from ${remoteBranch} completed:\n${output}`,
            },
          ],
        };
      }

      case 'git_rebase_branch_to_branch': {
        const sourceBranch = (args && args.source_branch) ? args.source_branch as string : '';
        const targetBranch = (args && args.target_branch) ? args.target_branch as string : '';
        const output = await runGitCommand(`rebase --onto ${targetBranch} ${sourceBranch}`);
        return {
          content: [
            {
              type: 'text',
              text: `Rebase ${sourceBranch} onto ${targetBranch} completed:\n${output}`,
            },
          ],
        };
      }

      case 'git_rebase_range': {
        const startCommit = (args && args.start_commit) ? args.start_commit as string : '';
        const endCommit = (args && args.end_commit) ? args.end_commit as string : '';
        const targetBranch = (args && args.target_branch) ? args.target_branch as string : '';
        const output = await runGitCommand(`rebase --onto ${targetBranch} ${startCommit} ${endCommit}`);
        return {
          content: [
            {
              type: 'text',
              text: `Rebase range ${startCommit}..${endCommit} onto ${targetBranch} completed:\n${output}`,
            },
          ],
        };
      }

      case 'git_push_to_origin': {
        const branch = (args && args.branch) ? args.branch as string : undefined;
        const force = (args && args.force) ? args.force as boolean : false;
        const branchArg = branch ? ` origin ${branch}` : ' origin';
        const forceFlag = force ? ' --force' : '';
        const output = await runGitCommand(`push${branchArg}${forceFlag}`);
        return {
          content: [
            {
              type: 'text',
              text: `Push to origin completed:\n${output}`,
            },
          ],
        };
      }

      case 'git_pull_from_origin': {
        const branch = (args && args.branch) ? args.branch as string : undefined;
        const rebase = (args && args.rebase) ? args.rebase as boolean : false;
        const branchArg = branch ? ` origin ${branch}` : '';
        const rebaseFlag = rebase ? ' --rebase' : '';
        const output = await runGitCommand(`pull${rebaseFlag}${branchArg}`);
        return {
          content: [
            {
              type: 'text',
              text: `Pull from origin completed:\n${output}`,
            },
          ],
        };
      }

      case 'git_fetch_from_origin': {
        const prune = (args && args.prune) ? args.prune as boolean : true;
        const pruneFlag = prune ? ' --prune' : '';
        const output = await runGitCommand(`fetch origin${pruneFlag}`);
        return {
          content: [
            {
              type: 'text',
              text: `Fetch from origin completed:\n${output}`,
            },
          ],
        };
      }

      case 'git_commit': {
        const message = (args && args.message) ? args.message as string : '';
        const addAll = (args && args.add_all) ? args.add_all as boolean : false;
        
        if (addAll) {
          await runGitCommand('add -A');
        }
        
        const output = await runGitCommand(`commit -m "${message.replace(/"/g, '\\"')}"`);
        return {
          content: [
            {
              type: 'text',
              text: `Commit created:\n${output}`,
            },
          ],
        };
      }

      case 'git_commit_files': {
        const files = (args && args.files) ? args.files as string[] : [];
        const message = (args && args.message) ? args.message as string : '';
        
        // Add specified files
        for (const file of files) {
          await runGitCommand(`add "${file.replace(/"/g, '\\"')}"`);
        }
        
        const output = await runGitCommand(`commit -m "${message.replace(/"/g, '\\"')}"`);
        return {
          content: [
            {
              type: 'text',
              text: `Commit created with files [${files.join(', ')}]:\n${output}`,
            },
          ],
        };
      }

      case 'git_status': {
        const porcelain = (args && args.porcelain) ? args.porcelain as boolean : false;
        const porcelainFlag = porcelain ? ' --porcelain' : '';
        const output = await runGitCommand(`status${porcelainFlag}`);
        return {
          content: [
            {
              type: 'text',
              text: output,
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
  console.error('@skhatri/git-mcp server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});