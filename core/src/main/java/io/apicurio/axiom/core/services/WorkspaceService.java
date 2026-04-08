package io.apicurio.axiom.core.services;

import io.apicurio.axiom.core.entities.ProjectEntity;
import io.apicurio.axiom.core.entities.RepositoryEntity;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Manages git clone workspaces for projects. Each project gets an independent
 * clone of its associated repository in a workspace directory.
 */
@ApplicationScoped
public class WorkspaceService {

    private static final Logger LOG = Logger.getLogger(WorkspaceService.class);

    @ConfigProperty(name = "axiom.workspace.root", defaultValue = "${user.home}/.axiom/workspaces")
    String workspaceRoot;

    @ConfigProperty(name = "axiom.workspace.clone-timeout-seconds", defaultValue = "120")
    int cloneTimeoutSeconds;

    /**
     * Returns the workspace path for a project. Creates the directory if it
     * doesn't exist.
     *
     * @param project the project
     * @return the workspace directory path
     */
    public Path getWorkspacePath(ProjectEntity project) {
        return Path.of(workspaceRoot, "project-" + project.id);
    }

    /**
     * Ensures a workspace exists for the given project. If the workspace
     * directory doesn't exist or is empty, clones the repository.
     *
     * @param project the project to create a workspace for
     * @return the workspace directory path
     * @throws WorkspaceException if the clone fails
     */
    public Path ensureWorkspace(ProjectEntity project) {
        Path workspace = getWorkspacePath(project);

        if (Files.exists(workspace.resolve(".git"))) {
            LOG.debugf("Workspace already exists for project %d at %s", project.id, workspace);
            return workspace;
        }

        LOG.infof("Creating workspace for project %d at %s", project.id, workspace);

        // Look up the repository configuration for clone URL and auth
        RepositoryEntity repo = findRepository(project);
        String cloneUrl = buildCloneUrl(project, repo);

        try {
            Files.createDirectories(workspace.getParent());
            cloneRepository(cloneUrl, workspace, repo);
        } catch (Exception e) {
            LOG.errorf(e, "Failed to clone repository for project %d", project.id);
            throw new WorkspaceException("Failed to clone repository: " + e.getMessage(), e);
        }

        return workspace;
    }

    /**
     * Deletes the workspace directory for a project.
     *
     * @param project the project whose workspace should be deleted
     */
    public void deleteWorkspace(ProjectEntity project) {
        Path workspace = getWorkspacePath(project);
        if (Files.exists(workspace)) {
            LOG.infof("Deleting workspace for project %d at %s", project.id, workspace);
            try {
                deleteRecursively(workspace);
            } catch (IOException e) {
                LOG.warnf(e, "Failed to delete workspace for project %d", project.id);
            }
        }
    }

    private RepositoryEntity findRepository(ProjectEntity project) {
        String[] parts = project.repository.split("/", 2);
        if (parts.length == 2) {
            RepositoryEntity repo = RepositoryEntity.find(
                    "owner = ?1 and name = ?2", parts[0], parts[1]).firstResult();
            if (repo != null) {
                return repo;
            }
        }
        return null;
    }

    private String buildCloneUrl(ProjectEntity project, RepositoryEntity repo) {
        if (repo != null && repo.url != null) {
            // If the repo has a PAT in its configuration, embed it in the URL
            String pat = extractPat(repo);
            if (pat != null) {
                // https://<token>@github.com/owner/repo.git
                return repo.url.replace("https://", "https://" + pat + "@");
            }
            return repo.url;
        }
        // Fall back to constructing a URL from the project's repository field
        return "https://github.com/" + project.repository + ".git";
    }

    private String extractPat(RepositoryEntity repo) {
        // PAT can be stored in the repository's configuration JSON
        // For now, return null — SSH/PAT integration will be refined later
        return null;
    }

    private void cloneRepository(String cloneUrl, Path targetDir, RepositoryEntity repo)
            throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(
                "git", "clone", "--depth", "1", cloneUrl, targetDir.toAbsolutePath().toString()
        );
        pb.redirectErrorStream(true);

        // Configure SSH if needed
        if (repo != null && repo.configuration != null
                && repo.configuration.contains("sshKeyPath")) {
            // TODO: Parse SSH key path from configuration and set GIT_SSH_COMMAND
            LOG.debugf("SSH authentication configured for repository %s", repo.name);
        }

        Process process = pb.start();
        boolean completed = process.waitFor(cloneTimeoutSeconds, TimeUnit.SECONDS);
        if (!completed) {
            process.destroyForcibly();
            throw new IOException("Git clone timed out after " + cloneTimeoutSeconds + "s");
        }
        if (process.exitValue() != 0) {
            String output = new String(process.getInputStream().readAllBytes());
            throw new IOException("Git clone failed (exit " + process.exitValue() + "): " + output);
        }

        LOG.infof("Cloned repository to %s", targetDir);
    }

    private void deleteRecursively(Path path) throws IOException {
        if (Files.isDirectory(path)) {
            try (var entries = Files.list(path)) {
                for (Path entry : entries.toList()) {
                    deleteRecursively(entry);
                }
            }
        }
        Files.deleteIfExists(path);
    }

    /**
     * Exception thrown when workspace operations fail.
     */
    public static class WorkspaceException extends RuntimeException {

        /**
         * Creates a new workspace exception.
         *
         * @param message the error message
         * @param cause the underlying cause
         */
        public WorkspaceException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
