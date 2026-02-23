/**
 * GitHub Repository
 *
 * Represents a local clone of a GitHub repository, including:
 * - Cloning the repository
 * - Checking repository existence
 * - Managing repository state
 */

import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { getLogger, type Logger } from '../logging/logger.js';
import type { GitHubConfig } from '../types/config.js';
import { getCurrentUser } from './current-user.js';

const execAsync = promisify(exec);

/**
 * Represents a local clone of a GitHub repository
 */
export class GitHubRepository {
    private logger: Logger;
    private targetPath: string;
    private owner: string;
    private name: string;
    private _githubConfig: GitHubConfig;
    private maxBuffer: number = 10 * 1024 * 1024; // 10MB

    /**
     * Creates a new GitHubRepository instance for a specific repository
     *
     * @param targetPath Local filesystem path where the repository is/will be cloned
     * @param owner Repository owner (GitHub username or organization)
     * @param name Repository name
     * @param githubConfig GitHub configuration (includes token)
     */
    constructor(targetPath: string, owner: string, name: string, githubConfig: GitHubConfig) {
        this.logger = getLogger();
        this.targetPath = targetPath;
        this.owner = owner;
        this.name = name;
        this._githubConfig = githubConfig;
    }

    /**
     * Gets the GitHub configuration
     *
     * @returns GitHub configuration
     */
    getGitHubConfig(): GitHubConfig {
        return this._githubConfig;
    }

    /**
     * Gets the repository identifier in owner/name format
     *
     * @returns Repository identifier (e.g., "owner/repo")
     */
    getRepositoryId(): string {
        return `${this.owner}/${this.name}`;
    }

    /**
     * Gets the local filesystem path for this repository
     *
     * @returns Target path where the repository is/will be located
     */
    getPath(): string {
        return this.targetPath;
    }

    /**
     * Ensures the repository is cloned
     *
     * If the repository doesn't exist, it will be cloned.
     * If it already exists, it will be updated with git pull.
     */
    async ensureCloned(): Promise<void> {
        const gitDir = join(this.targetPath, '.git');

        if (!existsSync(gitDir)) {
            // If directory is not empty but has no .git, clean it first
            await this.cleanDirectoryIfNeeded();
            await this.clone();
        } else {
            // Repository exists, update it with git pull
            await this.pull();
        }
    }

    /**
     * Clones the repository
     *
     * Uses shallow clone by default (--depth 1) for faster cloning and less disk space.
     * Depth can be configured via githubConfig.cloneDepth (0 = full clone).
     */
    async clone(): Promise<void> {
        const repoUrl = this.getRepositoryUrl();
        const maskedUrl = this.getMaskedRepositoryUrl();

        // Default to shallow clone with depth 1
        const cloneDepth = this._githubConfig.cloneDepth ?? 1;
        const depthArg = cloneDepth > 0 ? `--depth ${cloneDepth}` : '';

        this.logger.info('Cloning repository', {
            repository: this.getRepositoryId(),
            destination: this.targetPath,
            url: maskedUrl,
            depth: cloneDepth > 0 ? cloneDepth : 'full',
        });

        try {
            await execAsync(`git clone ${depthArg} ${repoUrl} .`, {
                cwd: this.targetPath,
                maxBuffer: this.maxBuffer,
            });

            this.logger.info('Successfully cloned repository', {
                repository: this.getRepositoryId(),
                depth: cloneDepth > 0 ? cloneDepth : 'full',
            });

            // Add fork remote after successful clone
            await this.addForkRemote();
        } catch (error) {
            this.logger.error('Failed to clone repository', error as Error, {
                repository: this.getRepositoryId(),
                url: maskedUrl,
            });
            throw error;
        }
    }

    /**
     * Updates the repository by pulling latest changes
     *
     * This is called when the repository already exists and needs to be updated.
     */
    async pull(): Promise<void> {
        const maskedUrl = this.getMaskedRepositoryUrl();

        this.logger.info('Pulling latest changes', {
            repository: this.getRepositoryId(),
            path: this.targetPath,
            url: maskedUrl,
        });

        try {
            await execAsync('git pull', {
                cwd: this.targetPath,
                maxBuffer: this.maxBuffer,
            });

            this.logger.info('Successfully pulled latest changes', {
                repository: this.getRepositoryId(),
            });
        } catch (error) {
            this.logger.error('Failed to pull repository', error as Error, {
                repository: this.getRepositoryId(),
                url: maskedUrl,
            });
            throw error;
        }
    }

    /**
     * Cleans the target directory if it's not empty
     *
     * This handles the case where a previous action left files in the workspace
     * but the .git directory is missing.
     */
    private async cleanDirectoryIfNeeded(): Promise<void> {
        try {
            const entries = await readdir(this.targetPath);

            if (entries.length > 0) {
                this.logger.info('Cleaning non-empty directory before clone', {
                    repository: this.getRepositoryId(),
                    path: this.targetPath,
                    fileCount: entries.length,
                });

                // Remove all files and directories
                for (const entry of entries) {
                    const entryPath = join(this.targetPath, entry);
                    await rm(entryPath, { recursive: true, force: true });
                }

                this.logger.debug('Directory cleaned successfully', {
                    repository: this.getRepositoryId(),
                });
            }
        } catch (error) {
            // If directory doesn't exist or can't be read, that's fine
            // The clone operation will handle creating it
            this.logger.debug('No cleanup needed', {
                repository: this.getRepositoryId(),
            });
        }
    }

    /**
     * Checks if the repository exists locally
     *
     * @returns True if the repository exists, false otherwise
     */
    exists(): boolean {
        const gitDir = join(this.targetPath, '.git');
        return existsSync(gitDir);
    }

    /**
     * Gets the Git URL for this repository
     *
     * Uses HTTPS with token authentication for cloning.
     *
     * @returns Git URL for the repository with authentication
     */
    private getRepositoryUrl(): string {
        const token = this._githubConfig.token;
        if (!token) {
            throw new Error('GitHub token is required for repository cloning');
        }
        // Use HTTPS with token authentication
        // Format: https://<token>@github.com/<owner>/<repo>.git
        return `https://${token}@github.com/${this.owner}/${this.name}.git`;
    }

    /**
     * Gets a masked version of the repository URL for logging
     *
     * @returns Git URL with token masked
     */
    private getMaskedRepositoryUrl(): string {
        return `https://***@github.com/${this.owner}/${this.name}.git`;
    }

    /**
     * Adds a 'fork' remote pointing to the current user's fork of the repository
     *
     * This is used when creating pull requests from the fork back to the original repository.
     */
    private async addForkRemote(): Promise<void> {
        const currentUser = getCurrentUser();

        if (!currentUser) {
            this.logger.warn('Cannot add fork remote: current user not set', {
                repository: this.getRepositoryId(),
            });
            return;
        }

        const forkUrl = this.getForkRepositoryUrl(currentUser.login);
        const maskedForkUrl = this.getMaskedForkRepositoryUrl(currentUser.login);

        this.logger.info('Adding fork remote', {
            repository: this.getRepositoryId(),
            forkOwner: currentUser.login,
            url: maskedForkUrl,
        });

        try {
            await execAsync(`git remote add fork ${forkUrl}`, {
                cwd: this.targetPath,
                maxBuffer: this.maxBuffer,
            });

            this.logger.debug('Successfully added fork remote', {
                repository: this.getRepositoryId(),
                forkOwner: currentUser.login,
            });
        } catch (error) {
            this.logger.error('Failed to add fork remote', error as Error, {
                repository: this.getRepositoryId(),
                forkOwner: currentUser.login,
            });
            // Don't throw - this is not critical for repository cloning
        }
    }

    /**
     * Gets the Git URL for the fork repository
     *
     * @param forkOwner The owner of the fork (typically the current user)
     * @returns Git URL for the fork repository with authentication
     */
    private getForkRepositoryUrl(forkOwner: string): string {
        const token = this._githubConfig.token;
        if (!token) {
            throw new Error('GitHub token is required for fork remote');
        }
        return `https://${token}@github.com/${forkOwner}/${this.name}.git`;
    }

    /**
     * Gets a masked version of the fork repository URL for logging
     *
     * @param forkOwner The owner of the fork
     * @returns Git URL with token masked
     */
    private getMaskedForkRepositoryUrl(forkOwner: string): string {
        return `https://***@github.com/${forkOwner}/${this.name}.git`;
    }
}
