/**
 * GitHub Client
 *
 * Utility functions for GitHub API interactions
 */

import { Octokit } from '@octokit/rest';
import type { CurrentGitHubUser } from '../types/github-user.js';

/**
 * Gets the authenticated GitHub user information
 *
 * @param token GitHub personal access token
 * @returns Current GitHub user information
 */
export async function getAuthenticatedUser(token: string): Promise<CurrentGitHubUser> {
    const octokit = new Octokit({ auth: token });

    const response = await octokit.users.getAuthenticated();

    return {
        login: response.data.login,
        id: response.data.id,
        type: response.data.type,
        name: response.data.name,
        email: response.data.email,
        company: response.data.company,
        avatar_url: response.data.avatar_url,
        html_url: response.data.html_url,
    };
}
