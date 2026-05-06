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
import { type ActivityLogEntry, type AxiomEvent, fetchActivityLog, fetchEvent } from "../config/api";
import { ExecutionLogModal } from "../components/ExecutionLogModal";
import { EventDetailModal } from "../components/EventDetailModal";

const MANAGER_ENTRY_TYPES = "manager-evaluated,manager-error,manager-skipped,manager-escalation,manager-no-decision";

const ENTRY_TYPE_COLORS: Record<string, "blue" | "green" | "orange" | "grey" | "red"> = {
    "manager-evaluated": "blue",
    "manager-error": "red",
    "manager-skipped": "grey",
    "manager-escalation": "orange",
    "manager-no-decision": "grey",
};

export function ManagerDecisionsPage() {
    const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [loading, setLoading] = useState(true);

    // Committed filter values
    const [filterSummary, setFilterSummary] = useState("");
    const [filterProjectId, setFilterProjectId] = useState("");
    // Input values (committed on Enter/blur)
    const [inputSummary, setInputSummary] = useState("");
    const [inputProjectId, setInputProjectId] = useState("");

    // Log modal
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logActivityId, setLogActivityId] = useState<number | null>(null);

    // Event payload modal
    const [selectedEvent, setSelectedEvent] = useState<AxiomEvent | null>(null);

    const loadData = useCallback(() => {
        setLoading(true);
        fetchActivityLog(
            page, perPage,
            undefined,
            filterSummary || undefined,
            filterProjectId ? Number(filterProjectId) : undefined,
            MANAGER_ENTRY_TYPES
        )
            .then((results) => {
                setEntries(results.items);
                setTotalCount(results.totalCount);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [page, perPage, filterSummary, filterProjectId]);

    useEffect(() => { loadData(); }, [loadData]);

    const hasActiveFilters = filterSummary || filterProjectId;

    const applyFilters = () => {
        setFilterSummary(inputSummary);
        setFilterProjectId(inputProjectId);
        setPage(1);
    };

    const clearFilters = () => {
        setInputSummary("");
        setInputProjectId("");
        setFilterSummary("");
        setFilterProjectId("");
        setPage(1);
    };

    const handleViewEvent = (eventId: number) => {
        fetchEvent(eventId)
            .then(setSelectedEvent)
            .catch(console.error);
    };

    const handleViewLog = (activityId: number) => {
        setLogActivityId(activityId);
        setIsLogModalOpen(true);
    };

    return (
        <PageSection>
            <Title headingLevel="h1" size="lg" style={{ marginBottom: "16px" }}>
                Manager Decisions
            </Title>

            <Toolbar clearAllFilters={clearFilters}>
                <ToolbarContent>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by summary"
                            placeholder="Summary search"
                            value={inputSummary}
                            onChange={(_e, v) => setInputSummary(v)}
                            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                            onBlur={applyFilters}
                            style={{ width: "220px" }}
                        />
                    </ToolbarItem>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by project ID"
                            placeholder="Project ID"
                            value={inputProjectId}
                            onChange={(_e, v) => setInputProjectId(v)}
                            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                            onBlur={applyFilters}
                            style={{ width: "120px" }}
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
                        <EmptyStateBody>Loading manager decisions...</EmptyStateBody>
                    </EmptyState>
                ) : entries.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>
                            {hasActiveFilters
                                ? "No decisions match the current filters."
                                : "No manager evaluations yet. Decisions will appear here as the Manager processes incoming events."}
                        </EmptyStateBody>
                    </EmptyState>
                ) : (
                    <Table aria-label="Manager Decisions" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>Time</Th>
                                <Th>Event</Th>
                                <Th>Type</Th>
                                <Th>Summary</Th>
                                <Th />
                                <Th />
                            </Tr>
                        </Thead>
                        <Tbody>
                            {entries.map((entry) => (
                                <Tr key={entry.id}>
                                    <Td style={{ whiteSpace: "nowrap" }}>
                                        {new Date(entry.createdOn).toLocaleString()}
                                    </Td>
                                    <Td>
                                        {entry.eventId ? (
                                            <Label isCompact color="blue">
                                                #{entry.eventId}
                                            </Label>
                                        ) : "—"}
                                    </Td>
                                    <Td>
                                        <Label isCompact
                                            color={ENTRY_TYPE_COLORS[entry.entryType] || "grey"}>
                                            {entry.entryType}
                                        </Label>
                                    </Td>
                                    <Td>
                                        {entry.summary && entry.summary.length > 120
                                            ? entry.summary.substring(0, 117) + "..."
                                            : entry.summary}
                                    </Td>
                                    <Td>
                                        {entry.eventId && (
                                            <Button variant="link" isInline
                                                onClick={() => handleViewEvent(entry.eventId!)}>
                                                View Event
                                            </Button>
                                        )}
                                    </Td>
                                    <Td>
                                        {(entry.entryType === "manager-evaluated"
                                                || entry.entryType === "manager-error") && (
                                            <Button variant="link" isInline
                                                onClick={() => handleViewLog(entry.id)}>
                                                View Log
                                            </Button>
                                        )}
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </div>

            <ExecutionLogModal
                isOpen={isLogModalOpen}
                activityId={logActivityId}
                onClose={() => setIsLogModalOpen(false)}
            />

            <EventDetailModal
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
            />
        </PageSection>
    );
}
