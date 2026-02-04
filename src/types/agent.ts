/**
 * Agent type definitions
 */

// Vertex AI types
export interface VertexConfig {
    projectId: string;
    region?: string;
    model?: string;
}

export interface VertexInfo {
    projectId: string;
    region: string;
    model: string;
}

// Message types
export interface MessageContent {
    type: string;
    text?: string;
    tool_use_id?: string;
    content?: string;
    id?: string;
    name?: string;
    input?: any;
}

export interface Message {
    role: 'user' | 'assistant';
    content: string | MessageContent[];
}

export interface MessageResponse {
    id: string;
    type: string;
    role: string;
    content: MessageContent[];
    model: string;
    stop_reason: string;
    stop_sequence: string | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

export interface CreateMessageParams {
    system?: string;
    messages: Message[];
    tools?: ToolSchema[];
    max_tokens?: number;
    model?: string;
}

// Safety types
export interface SafetyConfig {
    maxSteps?: number;
    maxToolCalls?: number;
    maxTokens?: number;
}

export interface LimitStats {
    current: number;
    max: number;
    remaining: number;
}

export interface SafetyStats {
    steps: LimitStats;
    toolCalls: LimitStats;
    tokens: LimitStats & {
        input: number;
        output: number;
        total: number;
    };
}

// Tool types
export interface ToolSchema {
    name: string;
    description: string;
    input_schema: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
        [key: string]: any;
    };
}

export interface Tool extends ToolSchema {
    execute: (input: any) => Promise<any>;
    executeMock: (input: any) => Promise<any>;
}

export interface ToolResult {
    error?: boolean;
    message?: string;
    tool?: string;
    [key: string]: any;
}

// Runtime types
export interface AgentConfig {
    vertex: VertexConfig;
    safety?: SafetyConfig;
}

export interface ExecuteParams {
    systemPrompt: string;
    goal: string;
    tools: any; // Will be ToolRegistry, imported separately to avoid circular dependency
    onStep?: (step: number, conversation: any, response: MessageResponse) => Promise<void> | void;
    dryRun?: boolean; // If true, simulates tool execution without making actual changes
}

export interface ExecutionResult {
    success: boolean;
    stopped_by_limit: boolean;
    limit_exceeded: string | null;
    steps: number;
    tool_calls: number;
    tokens: {
        input: number;
        output: number;
        total: number;
    };
    final_text: string | null;
    conversation: any; // Will be Conversation
}
