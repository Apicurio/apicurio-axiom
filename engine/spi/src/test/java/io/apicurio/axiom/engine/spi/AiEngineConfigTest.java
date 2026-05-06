package io.apicurio.axiom.engine.spi;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link AiEngineConfig} builder — defaults, all fields, immutability.
 */
class AiEngineConfigTest {

    @Test
    void testDefaults() {
        AiEngineConfig config = AiEngineConfig.builder().build();

        assertNull(config.getModel());
        assertNull(config.getSystemPrompt());
        assertEquals(List.of(), config.getAllowedTools());
        assertEquals(List.of(), config.getDisallowedTools());
        assertNull(config.getWorkingDirectory());
        assertEquals(Map.of(), config.getEnvironment());
        assertEquals(120, config.getTimeoutSeconds());
        assertEquals(50, config.getMaxSteps());
        assertNull(config.getMaxBudgetUsd());
        assertNull(config.getSessionId());
        assertNull(config.getMcpConfigFile());
    }

    @Test
    void testAllFieldsSet() {
        Path workDir = Path.of("/tmp/workspace");
        Path mcpConfig = Path.of("/tmp/mcp.json");

        AiEngineConfig config = AiEngineConfig.builder()
                .model("anthropic/claude-sonnet-4-6")
                .systemPrompt("You are a helpful assistant.")
                .allowedTools(List.of("Read", "Glob", "Bash(git *)"))
                .disallowedTools(List.of("Write"))
                .workingDirectory(workDir)
                .environment(Map.of("GH_TOKEN", "ghp_xxx"))
                .timeoutSeconds(300)
                .maxSteps(10)
                .maxBudgetUsd(2.5)
                .sessionId("session-42")
                .mcpConfigFile(mcpConfig)
                .build();

        assertEquals("anthropic/claude-sonnet-4-6", config.getModel());
        assertEquals("You are a helpful assistant.", config.getSystemPrompt());
        assertEquals(List.of("Read", "Glob", "Bash(git *)"), config.getAllowedTools());
        assertEquals(List.of("Write"), config.getDisallowedTools());
        assertEquals(workDir, config.getWorkingDirectory());
        assertEquals(Map.of("GH_TOKEN", "ghp_xxx"), config.getEnvironment());
        assertEquals(300, config.getTimeoutSeconds());
        assertEquals(10, config.getMaxSteps());
        assertEquals(2.5, config.getMaxBudgetUsd());
        assertEquals("session-42", config.getSessionId());
        assertEquals(mcpConfig, config.getMcpConfigFile());
    }

    @Test
    void testBuilderCanBeReused() {
        AiEngineConfig.Builder builder = AiEngineConfig.builder()
                .model("model-a")
                .timeoutSeconds(60);

        AiEngineConfig config1 = builder.build();
        AiEngineConfig config2 = builder.model("model-b").build();

        assertEquals("model-a", config1.getModel());
        assertEquals("model-b", config2.getModel());
        // Both share the same timeout
        assertEquals(60, config1.getTimeoutSeconds());
        assertEquals(60, config2.getTimeoutSeconds());
    }

    @Test
    void testPartialBuild() {
        AiEngineConfig config = AiEngineConfig.builder()
                .model("openai/gpt-4o")
                .maxSteps(5)
                .build();

        assertEquals("openai/gpt-4o", config.getModel());
        assertEquals(5, config.getMaxSteps());
        // Defaults for unset fields
        assertEquals(120, config.getTimeoutSeconds());
        assertNull(config.getSystemPrompt());
        assertEquals(List.of(), config.getAllowedTools());
    }
}
