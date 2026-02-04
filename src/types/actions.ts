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
