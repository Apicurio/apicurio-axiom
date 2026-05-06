package io.apicurio.axiom.engine.spi;

import jakarta.inject.Qualifier;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.ElementType.TYPE;

/**
 * CDI qualifier annotation for AI engine implementations. Each engine bean
 * is annotated with this qualifier to enable selection based on the
 * {@code axiom.ai-engine} configuration property.
 *
 * <p>Usage:</p>
 * <pre>
 * {@literal @}ApplicationScoped
 * {@literal @}AiEngineType("claude-code")
 * public class ClaudeCodeEngine implements AiEngine { ... }
 * </pre>
 */
@Qualifier
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({TYPE, METHOD, FIELD, PARAMETER})
public @interface AiEngineType {

    /**
     * The engine type identifier (e.g. "claude-code", "opencode").
     */
    String value();
}
