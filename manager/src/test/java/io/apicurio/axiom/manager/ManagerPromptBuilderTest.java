package io.apicurio.axiom.manager;

import io.apicurio.axiom.core.entities.ActionTypeEntity;
import io.apicurio.axiom.core.entities.ActorEntity;
import io.apicurio.axiom.core.entities.EventEntity;
import io.apicurio.axiom.core.entities.ProjectEntity;
import io.apicurio.axiom.core.entities.TaskEntity;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for ManagerPromptBuilder.
 */
class ManagerPromptBuilderTest {

    @Test
    void testDefaultSystemPromptContainsRoleDefinition() {
        String prompt = ManagerPromptBuilder.DEFAULT_SYSTEM_PROMPT;

        assertTrue(prompt.contains("Axiom Manager"));
        assertTrue(prompt.contains("create_task"));
        assertTrue(prompt.contains("ignore"));
        assertTrue(prompt.contains("script_action"));
        assertTrue(prompt.contains("escalate"));
    }

    @Test
    void testFormatActionTypes() {
        ActionTypeEntity at = new ActionTypeEntity();
        at.name = "analyze";
        at.executionMode = "actor";
        at.description = "Analyze an issue";

        String formatted = ManagerPromptBuilder.formatActionTypes(List.of(at));

        assertTrue(formatted.contains("Available Action Types"));
        assertTrue(formatted.contains("analyze"));
        assertTrue(formatted.contains("actor"));
        assertTrue(formatted.contains("Analyze an issue"));
    }

    @Test
    void testFormatActionTypesEmpty() {
        String formatted = ManagerPromptBuilder.formatActionTypes(Collections.emptyList());

        assertTrue(formatted.contains("No action types configured"));
    }

    @Test
    void testFormatActors() {
        ActorEntity actor = new ActorEntity();
        actor.name = "Claude Agent";
        actor.type = "ai-agent";
        actor.description = "AI agent powered by Claude";
        actor.capabilities = "analyze,implement";

        String formatted = ManagerPromptBuilder.formatActors(List.of(actor));

        assertTrue(formatted.contains("Available Actors"));
        assertTrue(formatted.contains("Claude Agent"));
        assertTrue(formatted.contains("ai-agent"));
        assertTrue(formatted.contains("analyze,implement"));
    }

    @Test
    void testBuildUserPromptSubstitutesPlaceholders() {
        EventEntity event = new EventEntity();
        event.source = "github";
        event.eventType = "issue-created";
        event.issueRef = "Apicurio/axiom#42";
        event.repository = "Apicurio/axiom";
        event.payload = "{\"action\":\"opened\",\"issue\":{\"title\":\"Test\"}}";

        ActionTypeEntity at = new ActionTypeEntity();
        at.name = "analyze";
        at.executionMode = "actor";
        at.description = "Analyze an issue";

        ActorEntity actor = new ActorEntity();
        actor.name = "Blinky";
        actor.type = "ai-agent";

        String prompt = ManagerPromptBuilder.buildUserPrompt(
                ManagerPromptBuilder.DEFAULT_PROMPT_TEMPLATE,
                event, List.of(at), List.of(actor), null, Collections.emptyList());

        assertTrue(prompt.contains("github"));
        assertTrue(prompt.contains("issue-created"));
        assertTrue(prompt.contains("Apicurio/axiom#42"));
        assertTrue(prompt.contains("\"action\":\"opened\""));
        assertTrue(prompt.contains("analyze"));
        assertTrue(prompt.contains("no existing Axiom project"));
    }

    @Test
    void testBuildUserPromptContainsProjectContext() {
        EventEntity event = new EventEntity();
        event.source = "github";
        event.eventType = "comment-added";
        event.issueRef = "Apicurio/axiom#10";
        event.payload = "{}";

        ProjectEntity project = new ProjectEntity();
        project.id = 1L;
        project.name = "Fix login bug";
        project.status = "Idle";
        project.type = "bug-fix";

        TaskEntity task = new TaskEntity();
        task.actionType = "analyze";
        task.status = "Completed";
        task.output = "The issue is in the auth module";

        String prompt = ManagerPromptBuilder.buildUserPrompt(
                ManagerPromptBuilder.DEFAULT_PROMPT_TEMPLATE,
                event, Collections.emptyList(), Collections.emptyList(),
                project, List.of(task));

        assertTrue(prompt.contains("Fix login bug"));
        assertTrue(prompt.contains("Idle"));
        assertTrue(prompt.contains("bug-fix"));
        assertTrue(prompt.contains("analyze"));
        assertTrue(prompt.contains("Completed"));
        assertTrue(prompt.contains("auth module"));
    }

    @Test
    void testJsonSchemaIsValidJson() {
        String schema = ManagerPromptBuilder.getResponseJsonSchema();

        assertNotNull(schema);
        assertTrue(schema.contains("\"decisions\""));
        assertTrue(schema.contains("\"create_task\""));
        assertTrue(schema.contains("\"confidence\""));
        assertDoesNotThrow(() -> new com.fasterxml.jackson.databind.ObjectMapper().readTree(schema));
    }
}
