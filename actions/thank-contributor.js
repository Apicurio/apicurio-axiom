/**
 * Example JavaScript Action: Thank Contributor
 *
 * This action thanks contributors when an issue they reported is closed.
 */

export default async function thankContributor(event, logger) {
    logger.info('=== Thank Contributor Action ===');
    logger.info(`Issue: ${event.issue.title}`);
    logger.info(`Author: ${event.issue.author}`);
    logger.info(`Repository: ${event.repository}`);
    logger.info(`URL: ${event.issue.url}`);
    logger.info('');
    logger.info('TODO: Add logic to post a thank-you comment using GitHub API');
    logger.info('      You could use Octokit here to create a comment on the issue');
    logger.info('==================================');
}
