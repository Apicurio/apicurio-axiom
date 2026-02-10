/**
 * Assign Milestone Action
 *
 * Assigns the next release milestone to a closed issue.
 * Only considers valid semantic version milestones (e.g., "1.7.3", "3.8.1").
 */

import { Octokit } from '@octokit/rest';

/**
 * Parses a semver version string
 *
 * @param {string} version Version string to parse
 * @returns {Object|null} Parsed version object or null if invalid
 */
function parseSemver(version) {
    // Strip leading 'v' if present
    const cleanVersion = version.startsWith('v') ? version.slice(1) : version;

    // Match semantic versioning pattern: major.minor.patch
    const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);

    if (!match) {
        return null;
    }

    return {
        original: version,
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
    };
}

/**
 * Compares two semver version objects
 *
 * @param {Object} a First version
 * @param {Object} b Second version
 * @returns {number} Negative if a < b, positive if a > b, 0 if equal
 */
function compareSemver(a, b) {
    if (a.major !== b.major) {
        return a.major - b.major;
    }
    if (a.minor !== b.minor) {
        return a.minor - b.minor;
    }
    return a.patch - b.patch;
}

/**
 * Executes the assign-milestone action
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

    logger.info(`Fetching milestones for ${owner}/${repo}...`);

    // Fetch all open milestones from the repository
    const { data: milestones } = await octokit.rest.issues.listMilestones({
        owner,
        repo,
        state: 'open',
        per_page: 100,
    });

    logger.info(`Found ${milestones.length} open milestones`);

    // Filter to only valid semver milestones
    const semverMilestones = milestones
        .map((milestone) => ({
            ...milestone,
            semver: parseSemver(milestone.title),
        }))
        .filter((milestone) => milestone.semver !== null);

    logger.info(`Found ${semverMilestones.length} valid semver milestones`);

    if (semverMilestones.length === 0) {
        logger.info('No valid semver milestones found - skipping milestone assignment');
        return;
    }

    // Sort by semver (ascending - earliest release first)
    semverMilestones.sort((a, b) => compareSemver(a.semver, b.semver));

    // Take the first one (next release)
    const nextMilestone = semverMilestones[0];

    logger.info(`Next release milestone: ${nextMilestone.title}`);

    // Assign milestone to the issue
    logger.info(`Assigning milestone "${nextMilestone.title}" to issue #${issueNumber}...`);

    await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        milestone: nextMilestone.number,
    });

    logger.info(`Successfully assigned milestone "${nextMilestone.title}" to issue #${issueNumber}`);
}
