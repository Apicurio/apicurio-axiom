import { useState, useEffect, useCallback } from "react";
import {
    Button,
    EmptyState,
    EmptyStateBody,
    Label,
    PageSection,
    Pagination,
    TextInput,
    Title,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import { type AxiomEvent, fetchEvents } from "../config/api";
import { EventDetailModal } from "../components/EventDetailModal";

const SOURCE_COLORS: Record<string, "blue" | "green" | "orange" | "grey"> = {
    github: "blue",
    jira: "green",
    internal: "orange",
};

export function EventsPage() {
    const [events, setEvents] = useState<AxiomEvent[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [loading, setLoading] = useState(true);

    // Committed filter values
    const [filterSource, setFilterSource] = useState("");
    const [filterEventType, setFilterEventType] = useState("");
    const [filterRepository, setFilterRepository] = useState("");
    // Input values (committed on Enter/blur)
    const [inputSource, setInputSource] = useState("");
    const [inputEventType, setInputEventType] = useState("");
    const [inputRepository, setInputRepository] = useState("");

    // Payload modal
    const [selectedEvent, setSelectedEvent] = useState<AxiomEvent | null>(null);

    const loadData = useCallback(() => {
        setLoading(true);
        fetchEvents(
            page, perPage,
            filterSource || undefined,
            filterEventType || undefined,
            filterRepository || undefined
        )
            .then((results) => {
                setEvents(results.items);
                setTotalCount(results.totalCount);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [page, perPage, filterSource, filterEventType, filterRepository]);

    useEffect(() => { loadData(); }, [loadData]);

    const hasActiveFilters = filterSource || filterEventType || filterRepository;

    const applyFilters = () => {
        setFilterSource(inputSource);
        setFilterEventType(inputEventType);
        setFilterRepository(inputRepository);
        setPage(1);
    };

    const clearFilters = () => {
        setInputSource("");
        setInputEventType("");
        setInputRepository("");
        setFilterSource("");
        setFilterEventType("");
        setFilterRepository("");
        setPage(1);
    };

    return (
        <PageSection>
            <Title headingLevel="h1" size="lg" style={{ marginBottom: "16px" }}>
                Events
            </Title>

            <Toolbar clearAllFilters={clearFilters}>
                <ToolbarContent>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by source"
                            placeholder="Source"
                            value={inputSource}
                            onChange={(_e, v) => setInputSource(v)}
                            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                            onBlur={applyFilters}
                            style={{ width: "150px" }}
                        />
                    </ToolbarItem>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by event type"
                            placeholder="Event type"
                            value={inputEventType}
                            onChange={(_e, v) => setInputEventType(v)}
                            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                            onBlur={applyFilters}
                            style={{ width: "180px" }}
                        />
                    </ToolbarItem>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by repository"
                            placeholder="Repository"
                            value={inputRepository}
                            onChange={(_e, v) => setInputRepository(v)}
                            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                            onBlur={applyFilters}
                            style={{ width: "200px" }}
                        />
                    </ToolbarItem>
                    {hasActiveFilters && (
                        <ToolbarItem>
                            <Button variant="link" icon={<TimesIcon />} onClick={clearFilters}>
                                Clear filters
                            </Button>
                        </ToolbarItem>
                    )}
                    <ToolbarItem variant="separator" />
                    <ToolbarItem>
                        <Button variant="plain" aria-label="Refresh" onClick={loadData}>
                            <SyncAltIcon />
                        </Button>
                    </ToolbarItem>
                    <ToolbarItem variant="pagination" align={{ default: "alignEnd" }}>
                        <Pagination
                            itemCount={totalCount}
                            page={page}
                            perPage={perPage}
                            onSetPage={(_e, p) => setPage(p)}
                            onPerPageSelect={(_e, pp) => { setPerPage(pp); setPage(1); }}
                            isCompact
                        />
                    </ToolbarItem>
                </ToolbarContent>
            </Toolbar>

            <div>
                {loading ? (
                    <EmptyState>
                        <EmptyStateBody>Loading events...</EmptyStateBody>
                    </EmptyState>
                ) : events.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>
                            {hasActiveFilters
                                ? "No events match the current filters."
                                : "No events recorded yet."}
                        </EmptyStateBody>
                    </EmptyState>
                ) : (
                    <Table aria-label="Events" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>#</Th>
                                <Th>Time</Th>
                                <Th>Source</Th>
                                <Th>Event Type</Th>
                                <Th>Repository</Th>
                                <Th>Issue</Th>
                                <Th>Project</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {events.map((event) => (
                                <Tr key={event.id} isClickable
                                    onRowClick={() => setSelectedEvent(event)}>
                                    <Td>{event.id}</Td>
                                    <Td style={{ whiteSpace: "nowrap" }}>
                                        {new Date(event.receivedAt).toLocaleString()}
                                    </Td>
                                    <Td>
                                        <Label isCompact
                                            color={SOURCE_COLORS[event.source] || "grey"}>
                                            {event.source}
                                        </Label>
                                    </Td>
                                    <Td>{event.eventType}</Td>
                                    <Td>{event.repository || "—"}</Td>
                                    <Td>{event.issueRef || "—"}</Td>
                                    <Td>
                                        {event.projectId
                                            ? `Project #${event.projectId}`
                                            : "—"}
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </div>

            <EventDetailModal
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
            />
        </PageSection>
    );
}
