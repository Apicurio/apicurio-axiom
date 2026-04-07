package io.apicurio.axiom.app;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Integration tests for the GitHub webhook endpoint.
 */
@QuarkusTest
class GitHubWebhookTest {

    private static final String WEBHOOK_PATH = "/api/v1/webhooks/github";
    private static final String REPOS_PATH = "/api/v1/repositories";
    private static final String EVENTS_PATH = "/api/v1/events";
    private static final String WEBHOOK_SECRET = "test-secret-12345";

    @BeforeEach
    void setUp() {
        // Create a monitored repository with a webhook secret
        // (may already exist from a previous test, that's fine)
        given()
            .contentType(ContentType.JSON)
            .body(String.format("""
                {
                    "name": "apicurio-axiom",
                    "owner": "Apicurio",
                    "source": "github",
                    "url": "https://github.com/Apicurio/apicurio-axiom",
                    "webhookSecret": "%s"
                }
                """, WEBHOOK_SECRET))
            .when()
                .post(REPOS_PATH);
    }

    // ── Successful event ingestion ────────────────────────────────────

    @Test
    void testIssueOpenedEvent() {
        String payload = issuePayload("opened", 42, "New feature request");

        given()
            .contentType(ContentType.JSON)
            .header("X-GitHub-Event", "issues")
            .header("X-Hub-Signature-256", sign(payload))
            .body(payload)
            .when()
                .post(WEBHOOK_PATH)
            .then()
                .statusCode(200);

        // Verify event was created
        given()
            .when()
                .get(EVENTS_PATH)
            .then()
                .statusCode(200)
                .body("find { it.eventType == 'issue-created' && it.issueRef == 'Apicurio/apicurio-axiom#42' }", notNullValue());
    }

    @Test
    void testIssueClosedEvent() {
        String payload = issuePayload("closed", 43, "Fixed bug");

        given()
            .contentType(ContentType.JSON)
            .header("X-GitHub-Event", "issues")
            .header("X-Hub-Signature-256", sign(payload))
            .body(payload)
            .when()
                .post(WEBHOOK_PATH)
            .then()
                .statusCode(200);

        given()
            .when()
                .get(EVENTS_PATH)
            .then()
                .statusCode(200)
                .body("find { it.eventType == 'issue-closed' && it.issueRef == 'Apicurio/apicurio-axiom#43' }", notNullValue());
    }

    @Test
    void testIssueReopenedEvent() {
        String payload = issuePayload("reopened", 44, "Reopen this");

        given()
            .contentType(ContentType.JSON)
            .header("X-GitHub-Event", "issues")
            .header("X-Hub-Signature-256", sign(payload))
            .body(payload)
            .when()
                .post(WEBHOOK_PATH)
            .then()
                .statusCode(200);

        given()
            .when()
                .get(EVENTS_PATH)
            .then()
                .statusCode(200)
                .body("find { it.eventType == 'issue-reopened' }", notNullValue());
    }

    @Test
    void testIssueCommentEvent() {
        String payload = commentPayload(45, "What about this approach?");

        given()
            .contentType(ContentType.JSON)
            .header("X-GitHub-Event", "issue_comment")
            .header("X-Hub-Signature-256", sign(payload))
            .body(payload)
            .when()
                .post(WEBHOOK_PATH)
            .then()
                .statusCode(200);

        given()
            .when()
                .get(EVENTS_PATH)
            .then()
                .statusCode(200)
                .body("find { it.eventType == 'comment-added' && it.issueRef == 'Apicurio/apicurio-axiom#45' }", notNullValue());
    }

    @Test
    void testIssueLabeledNormalizesToUpdated() {
        String payload = issuePayload("labeled", 46, "Labeled issue");

        given()
            .contentType(ContentType.JSON)
            .header("X-GitHub-Event", "issues")
            .header("X-Hub-Signature-256", sign(payload))
            .body(payload)
            .when()
                .post(WEBHOOK_PATH)
            .then()
                .statusCode(200);

        given()
            .when()
                .get(EVENTS_PATH)
            .then()
                .statusCode(200)
                .body("find { it.eventType == 'issue-updated' && it.issueRef == 'Apicurio/apicurio-axiom#46' }", notNullValue());
    }

    // ── Ignored events ────────────────────────────────────────────────

    @Test
    void testUnsupportedEventTypeReturns204() {
        given()
            .contentType(ContentType.JSON)
            .header("X-GitHub-Event", "push")
            .body("{}")
            .when()
                .post(WEBHOOK_PATH)
            .then()
                .statusCode(204);
    }

    @Test
    void testMissingEventHeaderReturns400() {
        given()
            .contentType(ContentType.JSON)
            .body("{}")
            .when()
                .post(WEBHOOK_PATH)
            .then()
                .statusCode(400);
    }

    // ── Signature validation ──────────────────────────────────────────

    @Test
    void testInvalidSignatureReturns401() {
        String payload = issuePayload("opened", 99, "Tampered");

        given()
            .contentType(ContentType.JSON)
            .header("X-GitHub-Event", "issues")
            .header("X-Hub-Signature-256", "sha256=invalid_signature_here")
            .body(payload)
            .when()
                .post(WEBHOOK_PATH)
            .then()
                .statusCode(401);
    }

    @Test
    void testNoSignatureWithSecretConfiguredReturns401() {
        String payload = issuePayload("opened", 98, "No sig");

        given()
            .contentType(ContentType.JSON)
            .header("X-GitHub-Event", "issues")
            // No X-Hub-Signature-256 header
            .body(payload)
            .when()
                .post(WEBHOOK_PATH)
            .then()
                .statusCode(401);
    }

    // ── Webhook without secret (no validation) ────────────────────────

    @Test
    void testWebhookFromUnknownRepoAccepted() {
        // Event from a repo not in our monitored list — no signature validation
        String payload = """
            {
                "action": "opened",
                "issue": {
                    "number": 1,
                    "title": "Test"
                },
                "repository": {
                    "full_name": "unknown/repo"
                }
            }
            """;

        given()
            .contentType(ContentType.JSON)
            .header("X-GitHub-Event", "issues")
            .body(payload)
            .when()
                .post(WEBHOOK_PATH)
            .then()
                .statusCode(200);
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private String issuePayload(String action, int number, String title) {
        return String.format("""
            {
                "action": "%s",
                "issue": {
                    "number": %d,
                    "title": "%s",
                    "user": { "login": "testuser" },
                    "labels": [],
                    "state": "%s"
                },
                "repository": {
                    "full_name": "Apicurio/apicurio-axiom"
                },
                "sender": { "login": "testuser" }
            }
            """, action, number, title, action.equals("closed") ? "closed" : "open");
    }

    private String commentPayload(int issueNumber, String commentBody) {
        return String.format("""
            {
                "action": "created",
                "issue": {
                    "number": %d,
                    "title": "Test issue",
                    "user": { "login": "testuser" }
                },
                "comment": {
                    "body": "%s",
                    "user": { "login": "commenter" }
                },
                "repository": {
                    "full_name": "Apicurio/apicurio-axiom"
                },
                "sender": { "login": "commenter" }
            }
            """, issueNumber, commentBody);
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(WEBHOOK_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return "sha256=" + HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
