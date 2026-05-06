package io.apicurio.axiom.engine.opencode;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Java HTTP client for the OpenCode server API. Wraps the REST endpoints
 * exposed by {@code opencode serve} to provide session management,
 * prompt execution, and server health checking.
 *
 * @see <a href="https://opencode.ai/docs/server/">OpenCode Server Docs</a>
 */
public class OpenCodeClient {

    private static final Logger LOG = Logger.getLogger(OpenCodeClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String baseUrl;
    private final HttpClient httpClient;

    public OpenCodeClient(String hostname, int port) {
        this.baseUrl = "http://" + hostname + ":" + port;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /**
     * Checks server health.
     *
     * @return true if the server is healthy
     */
    public boolean isHealthy() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/global/health"))
                    .GET()
                    .timeout(Duration.ofSeconds(5))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode body = MAPPER.readTree(response.body());
                return body.path("healthy").asBoolean(false);
            }
            return false;
        } catch (Exception e) {
            LOG.tracef("Health check failed: %s", e.getMessage());
            return false;
        }
    }

    /**
     * Creates a new session.
     *
     * @param title optional session title
     * @return the session ID
     */
    public String createSession(String title) throws IOException, InterruptedException {
        ObjectNode body = MAPPER.createObjectNode();
        if (title != null) {
            body.put("title", title);
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/session"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .timeout(Duration.ofSeconds(10))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200 && response.statusCode() != 201) {
            throw new IOException("Failed to create session: HTTP " + response.statusCode()
                    + " — " + response.body());
        }

        JsonNode result = MAPPER.readTree(response.body());
        return result.path("id").asText();
    }

    /**
     * Sends a prompt to a session and waits for the response.
     *
     * @param sessionId the session ID
     * @param prompt    the prompt text
     * @param model     the model in provider/model format, or null for default
     * @param format    structured output format, or null for text
     * @param timeoutSeconds request timeout
     * @return the response JSON
     */
    public JsonNode sendPrompt(String sessionId, String prompt, String model,
                                JsonNode format, int timeoutSeconds)
            throws IOException, InterruptedException {

        ObjectNode body = MAPPER.createObjectNode();

        // Parts array
        ArrayNode parts = body.putArray("parts");
        ObjectNode textPart = parts.addObject();
        textPart.put("type", "text");
        textPart.put("text", prompt);

        // Model
        if (model != null && model.contains("/")) {
            ObjectNode modelNode = body.putObject("model");
            String[] split = model.split("/", 2);
            modelNode.put("providerID", split[0]);
            modelNode.put("modelID", split[1]);
        }

        // Structured output format
        if (format != null) {
            body.set("format", format);
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/session/" + sessionId + "/message"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("Prompt failed: HTTP " + response.statusCode()
                    + " — " + truncate(response.body(), 500));
        }

        return MAPPER.readTree(response.body());
    }

    /**
     * Aborts a running session.
     *
     * @param sessionId the session ID to abort
     */
    public void abortSession(String sessionId) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/session/" + sessionId + "/abort"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .timeout(Duration.ofSeconds(10))
                    .build();
            httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            LOG.warnf("Failed to abort session %s: %s", sessionId, e.getMessage());
        }
    }

    /**
     * Adds an MCP server dynamically.
     *
     * @param name   the MCP server name
     * @param config the MCP server configuration
     */
    public void addMcpServer(String name, Map<String, Object> config)
            throws IOException, InterruptedException {
        ObjectNode body = MAPPER.createObjectNode();
        body.put("name", name);
        body.set("config", MAPPER.valueToTree(config));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/mcp"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200 && response.statusCode() != 201) {
            LOG.warnf("Failed to add MCP server '%s': HTTP %d", name, response.statusCode());
        }
    }

    /**
     * Gets the server version string.
     */
    public String getVersion() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/global/health"))
                    .GET()
                    .timeout(Duration.ofSeconds(5))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode body = MAPPER.readTree(response.body());
                return body.path("version").asText("unknown");
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max - 3) + "...";
    }
}
