/**
 * Current GitHub User Information
 *
 * Detailed information about the authenticated GitHub user (bot identity)
 */

export interface CurrentGitHubUser {
    login: string;
    id: number;
    type: string;
    name: string | null;
    email: string | null;
    company: string | null;
    avatar_url: string;
    html_url: string;
}
