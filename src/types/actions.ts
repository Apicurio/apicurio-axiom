/**
 * Action type definitions
 */

export interface ShellAction {
    type: 'shell';
    command: string;
}

export interface JavaScriptAction {
    type: 'javascript';
    code: string;
}

export interface AIAgentAction {
    type: 'ai-agent';
    prompt: string;
    tools: string[];
    model?: string;
}

export type ActionConfig = ShellAction | JavaScriptAction | AIAgentAction;

export interface ActionConfigurations {
    [actionName: string]: ActionConfig;
}

export interface LoggingConfig {
    basePath?: string;
}

/**
 * Context provided to JavaScript actions at execution time
 */
export interface ActionContext {
    /**
     * Logger instance for logging action output
     */
    logger: any; // Logger type

    /**
     * GitHub token for API access
     */
    githubToken?: string;

    /**
     * Dry-run mode indicator
     */
    dryRun: boolean;

    /**
     * Work directory for this action execution
     */
    workDir?: string;

    /**
     * Repository owner (extracted from event)
     */
    owner?: string;

    /**
     * Repository name (extracted from event)
     */
    repo?: string;
}
