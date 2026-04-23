package io.apicurio.axiom.app;

import io.apicurio.axiom.core.entities.ActionTypeEntity;
import io.apicurio.axiom.core.entities.ActorEntity;
import io.apicurio.axiom.core.entities.PolicyEntity;
import io.apicurio.axiom.core.entities.RepositoryEntity;
import io.apicurio.axiom.core.entities.ToolDefinitionEntity;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

/**
 * Seeds built-in action types on application startup if they don't already exist.
 */
@ApplicationScoped
public class SeedDataInitializer {

    private static final Logger LOG = Logger.getLogger(SeedDataInitializer.class);

    /**
     * Called on application startup to seed built-in action types.
     *
     * @param event the Quarkus startup event
     */
    @Transactional
    void onStart(@Observes StartupEvent event) {
        if (ActionTypeEntity.count() > 0) {
            LOG.info("Action types already exist, skipping seed data");
            return;
        }

        LOG.info("Seeding built-in action types");

        seedActionType("analyze",
                "Read and understand an issue, assess complexity, identify affected components",
                "actor", true, true, READ_ONLY_TOOLS,
                """
                You are analyzing a GitHub issue. Read the issue details, examine the \
                repository structure, and produce a structured analysis.

                ## Instructions
                1. Read and understand the issue described below
                2. Examine the repository to gather relevant context
                3. Produce a summary with the following sections:
                   - **Issue Summary**: What is being asked or reported
                   - **Findings**: What you discovered in the repository
                   - **Complexity Assessment**: Low/Medium/High with justification
                   - **Recommendations**: Suggested next steps
                4. Do NOT make any code changes — this is a read-only analysis

                ## Issue
                {{issueRef}} in {{repository}}

                ## Context from Manager
                {{managerInput}}
                """);

        seedActionType("auto-tag",
                "Determine appropriate labels/tags for an issue",
                "actor", false, true, READ_PLUS_MCP_TOOLS,
                """
                You are tagging a GitHub issue with appropriate labels.

                ## Instructions
                1. Read the issue title and body
                2. Determine appropriate labels (e.g. bug, feature, documentation, \
                   question, good-first-issue, help-wanted)
                3. Apply the labels using: gh issue edit {{issueRef}} --repo {{repository}} --add-label "label1,label2"
                4. If suitable labels don't exist in the repository, skip labeling and \
                   report what labels you would have applied

                ## Issue
                {{issueRef}} in {{repository}}

                ## Context from Manager
                {{managerInput}}
                """);

        seedActionType("implement",
                "Write code to address the issue",
                "actor", true, true, WRITE_TOOLS,
                """
                You are implementing a code change to address a GitHub issue.

                ## Instructions
                1. Read the issue and understand what needs to be done
                2. Examine the repository to understand the codebase
                3. Create a feature branch: git checkout -b agent/issue-<number>
                4. Make the necessary code changes
                5. Commit with a descriptive message referencing the issue
                6. Push the branch: git push -u origin agent/issue-<number>
                7. Open a pull request: gh pr create --title "..." --body "Closes #<number>"

                ## Issue
                {{issueRef}} in {{repository}}

                ## Context from Manager
                {{managerInput}}
                """);

        seedActionType("propose",
                "Draft a proposal or design for addressing the issue (read-only, no code changes)",
                "actor", true, true, READ_ONLY_TOOLS,
                """
                You are drafting a proposal for how to address a GitHub issue.

                ## Instructions
                1. Read the issue and understand the requirements
                2. Examine the repository structure and relevant code
                3. Produce a design proposal with:
                   - **Approach**: How you would solve this
                   - **Files to Change**: Which files would be modified
                   - **Risks**: Potential issues or trade-offs
                   - **Estimated Effort**: Rough assessment of complexity
                4. Do NOT make any code changes — this is a read-only proposal

                ## Issue
                {{issueRef}} in {{repository}}

                ## Context from Manager
                {{managerInput}}
                """);

        seedActionType("review",
                "Review a pull request or code change",
                "actor", true, true, READ_ONLY_TOOLS,
                """
                You are reviewing code changes related to a GitHub issue.

                ## Instructions
                1. Examine the changes in the repository
                2. Review for correctness, style, and potential issues
                3. Produce a review summary with:
                   - **Summary**: What the changes do
                   - **Issues Found**: Any bugs, style issues, or concerns
                   - **Suggestions**: Improvements or alternatives
                4. Do NOT make any code changes

                ## Issue
                {{issueRef}} in {{repository}}

                ## Context from Manager
                {{managerInput}}
                """);

        seedActionType("respond",
                "Reply to a comment or review feedback",
                "actor", true, true, WRITE_TOOLS,
                """
                You are responding to feedback on a GitHub issue or pull request.

                ## Instructions
                1. Read the feedback or comment described below
                2. If code changes are requested, make them and commit
                3. Post a response on the issue:
                   a. Write your comment to /tmp/gh-comment.md using the Write tool
                   b. Then run: gh issue comment <number> --repo {{repository}} --body-file /tmp/gh-comment.md
                4. If you cannot post the comment, include the full response text in your output

                ## Issue
                {{issueRef}} in {{repository}}

                ## Context from Manager
                {{managerInput}}
                """);

        seedActionType("answer-question",
                "Answer a question asked by a user on the issue",
                "actor", false, true, READ_PLUS_MCP_TOOLS,
                """
                You are answering a question on a GitHub issue.

                ## Instructions
                1. Read the question described below
                2. Examine the repository to find the answer
                3. Post your answer directly on the issue using the \
                post_github_comment tool with the repository, issue number, \
                and your answer as the body
                4. Keep your answer concise, friendly, and informative
                5. If you cannot post the comment, include the full answer in your output

                ## Issue
                {{issueRef}} in {{repository}}

                ## Context from Manager
                {{managerInput}}
                """);

        seedActionType("close-project",
                "Mark the project as completed",
                "system", false, false, null, null);

        seedActionType("reopen-project",
                "Re-open a completed project",
                "system", false, false, null, null);

        LOG.infof("Seeded %d built-in action types", ActionTypeEntity.count());

        // Seed actor, policy, and test repository
        seedTools();
        seedActors();
        seedPolicy();
        seedRepository();
    }

    private void seedTools() {
        if (ToolDefinitionEntity.count() > 0) {
            LOG.info("Tools already exist, skipping tool seed data");
            return;
        }

        // Post GitHub Comment tool
        ToolDefinitionEntity postComment = new ToolDefinitionEntity();
        postComment.name = "post_github_comment";
        postComment.description = "Post a comment on a GitHub issue. The comment body is written "
                + "to a temp file to avoid shell quoting issues.";
        postComment.type = "script";
        postComment.parameters = "[{\"name\":\"repo\",\"type\":\"string\",\"description\":\"Repository in owner/name format\",\"required\":true},"
                + "{\"name\":\"issue_number\",\"type\":\"number\",\"description\":\"Issue number\",\"required\":true},"
                + "{\"name\":\"body\",\"type\":\"string\",\"description\":\"Comment body (markdown)\",\"required\":true}]";
        postComment.scriptTemplate = "gh issue comment {{issue_number}} --repo {{repo}} --body-file {{body_file}}";
        postComment.persist();

        // Add GitHub Labels tool
        ToolDefinitionEntity addLabels = new ToolDefinitionEntity();
        addLabels.name = "add_github_labels";
        addLabels.description = "Add labels to a GitHub issue.";
        addLabels.type = "script";
        addLabels.parameters = "[{\"name\":\"repo\",\"type\":\"string\",\"description\":\"Repository in owner/name format\",\"required\":true},"
                + "{\"name\":\"issue_number\",\"type\":\"number\",\"description\":\"Issue number\",\"required\":true},"
                + "{\"name\":\"labels\",\"type\":\"string\",\"description\":\"Comma-separated label names\",\"required\":true}]";
        addLabels.scriptTemplate = "gh issue edit {{issue_number}} --repo {{repo}} --add-label \"{{labels}}\"";
        addLabels.persist();

        // Create GitHub PR tool
        ToolDefinitionEntity createPr = new ToolDefinitionEntity();
        createPr.name = "create_github_pr";
        createPr.description = "Create a pull request on GitHub. The PR body is written "
                + "to a temp file to avoid shell quoting issues.";
        createPr.type = "script";
        createPr.parameters = "[{\"name\":\"repo\",\"type\":\"string\",\"description\":\"Repository in owner/name format\",\"required\":true},"
                + "{\"name\":\"title\",\"type\":\"string\",\"description\":\"PR title\",\"required\":true},"
                + "{\"name\":\"body\",\"type\":\"string\",\"description\":\"PR description (markdown)\",\"required\":true},"
                + "{\"name\":\"head\",\"type\":\"string\",\"description\":\"Branch to merge from\",\"required\":true}]";
        createPr.scriptTemplate = "gh pr create --repo {{repo}} --title \"{{title}}\" --body-file {{body_file}} --head {{head}}";
        createPr.persist();

        LOG.infof("Seeded %d built-in tools", ToolDefinitionEntity.count());

    }

    private void seedActors() {
        if (ActorEntity.count() > 0) {
            LOG.info("Actors already exist, skipping actor seed data");
            return;
        }

        ActorEntity actor = new ActorEntity();
        actor.name = "Blinky";
        actor.description = "AI agent powered by Claude Code CLI";
        actor.type = "ai-agent";
        actor.capabilities = "analyze,auto-tag,implement,propose,review,respond,answer-question";
        actor.persist();
        LOG.infof("Seeded actor: %s (%s)", actor.name, actor.type);

        actor = new ActorEntity();
        actor.name = "Clyde";
        actor.description = "AI agent powered by Claude Code CLI";
        actor.type = "ai-agent";
        actor.capabilities = "analyze,auto-tag,implement,propose,review,respond,answer-question";
        actor.persist();
        LOG.infof("Seeded actor: %s (%s)", actor.name, actor.type);
    }

    private void seedPolicy() {
        if (PolicyEntity.count() > 0) {
            LOG.info("Policies already exist, skipping policy seed data");
            return;
        }

        PolicyEntity policy = new PolicyEntity();
        policy.name = "Analyze new issues";
        policy.guideline = "If the event represents a new issue being created (issue-created), " +
                "perform the \"analyze\" action. The actor should read the issue title and body, " +
                "understand the problem or request, assess its complexity, and produce a brief " +
                "summary with recommendations for next steps.";
        policy.actionType = "analyze";
        policy.persist();

        LOG.infof("Seeded policy: %s", policy.name);
    }

    private void seedRepository() {
        if (RepositoryEntity.count() > 0) {
            LOG.info("Repositories already exist, skipping repository seed data");
            return;
        }

        RepositoryEntity repo = new RepositoryEntity();
        repo.name = "cb-test-project";
        repo.owner = "EricWittmann";
        repo.source = "github";
        repo.url = "https://github.com/EricWittmann/cb-test-project";
        repo.pollInterval = 30;
        repo.pollingEnabled = true;
        repo.persist();

        LOG.infof("Seeded test repository: %s/%s (polling every %ds)",
                repo.owner, repo.name, repo.pollInterval);
    }

    private static final String READ_ONLY_TOOLS = String.join(",",
            "Read", "Glob", "Grep",
            "Bash(ls *)", "Bash(cat *)", "Bash(head *)", "Bash(tail *)",
            "Bash(find *)", "Bash(wc *)", "Bash(file *)",
            "Bash(git log *)", "Bash(git diff *)", "Bash(git show *)",
            "Bash(git status *)", "Bash(git branch *)"
    );

    private static final String READ_PLUS_MCP_TOOLS = String.join(",",
            READ_ONLY_TOOLS,
            "mcp__axiom-tools__post_github_comment",
            "mcp__axiom-tools__add_github_labels"
    );

    private static final String WRITE_TOOLS = String.join(",",
            READ_ONLY_TOOLS,
            "Edit", "Write",
            "Bash(git add *)", "Bash(git commit *)", "Bash(git checkout *)",
            "Bash(git switch *)", "Bash(git push *)", "Bash(git merge *)",
            "Bash(mkdir *)", "Bash(cp *)", "Bash(mv *)",
            "mcp__axiom-tools__post_github_comment",
            "mcp__axiom-tools__create_github_pr"
    );

    private void seedActionType(String name, String description, String executionMode,
                                boolean userTriggerable, boolean emitsEvent, String allowedTools,
                                String promptTemplate) {
        ActionTypeEntity entity = new ActionTypeEntity();
        entity.name = name;
        entity.description = description;
        entity.executionMode = executionMode;
        entity.userTriggerable = userTriggerable;
        entity.emitsEvent = emitsEvent;
        entity.allowedTools = allowedTools;
        entity.promptTemplate = promptTemplate;
        entity.persist();
    }
}
