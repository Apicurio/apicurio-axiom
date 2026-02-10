/**
 * Auto-Close Dependabot Pull Request Action
 *
 * Automatically closes pull requests opened by dependabot.
 */

import { Octokit } from '@octokit/rest';

/**
 * Executes the autoclose-dependabot-pr action
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

    const prNumber = event.pullRequest?.number;

    if (!prNumber) {
        throw new Error('No pull request number found in event');
    }

    logger.info(`Auto-closing dependabot PR #${prNumber} in ${owner}/${repo}...`);

    // Add a comment explaining why the PR is being closed
    const commentBody = `🤖 This pull request was automatically closed because it was opened by dependabot.

Dependabot pull requests are not accepted in this repository.

_This action was performed automatically by apicurio-axiom_`;

    await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody,
    });

    logger.info(`Added closure comment to PR #${prNumber}`);

    // Close the pull request
    await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        state: 'closed',
    });

    logger.info(`Successfully closed PR #${prNumber}`);
}
