package io.apicurio.axiom.events.core;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Result of an API call to an external service.
 * Carries full request/response details for diagnostic logging.
 */
public record ApiResult(
        boolean success,
        JsonNode data,
        int statusCode,
        String errorMessage,
        String requestMethod,
        String requestUrl,
        String requestBody,
        String responseBody
) {

    /**
     * Creates a successful result.
     */
    public static ApiResult ok(JsonNode data, String method, String url,
                                String requestBody, String responseBody) {
        return new ApiResult(true, data, 200, null, method, url, requestBody,
                truncate(responseBody, 5000));
    }

    /**
     * Creates an error result from an HTTP status code.
     */
    public static ApiResult httpError(int statusCode, String method, String url,
                                       String requestBody, String responseBody) {
        String message = "HTTP " + statusCode;
        if (responseBody != null && !responseBody.isBlank()) {
            message += ": " + responseBody.substring(0, Math.min(responseBody.length(), 500));
        }
        return new ApiResult(false, null, statusCode, message, method, url,
                requestBody, truncate(responseBody, 5000));
    }

    /**
     * Creates an error result from an exception.
     */
    public static ApiResult exception(Exception e, String method, String url,
                                       String requestBody) {
        return new ApiResult(false, null, 0,
                e.getClass().getSimpleName() + ": " + e.getMessage(),
                method, url, requestBody, null);
    }

    /**
     * Formats the full request/response as a detailed log block.
     */
    public String formatDetail() {
        StringBuilder sb = new StringBuilder();
        sb.append("Request: ").append(requestMethod).append(" ").append(requestUrl).append("\n");
        if (requestBody != null && !requestBody.isBlank()) {
            sb.append("Request body:\n").append(requestBody).append("\n");
        }
        sb.append("\nResponse: HTTP ").append(statusCode).append("\n");
        if (responseBody != null && !responseBody.isBlank()) {
            sb.append("Response body:\n").append(responseBody).append("\n");
        }
        if (errorMessage != null) {
            sb.append("Error: ").append(errorMessage).append("\n");
        }
        return sb.toString();
    }

    private static String truncate(String s, int maxLen) {
        if (s == null) return null;
        return s.length() > maxLen ? s.substring(0, maxLen) + "\n... (truncated)" : s;
    }
}
