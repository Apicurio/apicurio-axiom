package io.apicurio.axiom.app.rest;

import io.apicurio.axiom.api.beans.Features;
import io.apicurio.axiom.api.beans.SystemConfig;
import io.apicurio.axiom.api.beans.SystemHealth;
import io.apicurio.axiom.api.SystemResource;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Date;

/**
 * Implementation of the System API endpoints.
 */
@ApplicationScoped
@RunOnVirtualThread
public class SystemResourceImpl implements SystemResource {

    @ConfigProperty(name = "quarkus.application.version", defaultValue = "1.0.0-SNAPSHOT")
    String applicationVersion;

    /**
     * {@inheritDoc}
     */
    @Override
    public SystemHealth getSystemHealth() {
        SystemHealth health = new SystemHealth();
        health.setStatus(SystemHealth.Status.UP);
        health.setVersion(applicationVersion);
        health.setTimestamp(new Date());
        return health;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public SystemConfig getSystemConfig() {
        SystemConfig config = new SystemConfig();
        config.setVersion(applicationVersion);
        config.setFeatures(new Features());
        return config;
    }

}
