package io.apicurio.axiom.events.github;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.apicurio.axiom.core.entities.RepositoryEntity;
import io.apicurio.axiom.events.core.EventService;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

/**
 * Receives GitHub webhook payloads, validates them, normalizes the events,
 * and enqueues them for processing.
 */
@Path("/api/v1/webhooks/github")
@ApplicationScoped
@RunOnVirtualThread
public class GitHubWebhookResource {

    private static final Logger LOG = Logger.getLogger(GitHubWebhookResource.class);

    @Inject
    EventService eventService;

    @Inject
    ObjectMapper objectMapper;

    /**
     * Receives a GitHub webhook payload.
     *
     * @param githubEvent the X-GitHub-Event header
     * @param signature the X-Hub-Signature-256 header for HMAC validation
     * @param body the raw webhook payload
     * @return 200 on success, 401 on invalid signature, 204 for ignored events
     */
    @POST
    @Consumes("application/json")
    public Response handleWebhook(
            @HeaderParam("X-GitHub-Event") String githubEvent,
            @HeaderParam("X-Hub-Signature-256") String signature,
            String body) {

        LOG.infof("Received GitHub webhook: event=%s", githubEvent);

        if (githubEvent == null) {
            return Response.status(400).entity("Missing X-GitHub-Event header").build();
        }

        // Parse the payload
        JsonNode payload;
        try {
            payload = objectMapper.readTree(body);
        } catch (Exception e) {
            LOG.warnf("Failed to parse GitHub webhook payload: %s", e.getMessage());
            return Response.status(400).entity("Invalid JSON payload").build();
        }

        // Look up the repository and validate the signature
        String repoFullName = GitHubEventNormalizer.extractRepository(payload);
        if (repoFullName != null) {
            String[] parts = repoFullName.split("/", 2);
            RepositoryEntity repo = null;
            if (parts.length == 2) {
                repo = RepositoryEntity.find("owner = ?1 and name = ?2", parts[0], parts[1]).firstResult();
            }

            if (repo != null && repo.webhookSecret != null && !repo.webhookSecret.isEmpty()) {
                if (!GitHubWebhookSignature.isValid(body, signature, repo.webhookSecret)) {
                    LOG.warnf("Invalid webhook signature for repository %s", repoFullName);
                    return Response.status(401).entity("Invalid signature").build();
                }
            }
        }

        // Normalize the event type
        String eventType = GitHubEventNormalizer.normalizeEventType(githubEvent, payload);
        if (eventType == null) {
            LOG.debugf("Ignoring unsupported GitHub event: %s (action: %s)",
                    githubEvent, payload.path("action").asText("none"));
            return Response.noContent().build();
        }

        // Extract issue reference
        String issueRef = GitHubEventNormalizer.extractIssueRef(payload);

        // Ingest the event
        eventService.ingestEvent("github", eventType, issueRef, repoFullName, body);

        return Response.ok().build();
    }
}
