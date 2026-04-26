package io.apicurio.axiom.app;

import io.apicurio.axiom.core.entities.ActivityLogEntity;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Tests for the Activity Log REST API endpoint, including pagination and filtering.
 */
@QuarkusTest
class ActivityResourceTest {

    private static final String ACTIVITY_PATH = "/api/v1/activity";

    @BeforeEach
    @Transactional
    void seedActivityEntries() {
        // Only seed once — check if our test entries already exist
        if (ActivityLogEntity.count("summary like 'FILTER-TEST%'") > 0) {
            return;
        }

        createEntry(1L, 10L, 100L, "task-completed", "FILTER-TEST task alpha completed");
        createEntry(1L, 11L, 100L, "task-failed", "FILTER-TEST task beta failed");
        createEntry(2L, 20L, 200L, "task-completed", "FILTER-TEST task gamma completed");
        createEntry(null, null, 300L, "event-ignored", "FILTER-TEST event ignored");
        createEntry(3L, 30L, null, "project-created", "FILTER-TEST project created");
    }

    private void createEntry(Long projectId, Long taskId, Long eventId,
                              String entryType, String summary) {
        ActivityLogEntity entry = new ActivityLogEntity();
        entry.projectId = projectId;
        entry.taskId = taskId;
        entry.eventId = eventId;
        entry.entryType = entryType;
        entry.summary = summary;
        entry.createdOn = Instant.now();
        entry.persist();
    }

    // ── Pagination ───────────────────────────────────────────────────

    @Test
    void testPaginationDefaults() {
        given()
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("page", equalTo(1))
                .body("limit", equalTo(20))
                .body("totalCount", greaterThanOrEqualTo(5))
                .body("items", is(notNullValue()));
    }

    @Test
    void testPaginationWithPageSize() {
        given()
            .queryParam("page", 1)
            .queryParam("limit", 2)
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .body("page", equalTo(1))
                .body("limit", equalTo(2))
                .body("items.size()", lessThanOrEqualTo(2))
                .body("totalCount", greaterThanOrEqualTo(5));
    }

    // ── Filter by entry type ─────────────────────────────────────────

    @Test
    void testFilterByEntryType() {
        given()
            .queryParam("filterEntryType", "task-completed")
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .body("items.size()", greaterThanOrEqualTo(2))
                .body("items.entryType", everyItem(equalTo("task-completed")));
    }

    @Test
    void testFilterByMultipleEntryTypes() {
        given()
            .queryParam("filterEntryType", "task-completed,task-failed")
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .body("items.size()", greaterThanOrEqualTo(3))
                .body("items.entryType", everyItem(
                        anyOf(equalTo("task-completed"), equalTo("task-failed"))));
    }

    // ── Filter by summary ────────────────────────────────────────────

    @Test
    void testFilterBySummary() {
        given()
            .queryParam("filterSummary", "FILTER-TEST task alpha")
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .body("items.size()", equalTo(1))
                .body("items[0].summary", containsString("alpha"));
    }

    @Test
    void testFilterBySummaryCaseInsensitive() {
        given()
            .queryParam("filterSummary", "filter-test")
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .body("items.size()", greaterThanOrEqualTo(5));
    }

    // ── Filter by project ID ─────────────────────────────────────────

    @Test
    void testFilterByProjectId() {
        given()
            .queryParam("filterProjectId", 1)
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .body("items.size()", greaterThanOrEqualTo(2))
                .body("items.projectId", everyItem(equalTo(1)));
    }

    // ── Filter by event ID ───────────────────────────────────────────

    @Test
    void testFilterByEventId() {
        given()
            .queryParam("filterEventId", 200)
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .body("items.size()", greaterThanOrEqualTo(1))
                .body("items.eventId", everyItem(equalTo(200)));
    }

    // ── Combined filters ─────────────────────────────────────────────

    @Test
    void testCombinedFilters() {
        given()
            .queryParam("filterEntryType", "task-completed")
            .queryParam("filterProjectId", 1)
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .body("items.size()", greaterThanOrEqualTo(1))
                .body("items.entryType", everyItem(equalTo("task-completed")))
                .body("items.projectId", everyItem(equalTo(1)));
    }

    @Test
    void testFilterNoResults() {
        given()
            .queryParam("filterSummary", "zzz_nonexistent_summary_zzz")
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .body("items.size()", equalTo(0))
                .body("totalCount", equalTo(0));
    }

    @Test
    void testFilterWithPagination() {
        given()
            .queryParam("filterSummary", "FILTER-TEST")
            .queryParam("page", 1)
            .queryParam("limit", 2)
            .when()
                .get(ACTIVITY_PATH)
            .then()
                .statusCode(200)
                .body("items.size()", equalTo(2))
                .body("totalCount", greaterThanOrEqualTo(5));
    }
}
