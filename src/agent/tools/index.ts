/**
 * Tool Index
 *
 * Central registry of all available tools. Tools are imported and registered
 * here, providing a single source of truth for tool availability.
 */

import type { Tool } from '../../types/agent.js';

// Import all git tools
import { GitCreateBranchTool } from './git/create_branch.js';
import { GitDiffTool } from './git/diff.js';
import { GitLogTool } from './git/log.js';
import { GitStatusTool } from './git/status.js';

// Import all GitHub tools
import { AddCommentTool } from './github/add_comment.js';
import { AddDiscussionResponseTool } from './github/add_discussion_response.js';
import { AddLabelsTool } from './github/add_labels.js';
import { AssignIssueTool } from './github/assign_issue.js';
import { CloseIssueTool } from './github/close_issue.js';
import { CreateIssueTool } from './github/create_issue.js';
import { CreatePullRequestTool } from './github/create_pull_request.js';
import { GetDiscussionTool } from './github/get_discussion.js';
import { GetIssueDetailsTool } from './github/get_issue_details.js';
import { GetMilestonesTool } from './github/get_milestones.js';
import { GetRepositoryLabelsTool } from './github/get_repository_labels.js';
import { OpenPullRequestTool } from './github/open_pull_request.js';
import { SetIssueMilestoneTool } from './github/set_issue_milestone.js';

// Import all repo_read tools (read-only repository operations)
import { AnalyzeFileTypeTool } from './repo_read/analyze_file_type.js';
import { CheckPathExistsTool } from './repo_read/check_path_exists.js';
import { FindFilesTool } from './repo_read/find_files.js';
import { GetDirectoryTreeTool } from './repo_read/get_directory_tree.js';
import { GetFileMetadataTool } from './repo_read/get_file_metadata.js';
import { GetProjectStructureTool } from './repo_read/get_project_structure.js';
import { ListFilesTool } from './repo_read/list_files.js';
import { ReadFileTool } from './repo_read/read_file.js';
import { SearchCodeTool } from './repo_read/search_code.js';

// Import all repo_write tools (write/modify repository operations)
import { AppendToFileTool } from './repo_write/append_to_file.js';
import { ApplyPatchTool } from './repo_write/apply_patch.js';
import { CopyFileTool } from './repo_write/copy_file.js';
import { CreateDirectoryTool } from './repo_write/create_directory.js';
import { DeleteFileTool } from './repo_write/delete_file.js';
import { InsertAtLineTool } from './repo_write/insert_at_line.js';
import { MoveFileTool } from './repo_write/move_file.js';
import { ReplaceInFileTool } from './repo_write/replace_in_file.js';
import { ReplaceLinesTool } from './repo_write/replace_lines.js';
import { WriteFileTool } from './repo_write/write_file.js';

/**
 * ToolIndex - Singleton registry of all available tools
 */
export class ToolIndex {
    private static instance: ToolIndex | null = null;
    private tools = new Map<string, Tool>();

    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {
        this.initialize();
    }

    /**
     * Get the singleton instance
     *
     * @returns The ToolIndex instance
     */
    static getInstance(): ToolIndex {
        if (!ToolIndex.instance) {
            ToolIndex.instance = new ToolIndex();
        }
        return ToolIndex.instance;
    }

    /**
     * Initialize the tool index by registering all tools
     */
    private initialize(): void {
        // Register git tools
        this.register(GitCreateBranchTool);
        this.register(GitDiffTool);
        this.register(GitLogTool);
        this.register(GitStatusTool);

        // Register GitHub tools
        this.register(AddCommentTool);
        this.register(AddDiscussionResponseTool);
        this.register(AddLabelsTool);
        this.register(AssignIssueTool);
        this.register(CloseIssueTool);
        this.register(CreateIssueTool);
        this.register(CreatePullRequestTool);
        this.register(GetDiscussionTool);
        this.register(GetIssueDetailsTool);
        this.register(GetMilestonesTool);
        this.register(GetRepositoryLabelsTool);
        this.register(OpenPullRequestTool);
        this.register(SetIssueMilestoneTool);

        // Register repo_read tools (read-only operations)
        this.register(AnalyzeFileTypeTool);
        this.register(CheckPathExistsTool);
        this.register(FindFilesTool);
        this.register(GetDirectoryTreeTool);
        this.register(GetFileMetadataTool);
        this.register(GetProjectStructureTool);
        this.register(ListFilesTool);
        this.register(ReadFileTool);
        this.register(SearchCodeTool);

        // Register repo_write tools (write/modify operations)
        this.register(AppendToFileTool);
        this.register(ApplyPatchTool);
        this.register(CopyFileTool);
        this.register(CreateDirectoryTool);
        this.register(DeleteFileTool);
        this.register(InsertAtLineTool);
        this.register(MoveFileTool);
        this.register(ReplaceInFileTool);
        this.register(ReplaceLinesTool);
        this.register(WriteFileTool);
    }

    /**
     * Register a tool
     *
     * @param tool Tool to register
     */
    register(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    /**
     * Get a tool by name
     *
     * @param name Tool name
     * @returns Tool if found, undefined otherwise
     */
    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * Get all registered tools
     *
     * @returns Array of all tools
     */
    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get all tool names
     *
     * @returns Array of tool names
     */
    getNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Check if a tool exists
     *
     * @param name Tool name
     * @returns True if tool exists
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Get count of registered tools
     *
     * @returns Number of tools
     */
    count(): number {
        return this.tools.size;
    }
}
