/**
 * Jira API Client
 *
 * Simple client for interacting with Jira REST API.
 */

import axios, { type AxiosInstance } from 'axios';
import type { JiraIssue } from '../types/jira.js';
import type { Logger } from '@axiom/common';

export class JiraClient {
    private client: AxiosInstance;
    private logger: Logger;

    /**
     * Creates a new JiraClient
     *
     * @param url Jira instance URL (e.g., https://issues.redhat.com)
     * @param username Jira username or email
     * @param apiToken Jira API token
     * @param logger Logger instance
     */
    constructor(url: string, username: string, apiToken: string, logger: Logger) {
        this.logger = logger;

        // Create axios instance with basic auth
        this.client = axios.create({
            baseURL: url,
            auth: {
                username,
                password: apiToken,
            },
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            timeout: 30000,
        });
    }

    /**
     * Search for recently updated issues in a project
     *
     * @param project Project key (e.g., "APICURIO")
     * @param maxResults Maximum number of results (default: 50)
     * @param updatedSince Only return issues updated since this timestamp
     * @returns Array of Jira issues
     */
    async searchRecentIssues(project: string, maxResults: number = 50, updatedSince?: Date): Promise<JiraIssue[]> {
        try {
            let jql = `project = ${project} ORDER BY updated DESC`;

            if (updatedSince) {
                const timestamp = updatedSince.toISOString().replace('T', ' ').substring(0, 19);
                jql = `project = ${project} AND updated >= "${timestamp}" ORDER BY updated DESC`;
            }

            const response = await this.client.get('/rest/api/3/search', {
                params: {
                    jql,
                    maxResults,
                    fields: 'summary,description,status,issuetype,priority,assignee,reporter,labels,created,updated',
                },
            });

            return response.data.issues || [];
        } catch (error) {
            this.logger.error('Failed to search Jira issues', error as Error, {
                project,
            });
            return [];
        }
    }

    /**
     * Get a specific issue by key
     *
     * @param issueKey Issue key (e.g., "APICURIO-123")
     * @returns Jira issue or null if not found
     */
    async getIssue(issueKey: string): Promise<JiraIssue | null> {
        try {
            const response = await this.client.get(`/rest/api/3/issue/${issueKey}`, {
                params: {
                    fields: 'summary,description,status,issuetype,priority,assignee,reporter,labels,created,updated',
                },
            });

            return response.data;
        } catch (error) {
            if ((error as any).response?.status === 404) {
                this.logger.warn('Issue not found', { issueKey });
                return null;
            }

            this.logger.error('Failed to get Jira issue', error as Error, {
                issueKey,
            });
            return null;
        }
    }

    /**
     * Get the changelog for an issue
     *
     * @param issueKey Issue key
     * @returns Changelog entries
     */
    async getIssueChangelog(issueKey: string): Promise<any[]> {
        try {
            const response = await this.client.get(`/rest/api/3/issue/${issueKey}/changelog`);
            return response.data.values || [];
        } catch (error) {
            this.logger.error('Failed to get issue changelog', error as Error, {
                issueKey,
            });
            return [];
        }
    }
}
