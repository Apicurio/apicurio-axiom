package io.apicurio.axiom.app.rest;

import io.vertx.ext.web.Router;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

/**
 * Configures SPA (Single Page Application) routing for the bundled React UI.
 * Redirects non-API, non-static-file requests to {@code /index.html} so that
 * React Router handles client-side navigation for deep links.
 */
@ApplicationScoped
public class SpaRoutingFilter {

    /**
     * Registers a catch-all route that serves index.html for paths that
     * don't match API endpoints or static files. This runs after all other
     * routes have been registered.
     */
    void onRouterInit(@Observes Router router) {
        router.get("/*").order(Integer.MAX_VALUE).handler(ctx -> {
            String path = ctx.normalizedPath();

            // Skip API paths, SSE endpoint, and paths with file extensions (static assets)
            if (path.startsWith("/api/") || path.startsWith("/q/")
                    || path.contains(".")) {
                ctx.next();
                return;
            }

            // Reroute to index.html for SPA client-side routing
            ctx.reroute("/index.html");
        });
    }
}
