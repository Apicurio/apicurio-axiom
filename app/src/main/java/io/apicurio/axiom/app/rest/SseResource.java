package io.apicurio.axiom.app.rest;

import io.apicurio.axiom.core.events.SseEvent;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.jboss.logging.Logger;
import org.jboss.resteasy.reactive.RestStreamElementType;

/**
 * SSE endpoint that streams real-time events to connected UI clients.
 * Listens for CDI {@link SseEvent} events and broadcasts them to all
 * connected subscribers.
 */
@Path("/api/v1/sse")
@ApplicationScoped
public class SseResource {

    private static final Logger LOG = Logger.getLogger(SseResource.class);

    private final BroadcastProcessor<SseEvent> processor = BroadcastProcessor.create();

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
        return processor;
    }

    /**
     * Observes CDI SseEvent events and broadcasts them to all connected clients.
     *
     * @param event the event to broadcast
     */
    void onSseEvent(@Observes SseEvent event) {
        LOG.debugf("Broadcasting SSE event: %s", event.type());
        processor.onNext(event);
    }
}
