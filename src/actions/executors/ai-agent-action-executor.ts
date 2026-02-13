/**
 * AI Agent Action Executor
 *
 * Executes AI agent actions using Claude via Vertex AI.
 */

import type { PromptRegistry } from '../../agent/prompts/registry.js';
import { AgentRuntime } from '../../agent/runtime.js';
import { buildToolRegistry, parseRepository } from '../../agent/tools/builder.js';
import type { GitHubRepositoryManager } from '../../github/repository-manager.js';
import type { Logger } from '../../logging/logger.js';
import type { ActionConfig, AIAgentAction } from '../../types/actions.js';
import type { AgentConfig, VertexConfig } from '../../types/agent.js';
import type { ContextManagementConfig, VertexAISafety } from '../../types/config';
import type { Event } from '../../types/events.js';
import type { ActionExecutorInterface } from './action-executor-interface.js';

interface WorkDirectoryManager {
    getWorkDirForEvent(event: Event): string;
    ensureWorkDir(workDir: string): Promise<void>;
    getRepositoryDir(workDir: string): string;
}

export class AIAgentActionExecutor implements ActionExecutorInterface {
    private workDirManager: WorkDirectoryManager;
    private repositoryManager: GitHubRepositoryManager;
    private vertexConfig: VertexConfig;
    private safetyConfig: VertexAISafety;
    private contextManagementConfig: ContextManagementConfig;
    private githubToken: string;
    private promptRegistry: PromptRegistry;
    private dryRun: boolean;

    constructor(
        workDirManager: WorkDirectoryManager,
        repositoryManager: GitHubRepositoryManager,
        vertexConfig: VertexConfig,
        safetyConfig: VertexAISafety,
        contextManagementConfig: ContextManagementConfig,
        githubToken: string,
        promptRegistry: PromptRegistry,
        dryRun: boolean = false,
    ) {
        this.workDirManager = workDirManager;
        this.repositoryManager = repositoryManager;
        this.vertexConfig = vertexConfig;
        this.safetyConfig = safetyConfig;
        this.contextManagementConfig = contextManagementConfig;
        this.githubToken = githubToken;
        this.promptRegistry = promptRegistry;
        this.dryRun = dryRun;
    }

    /**
     * Executes an AI agent action
     *
     * @param action Action configuration
     * @param event Event object
     * @param actionLogger Action logger instance
     */
    async execute(action: ActionConfig, event: Event, actionLogger: Logger): Promise<void> {
        if (action.type !== 'ai-agent') {
            throw new Error('Invalid action type for AIAgentActionExecutor');
        }

        const promptName = action.prompt;
        const toolNames = action.tools;

        if (!promptName) {
            throw new Error('AI agent action missing "prompt" field');
        }

        if (!toolNames || !Array.isArray(toolNames)) {
            throw new Error('AI agent action missing "tools" array');
        }

        // Get or create work directory
        const workDir = this.workDirManager.getWorkDirForEvent(event);
        await this.workDirManager.ensureWorkDir(workDir);

        // Ensure repository is cloned
        const repoDir = this.workDirManager.getRepositoryDir(workDir);
        const repository = this.repositoryManager.getRepository(repoDir, event.repository);
        await repository.ensureCloned();

        actionLogger.info(`Starting AI agent with prompt: ${promptName}`);
        actionLogger.info(`Tools: ${toolNames.join(', ')}`);
        actionLogger.info(`Work directory: ${workDir}`);
        actionLogger.info('');

        try {
            // Parse repository owner/name
            const { owner, repo } = parseRepository(event.repository);

            // Build tool registry (with dry-run support)
            const toolRegistry = buildToolRegistry(
                {
                    githubToken: this.githubToken,
                    owner,
                    repo,
                    workDir,
                },
                toolNames,
                actionLogger,
                this.dryRun,
            );

            actionLogger.info(`Configured ${toolRegistry.getCount()} tools`);
            actionLogger.info('');

            // Render prompts with event data
            const prompts = await this.promptRegistry.render(promptName, event);

            actionLogger.info(`Action prompt: ${promptName}`);
            actionLogger.info('');

            // Create agent runtime
            const agentConfig: AgentConfig = {
                vertex: {
                    ...this.vertexConfig,
                    model: action.model || this.vertexConfig.model,
                },
                safety: this.safetyConfig,
                contextManagement: this.contextManagementConfig,
            };

            const runtime = new AgentRuntime(agentConfig, actionLogger);

            // Execute agent with step logging
            const result = await runtime.execute({
                systemPrompt: prompts.systemPrompt,
                goal: prompts.actionPrompt,
                tools: toolRegistry,
                dryRun: this.dryRun,
                onStep: async (step, _conversation, response) => {
                    actionLogger.info(`--- Step ${step} ---`);
                    actionLogger.info(`Stop reason: ${response.stop_reason}`);
                    actionLogger.info(`Tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);

                    // Log assistant's text response (thought process)
                    const textBlocks = response.content.filter((block) => block.type === 'text');
                    if (textBlocks.length > 0) {
                        actionLogger.info('Assistant response:');
                        for (const block of textBlocks) {
                            if (block.text) {
                                // Log the text with proper indentation for readability
                                const lines = block.text.split('\n');
                                for (const line of lines) {
                                    actionLogger.info(`  ${line}`);
                                }
                            }
                        }
                    }

                    // Log tool usage details if tools were called
                    if (response.stop_reason === 'tool_use') {
                        const toolUses = response.content.filter((block) => block.type === 'tool_use');
                        actionLogger.info(`Tools called: ${toolUses.length}`);

                        for (const toolUse of toolUses) {
                            actionLogger.info(`  - Tool: ${toolUse.name}`);
                            actionLogger.info(
                                `    Input: ${JSON.stringify(toolUse.input, null, 2).split('\n').join('\n    ')}`,
                            );
                        }
                    }

                    actionLogger.info('');
                },
            });

            actionLogger.info('');
            actionLogger.info('=== Agent Execution Complete ===');
            actionLogger.info(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
            actionLogger.info(`Steps taken: ${result.steps}`);
            actionLogger.info(`Tool calls: ${result.tool_calls}`);
            actionLogger.info(
                `Tokens used: ${result.tokens.total} (${result.tokens.input} in, ${result.tokens.output} out)`,
            );

            if (result.stopped_by_limit) {
                actionLogger.info(`Stopped by limit: ${result.limit_exceeded}`);
            }

            actionLogger.info('');

            if (result.final_text) {
                actionLogger.info('=== Agent Final Response ===');
                actionLogger.info(result.final_text);
            }

            if (!result.success) {
                throw new Error('Agent execution did not complete successfully');
            }
        } catch (error) {
            actionLogger.info(`AI agent failed: ${(error as Error).message}`);
            throw error;
        }
    }

    async executeDryRun(action: ActionConfig, event: Event, actionLogger: Logger): Promise<void> {
        const workDir = this.workDirManager.getWorkDirForEvent(event);
        await this.workDirManager.ensureWorkDir(workDir);

        // Ensure repository is cloned
        const repoDir = this.workDirManager.getRepositoryDir(workDir);
        const repository = this.repositoryManager.getRepository(repoDir, event.repository);
        await repository.ensureCloned();

        actionLogger.info('--- DRY RUN: Action would be executed as follows ---');
        actionLogger.info('Dry run configuration', { actionType: action.type });

        actionLogger.info('AI agent action details', {
            prompt: (action as AIAgentAction).prompt,
            tools: (action as AIAgentAction).tools,
            model: (action as AIAgentAction).model || 'default',
            workDir,
        });

        actionLogger.info('--- End of dry run information ---');
    }
}
