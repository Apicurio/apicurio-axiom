package io.apicurio.axiom.app;

import io.apicurio.axiom.engine.spi.AiEngine;
import io.apicurio.axiom.engine.spi.AiEngineCheckResult;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Performs startup configuration checks to verify that the application
 * environment is properly configured. Results are exposed via the
 * system config endpoint for the UI to display.
 */
@ApplicationScoped
public class StartupCheckService {

    private static final Logger LOG = Logger.getLogger(StartupCheckService.class);

    @Inject
    AiEngine aiEngine;

    private final List<CheckResult> results = new ArrayList<>();

    /**
     * Runs all startup checks when the application starts.
     *
     * @param event the Quarkus startup event
     */
    void onStart(@Observes StartupEvent event) {
        LOG.info("Running startup configuration checks...");
        checkGitHubToken();
        checkNodeJs();
        checkAiEngine();

        long errors = results.stream().filter(r -> "error".equals(r.status())).count();
        long warnings = results.stream().filter(r -> "warning".equals(r.status())).count();
        if (errors > 0 || warnings > 0) {
            LOG.warnf("Startup checks: %d error(s), %d warning(s)", errors, warnings);
        } else {
            LOG.info("All startup checks passed");
        }
    }

    /**
     * Returns the results of all startup checks.
     *
     * @return the list of check results
     */
    public List<CheckResult> getResults() {
        return List.copyOf(results);
    }

    /**
     * Returns true if there are any errors in the startup checks.
     *
     * @return true if any check has status "error"
     */
    public boolean hasErrors() {
        return results.stream().anyMatch(r -> "error".equals(r.status()));
    }

    private void checkGitHubToken() {
        String token = System.getenv("AXIOM_GITHUB_TOKEN");
        if (token == null || token.isBlank()) {
            token = System.getenv("GH_TOKEN");
        }
        if (token == null || token.isBlank()) {
            token = System.getenv("GITHUB_TOKEN");
        }
        if (token == null || token.isBlank()) {
            results.add(new CheckResult(
                    "GitHub API Token",
                    "error",
                    "No GitHub token found. Set one of: AXIOM_GITHUB_TOKEN, GH_TOKEN, "
                            + "or GITHUB_TOKEN. This token is required for polling GitHub "
                            + "repositories and for AI agents to post comments on issues. "
                            + "Create a Personal Access Token at "
                            + "https://github.com/settings/tokens"
            ));
            LOG.warn("Startup check FAILED: No GitHub token found");
        } else {
            results.add(new CheckResult(
                    "GitHub API Token",
                    "ok",
                    "AXIOM_GITHUB_TOKEN is configured."
            ));
            LOG.info("Startup check OK: AXIOM_GITHUB_TOKEN is set");
        }
    }

    private void checkNodeJs() {
        try {
            ProcessBuilder pb = new ProcessBuilder("node", "--version");
            pb.redirectErrorStream(true);
            Process process = pb.start();

            boolean completed = process.waitFor(10, TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                results.add(new CheckResult(
                        "Node.js",
                        "error",
                        "Node.js check timed out. Ensure that the 'node' command is "
                                + "installed and on your PATH."
                ));
                LOG.warn("Startup check FAILED: Node.js check timed out");
                return;
            }

            String output = new String(process.getInputStream().readAllBytes()).trim();
            int exitCode = process.exitValue();

            if (exitCode == 0 && output.startsWith("v")) {
                results.add(new CheckResult(
                        "Node.js",
                        "ok",
                        "Node.js " + output + " is available."
                ));
                LOG.infof("Startup check OK: Node.js %s", output);
            } else {
                results.add(new CheckResult(
                        "Node.js",
                        "error",
                        "Node.js returned unexpected output (exit code " + exitCode + "). "
                                + "Ensure Node.js v18 or later is installed. "
                                + "Download from https://nodejs.org/"
                ));
                LOG.warnf("Startup check FAILED: Node.js exit code %d, output: %s",
                        exitCode, output);
            }
        } catch (Exception e) {
            results.add(new CheckResult(
                    "Node.js",
                    "error",
                    "Node.js is not installed or not on your PATH. Node.js is required "
                            + "to run the MCP tool server that provides custom tools to AI agents. "
                            + "Install Node.js v18 or later from https://nodejs.org/"
            ));
            LOG.warnf("Startup check FAILED: Node.js not found: %s", e.getMessage());
        }
    }

    private void checkAiEngine() {
        LOG.infof("Checking AI engine: %s", aiEngine.getType());
        List<AiEngineCheckResult> engineResults = aiEngine.healthCheck();
        for (AiEngineCheckResult engineResult : engineResults) {
            results.add(new CheckResult(engineResult.name(), engineResult.status(),
                    engineResult.message()));
            if ("ok".equals(engineResult.status())) {
                LOG.infof("Startup check OK: %s", engineResult.name());
            } else {
                LOG.warnf("Startup check %s: %s — %s",
                        engineResult.status().toUpperCase(), engineResult.name(),
                        engineResult.message());
            }
        }
    }

    /**
     * Result of a single startup check.
     */
    public record CheckResult(String name, String status, String message) {
    }
}
