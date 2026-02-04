/**
 * GitHub Repository Manager
 *
 * Manages GitHubRepository instances, creating them on demand and caching them.
 */

import { getLogger } from '../logging/logger.js';
import type { GitHubConfig } from '../types/config.js';
import { GitHubRepository } from './repository.js';

/**
 * Manages creation and caching of GitHubRepository instances
 */
export class GitHubRepositoryManager {
    private githubConfig: GitHubConfig;
    private repositories: Map<string, GitHubRepository>;

    /**
     * Creates a new GitHubRepositoryManager instance
     *
     * @param githubConfig GitHub configuration
     */
    constructor(githubConfig: GitHubConfig) {
        this.githubConfig = githubConfig;
        this.repositories = new Map();
    }

    /**
     * Gets or creates a GitHubRepository instance for the specified repository
     *
     * Instances are cached by their path to avoid creating duplicates.
     *
     * @param targetPath Local filesystem path where the repository is/will be cloned
     * @param repositoryId Repository in format owner/name (e.g., "octocat/Hello-World")
     * @returns GitHubRepository instance
     */
    getRepository(targetPath: string, repositoryId: string): GitHubRepository {
        // Use targetPath as the cache key since that's unique
        let repository = this.repositories.get(targetPath);

        if (!repository) {
            const [owner, name] = this.parseRepositoryId(repositoryId);
            repository = new GitHubRepository(targetPath, owner, name, this.githubConfig);
            this.repositories.set(targetPath, repository);

            getLogger().debug('Created new GitHubRepository instance', {
                repositoryId,
                targetPath,
            });
        }

        return repository;
    }

    /**
     * Parses a repository ID into owner and name components
     *
     * @param repositoryId Repository ID in format owner/name
     * @returns Tuple of [owner, name]
     */
    private parseRepositoryId(repositoryId: string): [string, string] {
        const parts = repositoryId.split('/');
        if (parts.length !== 2) {
            throw new Error(`Invalid repository ID format: ${repositoryId}. Expected format: owner/name`);
        }
        return [parts[0], parts[1]];
    }

    /**
     * Clears all cached repository instances
     */
    clearCache(): void {
        this.repositories.clear();
    }
}
