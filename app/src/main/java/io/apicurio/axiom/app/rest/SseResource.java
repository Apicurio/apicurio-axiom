package io.apicurio.axiom.app.rest;

import io.apicurio.axiom.core.events.SseEvent;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.subscription.MultiEmitter;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.jboss.logging.Logger;
import org.jboss.resteasy.reactive.RestStreamElementType;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SSE endpoint that streams real-time events to connected UI clients.
 * Listens for CDI {@link SseEvent} events and broadcasts them to all
 * connected subscribers.
 *
 * <p>Uses a set of emitters instead of BroadcastProcessor to avoid
 * back-pressure failures when no clients are connected or clients
 * can't keep up.</p>
 */
@Path("/api/v1/sse")
@ApplicationScoped
public class SseResource {

    private static final Logger LOG = Logger.getLogger(SseResource.class);

    private final Set<MultiEmitter<? super SseEvent>> emitters = ConcurrentHashMap.newKeySet();

    /**
     * SSE stream endpoint. Clients connect here and receive real-time events.
     *
     * @return a multi that emits SSE events
     */
    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.APPLICATION_JSON)
    public Multi<SseEvent> stream() {
        LOG.info("SSE client connected");
        return Multi.createFrom().emitter(emitter -> {
            emitters.add(emitter);
            emitter.onTermination(() -> {
                emitters.remove(emitter);
                LOG.info("SSE client disconnected");
            });
        });
    }

    /**
     * Observes CDI SseEvent events and broadcasts them to all connected clients.
     * Silently drops events if no clients are connected.
     *
     * @param event the event to broadcast
     */
    void onSseEvent(@Observes SseEvent event) {
        if (emitters.isEmpty()) {
            return;
        }
        LOG.debugf("Broadcasting SSE event: %s to %d client(s)", event.type(), emitters.size());
        for (MultiEmitter<? super SseEvent> emitter : emitters) {
            try {
                emitter.emit(event);
            } catch (Exception e) {
                LOG.debugf("Failed to emit SSE event to client: %s", e.getMessage());
            }
        }
    }
}
