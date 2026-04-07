package io.apicurio.axiom.events.github;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * Simple client for the GitHub REST API. Uses Java's built-in HttpClient.
 */
@ApplicationScoped
public class GitHubApiClient {

    private static final Logger LOG = Logger.getLogger(GitHubApiClient.class);
    private static final String GITHUB_API_BASE = "https://api.github.com";

    @Inject
    ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    /**
     * Fetches issues updated since the given timestamp.
     *
     * @param owner the repository owner
     * @param repo the repository name
     * @param since only return issues updated after this time (may be null for first poll)
     * @param token GitHub API token (may be null for public repos)
     * @return the JSON array of issues, or empty if the request fails
     */
    public Optional<JsonNode> fetchIssuesUpdatedSince(String owner, String repo,
                                                       Instant since, String token) {
        String url = GITHUB_API_BASE + "/repos/" + owner + "/" + repo
                + "/issues?state=all&sort=updated&direction=asc&per_page=100";
        if (since != null) {
            url += "&since=" + DateTimeFormatter.ISO_INSTANT.format(since);
        }
        return doGet(url, token);
    }

    /**
     * Fetches issue comments created since the given timestamp.
     *
     * @param owner the repository owner
     * @param repo the repository name
     * @param since only return comments created after this time (may be null for first poll)
     * @param token GitHub API token (may be null for public repos)
     * @return the JSON array of comments, or empty if the request fails
     */
    public Optional<JsonNode> fetchCommentsUpdatedSince(String owner, String repo,
                                                         Instant since, String token) {
        String url = GITHUB_API_BASE + "/repos/" + owner + "/" + repo
                + "/issues/comments?sort=updated&direction=asc&per_page=100";
        if (since != null) {
            url += "&since=" + DateTimeFormatter.ISO_INSTANT.format(since);
        }
        return doGet(url, token);
    }

    private Optional<JsonNode> doGet(String url, String token) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", "2022-11-28")
                    .GET();

            if (token != null && !token.isEmpty()) {
                builder.header("Authorization", "Bearer " + token);
            }

            HttpResponse<String> response = httpClient.send(builder.build(),
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                return Optional.of(objectMapper.readTree(response.body()));
            } else {
                LOG.warnf("GitHub API returned %d for %s", response.statusCode(), url);
                return Optional.empty();
            }
        } catch (IOException | InterruptedException e) {
            LOG.errorf(e, "Failed to call GitHub API: %s", url);
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return Optional.empty();
        }
    }
}
