package io.apicurio.axiom.engine.spi;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * CDI producer that resolves the active {@link AiEngine} and {@link AiEngineMcpManager}
 * implementations based on the {@code axiom.ai-engine} configuration property.
 *
 * <p>Engine implementations are discovered via CDI and selected by matching
 * their {@link AiEngineType} qualifier value against the configured engine type.
 * If no matching implementation is found, startup fails with a clear error.</p>
 */
@ApplicationScoped
public class AiEngineProducer {

    private static final Logger LOG = Logger.getLogger(AiEngineProducer.class);

    @ConfigProperty(name = "axiom.ai-engine", defaultValue = "claude-code")
    String aiEngineType;

    @Inject
    Instance<AiEngine> engines;

    @Inject
    Instance<AiEngineMcpManager> mcpManagers;

    @Produces
    @ApplicationScoped
    public AiEngine produceAiEngine() {
        LOG.infof("Resolving AI engine: %s", aiEngineType);

        for (AiEngine engine : engines) {
            if (engine.getType().equals(aiEngineType)) {
                LOG.infof("AI engine resolved: %s (%s)", aiEngineType, engine.getClass().getSimpleName());
                return engine;
            }
        }

        throw new IllegalStateException(
                "No AI engine implementation found for type '" + aiEngineType + "'. "
                        + "Ensure that the corresponding engine module is on the classpath "
                        + "and provides a CDI bean implementing AiEngine with "
                        + "@AiEngineType(\"" + aiEngineType + "\")."
        );
    }

    @Produces
    @ApplicationScoped
    public AiEngineMcpManager produceAiEngineMcpManager() {
        for (AiEngineMcpManager manager : mcpManagers) {
            // Match by checking if it's annotated with the right engine type
            AiEngineType annotation = manager.getClass().getAnnotation(AiEngineType.class);
            if (annotation != null && annotation.value().equals(aiEngineType)) {
                LOG.infof("AI engine MCP manager resolved: %s (%s)",
                        aiEngineType, manager.getClass().getSimpleName());
                return manager;
            }
        }

        LOG.warnf("No AiEngineMcpManager found for engine type '%s', MCP features may be unavailable",
                aiEngineType);
        // Return a no-op manager rather than failing — not all engines require MCP
        return (taskId, environment, allowedTools) -> null;
    }
}
