package io.apicurio.axiom.events.github;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Validates GitHub webhook HMAC-SHA256 signatures.
 */
public final class GitHubWebhookSignature {

    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final String SIGNATURE_PREFIX = "sha256=";

    private GitHubWebhookSignature() {
    }

    /**
     * Validates that the given signature header matches the HMAC-SHA256 of the payload.
     *
     * @param payload the raw webhook payload body
     * @param signatureHeader the X-Hub-Signature-256 header value (e.g. "sha256=abc123...")
     * @param secret the webhook secret configured for the repository
     * @return true if the signature is valid
     */
    public static boolean isValid(String payload, String signatureHeader, String secret) {
        if (signatureHeader == null || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
            return false;
        }
        if (secret == null || secret.isEmpty()) {
            return false;
        }

        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expectedSignature = SIGNATURE_PREFIX + HexFormat.of().formatHex(hash);

            return MessageDigest.isEqual(
                    expectedSignature.getBytes(StandardCharsets.UTF_8),
                    signatureHeader.getBytes(StandardCharsets.UTF_8)
            );
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            return false;
        }
    }
}
