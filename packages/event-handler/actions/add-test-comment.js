/**
 * Add Test Comment Action
 *
 * Adds a simple "hello world" test comment to a GitHub issue.
 * This demonstrates basic GitHub API interaction.
 */

import { Octokit } from '@octokit/rest';

/**
 * Executes the add-test-comment action
 *
 * @param {Object} event Event object
 * @param {Object} context Action context containing logger, githubToken, etc.
 */
export default async function (event, context) {
    const { logger, githubToken, owner, repo } = context;

    if (!githubToken) {
        throw new Error('GitHub token is required');
    }

    const octokit = new Octokit({ auth: githubToken });

    const issueNumber = event.issue?.number;

    if (!issueNumber) {
        throw new Error('No issue number found in event');
    }

    logger.info(`Adding test comment to issue #${issueNumber} in ${owner}/${repo}...`);

    // Create the comment body
    const commentBody = `👋 Hello from the GitHub Bot!

This is an automated test comment to demonstrate bot functionality.

**Event Details:**
- Issue: #${issueNumber}
- Repository: ${owner}/${repo}
- Triggered by: ${event.actor}
- Event type: ${event.type}

🤖 _This comment was added automatically by apicurio-axiom_`;

    // Add the comment to the issue
    const { data: comment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: commentBody,
    });

    logger.info(`Successfully added comment to issue #${issueNumber}`);
    logger.info(`Comment URL: ${comment.html_url}`);
}
