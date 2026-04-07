package io.apicurio.axiom.events.github;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.apicurio.axiom.core.entities.RepositoryEntity;
import io.apicurio.axiom.events.core.EventService;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * Polls the GitHub API for new issue and comment events on monitored repositories.
 *
 * <p>This provides an alternative to webhooks for environments where inbound
 * connectivity is not available (e.g. local development behind a firewall).</p>
 *
 * <p>For each repository with {@code pollingEnabled = true}, the poller:</p>
 * <ol>
 *   <li>Fetches issues updated since the last poll</li>
 *   <li>Fetches comments created since the last poll</li>
 *   <li>Determines the event type for each and ingests new events</li>
 *   <li>Updates the repository's {@code lastPolledAt} timestamp</li>
 * </ol>
 */
@ApplicationScoped
public class GitHubPoller {

    private static final Logger LOG = Logger.getLogger(GitHubPoller.class);

    @Inject
    GitHubApiClient apiClient;

    @Inject
    EventService eventService;

    @Inject
    ObjectMapper objectMapper;

    @ConfigProperty(name = "axiom.github.token")
    Optional<String> githubToken;

    /**
     * Polls all GitHub repositories that have polling enabled.
     * Runs every 60 seconds by default.
     */
    @Scheduled(every = "${axiom.github.poll-interval:60s}",
               concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void poll() {
        List<RepositoryEntity> repos = RepositoryEntity
                .list("source = ?1 and pollingEnabled = ?2", "github", true);

        if (repos.isEmpty()) {
            return;
        }

        LOG.debugf("Polling %d GitHub repository(ies)", repos.size());
        for (RepositoryEntity repo : repos) {
            pollRepository(repo);
        }
    }

    private void pollRepository(RepositoryEntity repo) {
        String token = githubToken.orElse(null);
        Instant since = repo.lastPolledAt;
        Instant pollStartedAt = Instant.now();

        LOG.infof("Polling GitHub repository %s/%s (since: %s)",
                repo.owner, repo.name, since != null ? since : "first poll");

        int eventsIngested = 0;

        // Poll for updated issues
        eventsIngested += pollIssues(repo, since, token);

        // Poll for new comments
        eventsIngested += pollComments(repo, since, token);

        // Update the last polled timestamp
        updateLastPolledAt(repo.id, pollStartedAt);

        if (eventsIngested > 0) {
            LOG.infof("Ingested %d event(s) from %s/%s", eventsIngested, repo.owner, repo.name);
        }
    }

    private int pollIssues(RepositoryEntity repo, Instant since, String token) {
        Optional<JsonNode> result = apiClient.fetchIssuesUpdatedSince(
                repo.owner, repo.name, since, token);

        if (result.isEmpty() || !result.get().isArray()) {
            return 0;
        }

        int count = 0;
        String repoFullName = repo.owner + "/" + repo.name;

        for (JsonNode issue : result.get()) {
            // Skip pull requests (GitHub includes PRs in the issues endpoint)
            if (issue.has("pull_request")) {
                continue;
            }

            String eventType = determineIssueEventType(issue, since);
            if (eventType == null) {
                continue;
            }

            int number = issue.path("number").asInt(0);
            String issueRef = repoFullName + "#" + number;

            try {
                String payload = objectMapper.writeValueAsString(wrapIssueAsWebhookPayload(
                        issue, repoFullName, eventType));
                eventService.ingestEvent("github", eventType, issueRef, repoFullName, payload);
                count++;
            } catch (Exception e) {
                LOG.warnf(e, "Failed to ingest issue event for %s", issueRef);
            }
        }
        return count;
    }

    private int pollComments(RepositoryEntity repo, Instant since, String token) {
        Optional<JsonNode> result = apiClient.fetchCommentsUpdatedSince(
                repo.owner, repo.name, since, token);

        if (result.isEmpty() || !result.get().isArray()) {
            return 0;
        }

        int count = 0;
        String repoFullName = repo.owner + "/" + repo.name;

        for (JsonNode comment : result.get()) {
            // Extract issue number from the issue_url field
            String issueUrl = comment.path("issue_url").asText("");
            int issueNumber = extractIssueNumberFromUrl(issueUrl);
            if (issueNumber == 0) {
                continue;
            }

            // Only process comments created after our last poll (not edited ones)
            Instant createdAt = parseGitHubTimestamp(comment.path("created_at").asText(null));
            if (since != null && createdAt != null && !createdAt.isAfter(since)) {
                continue;
            }

            String issueRef = repoFullName + "#" + issueNumber;

            try {
                String payload = objectMapper.writeValueAsString(wrapCommentAsWebhookPayload(
                        comment, repoFullName, issueNumber));
                eventService.ingestEvent("github", "comment-added", issueRef, repoFullName, payload);
                count++;
            } catch (Exception e) {
                LOG.warnf(e, "Failed to ingest comment event for %s", issueRef);
            }
        }
        return count;
    }

    /**
     * Determines the event type for an issue based on its state and timing.
     */
    private String determineIssueEventType(JsonNode issue, Instant since) {
        String state = issue.path("state").asText("");
        Instant createdAt = parseGitHubTimestamp(issue.path("created_at").asText(null));
        Instant updatedAt = parseGitHubTimestamp(issue.path("updated_at").asText(null));
        Instant closedAt = parseGitHubTimestamp(issue.path("closed_at").asText(null));

        // If this is the first poll, only treat newly created issues as events
        if (since == null) {
            return null;
        }

        // Issue was created after our last poll
        if (createdAt != null && createdAt.isAfter(since)) {
            return "issue-created";
        }

        // Issue was closed after our last poll
        if ("closed".equals(state) && closedAt != null && closedAt.isAfter(since)) {
            return "issue-closed";
        }

        // Issue was updated (but not created or closed) after our last poll
        if (updatedAt != null && updatedAt.isAfter(since)) {
            // Could be a reopen, edit, label change, etc.
            // We can't distinguish reopened from other updates via the issues API alone,
            // so we emit issue-updated as a catch-all
            if ("open".equals(state) && closedAt != null) {
                // Was previously closed and is now open — likely reopened
                return "issue-reopened";
            }
            return "issue-updated";
        }

        return null;
    }

    /**
     * Wraps a GitHub Issues API response into a structure resembling a webhook payload,
     * so the downstream processing is consistent regardless of event source.
     */
    private JsonNode wrapIssueAsWebhookPayload(JsonNode issue, String repoFullName, String eventType) {
        String action = switch (eventType) {
            case "issue-created" -> "opened";
            case "issue-closed" -> "closed";
            case "issue-reopened" -> "reopened";
            default -> "edited";
        };
        var node = objectMapper.createObjectNode();
        node.put("action", action);
        node.put("polled", true);
        node.set("issue", issue);
        return node;
    }

    /**
     * Wraps a GitHub Comments API response into a structure resembling a webhook payload.
     */
    private JsonNode wrapCommentAsWebhookPayload(JsonNode comment, String repoFullName, int issueNumber) {
        var node = objectMapper.createObjectNode();
        node.put("action", "created");
        node.put("polled", true);
        node.putObject("issue").put("number", issueNumber);
        node.set("comment", comment);
        return node;
    }

    private Instant parseGitHubTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isEmpty()) {
            return null;
        }
        try {
            return DateTimeFormatter.ISO_DATE_TIME.parse(timestamp, Instant::from);
        } catch (Exception e) {
            return null;
        }
    }

    private int extractIssueNumberFromUrl(String issueUrl) {
        if (issueUrl == null || issueUrl.isEmpty()) {
            return 0;
        }
        // Format: https://api.github.com/repos/owner/repo/issues/123
        int lastSlash = issueUrl.lastIndexOf('/');
        if (lastSlash < 0) {
            return 0;
        }
        try {
            return Integer.parseInt(issueUrl.substring(lastSlash + 1));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    @Transactional
    void updateLastPolledAt(Long repoId, Instant polledAt) {
        RepositoryEntity repo = RepositoryEntity.findById(repoId);
        if (repo != null) {
            repo.lastPolledAt = polledAt;
        }
    }
}
