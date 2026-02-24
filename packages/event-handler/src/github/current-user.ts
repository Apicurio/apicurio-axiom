/**
 * Current GitHub User
 *
 * Singleton service for accessing the authenticated GitHub user information
 */

import type { CurrentGitHubUser } from '../types/github-user.js';

let currentUser: CurrentGitHubUser | null = null;

/**
 * Sets the current GitHub user
 *
 * @param user Current GitHub user information
 */
export function setCurrentUser(user: CurrentGitHubUser): void {
    currentUser = user;
}

/**
 * Gets the current GitHub user
 *
 * @returns Current GitHub user information or null if not set
 */
export function getCurrentUser(): CurrentGitHubUser | null {
    return currentUser;
}

/**
 * Checks if a current user is set
 *
 * @returns True if current user is set
 */
export function hasCurrentUser(): boolean {
    return currentUser !== null;
}
