package io.apicurio.axiom.app;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Tests for the System REST API endpoints.
 */
@QuarkusTest
class SystemResourceTest {

    @Test
    void testGetSystemHealth() {
        given()
            .when()
                .get("/api/v1/system/health")
            .then()
                .statusCode(200)
                .contentType("application/json")
                .body("status", equalTo("UP"))
                .body("version", notNullValue())
                .body("timestamp", notNullValue());
    }

    @Test
    void testGetSystemConfig() {
        given()
            .when()
                .get("/api/v1/system/config")
            .then()
                .statusCode(200)
                .contentType("application/json")
                .body("version", notNullValue())
                .body("features", notNullValue());
    }

    @Test
    void testHealthStatusIsUp() {
        given()
            .when()
                .get("/api/v1/system/health")
            .then()
                .statusCode(200)
                .body("status", equalTo("UP"));
    }

    @Test
    void testConfigVersionMatchesHealthVersion() {
        String healthVersion = given()
            .when()
                .get("/api/v1/system/health")
            .then()
                .statusCode(200)
                .extract()
                .path("version");

        given()
            .when()
                .get("/api/v1/system/config")
            .then()
                .statusCode(200)
                .body("version", equalTo(healthVersion));
    }
}
