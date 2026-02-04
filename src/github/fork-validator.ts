/**
 * Fork Validator
 *
 * Validates that monitored repositories are either owned by the authenticated user
 * or have forks in the user's account
 */

import type { Octokit } from '@octokit/rest';
import { getLogger } from '../logging/logger.js';
import type { CurrentGitHubUser } from '../types/github-user.js';

/**
 * Validates that all monitored repositories are accessible
 *
 * Each repository must be either:
 * 1. Owned by the authenticated user, OR
 * 2. Forked to the authenticated user's account
 *
 * @param octokit Authenticated Octokit instance
 * @param currentUser Current authenticated user
 * @param repositories Array of repositories in "owner/repo" format
 * @throws Error if any repository is not properly forked
 */
export async function validateRepositoryForks(
    octokit: Octokit,
    currentUser: CurrentGitHubUser,
    repositories: string[],
): Promise<void> {
    const logger = getLogger();
    const errors: string[] = [];

    logger.info('Validating repository access and forks...', {
        repositories: repositories.length,
    });

    for (const repository of repositories) {
        const [owner, repo] = repository.split('/');

        if (!owner || !repo) {
            errors.push(`Invalid repository format: "${repository}" (expected "owner/repo")`);
            continue;
        }

        // Check if the repository is owned by the current user
        if (owner === currentUser.login) {
            logger.debug('Repository owned by current user', {
                repository,
            });
            continue;
        }

        // Check if a fork exists in the current user's account
        try {
            await octokit.repos.get({
                owner: currentUser.login,
                repo: repo,
            });

            // Verify it's actually a fork of the upstream repository
            const forkRepo = await octokit.repos.get({
                owner: currentUser.login,
                repo: repo,
            });

            if (forkRepo.data.fork) {
                // Check if it's a fork of the correct parent
                const parent = forkRepo.data.parent;
                if (parent && parent.owner.login === owner && parent.name === repo) {
                    logger.debug('Found valid fork', {
                        upstream: repository,
                        fork: `${currentUser.login}/${repo}`,
                    });
                } else {
                    errors.push(`Repository "${currentUser.login}/${repo}" is a fork, but not of "${repository}"`);
                }
            } else {
                errors.push(`Repository "${currentUser.login}/${repo}" exists but is not a fork of "${repository}"`);
            }
        } catch (error) {
            if ((error as any).status === 404) {
                errors.push(
                    `Missing fork: "${repository}" must be forked to "${currentUser.login}/${repo}"\n` +
                        `  Create fork at: https://github.com/${repository}/fork`,
                );
            } else {
                errors.push(`Failed to check fork for "${repository}": ${(error as Error).message}`);
            }
        }
    }

    if (errors.length > 0) {
        throw new Error(
            `Repository fork validation failed:\n\n${errors.map((e) => `  • ${e}`).join('\n')}\n\n` +
                `All monitored repositories must be either:\n` +
                `  1. Owned by ${currentUser.login}, OR\n` +
                `  2. Forked to ${currentUser.login}'s account\n`,
        );
    }

    logger.info('Repository fork validation passed', {
        repositories: repositories.length,
    });
}
