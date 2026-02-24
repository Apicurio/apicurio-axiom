/**
 * Example JavaScript Action: Welcome Contributor
 *
 * This action welcomes new contributors when they open a pull request.
 */

export default async function welcomeContributor(event, context) {
    const { logger } = context;

    logger.info('=== Welcome Contributor Action ===');
    logger.info(`PR: ${event.pullRequest.title}`);
    logger.info(`Author: ${event.pullRequest.author}`);
    logger.info(`Repository: ${event.repository}`);
    logger.info(`URL: ${event.pullRequest.url}`);
    logger.info('');
    logger.info('TODO: Add logic to post a welcoming comment using GitHub API');
    logger.info('      You could use Octokit here to create a comment on the PR');
    logger.info('===================================');
}
