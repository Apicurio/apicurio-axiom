import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Button,
    EmptyState,
    EmptyStateBody,
    Label,
    PageSection,
    Pagination,
    Select,
    SelectOption,
    MenuToggle,
    MenuToggleElement,
    TextInput,
    Title,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import { type ActivityLogEntry, fetchActivityLog } from "../config/api";
import { ExecutionLogModal } from "../components/ExecutionLogModal";

const ENTRY_TYPE_COLORS: Record<string, "blue" | "green" | "orange" | "grey" | "red"> = {
    "event-received": "blue",
    "task-created": "green",
    "task-started": "green",
    "task-completed": "green",
    "task-failed": "red",
    "project-created": "blue",
    "project-closed": "grey",
    "project-reopened": "orange",
    "event-ignored": "grey",
    "manager-evaluated": "blue",
    "manager-escalation": "orange",
    "manager-no-decision": "grey",
    "manager-skipped": "grey",
    "manager-error": "red",
    "pipeline-error": "red",
    "task-awaiting-input": "orange",
};

const ALL_ENTRY_TYPES = Object.keys(ENTRY_TYPE_COLORS);

export function ActivityLogPage() {
    const navigate = useNavigate();
    const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [loading, setLoading] = useState(true);

    // Committed filter values (drive the API call)
    const [filterEventId, setFilterEventId] = useState("");
    const [filterSummary, setFilterSummary] = useState("");
    const [filterProjectId, setFilterProjectId] = useState("");
    const [filterEntryTypes, setFilterEntryTypes] = useState<string[]>([]);
    // Input values (updated on every keystroke, committed on Enter/blur)
    const [inputEventId, setInputEventId] = useState("");
    const [inputSummary, setInputSummary] = useState("");
    const [inputProjectId, setInputProjectId] = useState("");
    const [isTypeSelectOpen, setIsTypeSelectOpen] = useState(false);

    // Execution log modal state
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logProjectId, setLogProjectId] = useState<number | null>(null);
    const [logTaskId, setLogTaskId] = useState<number | null>(null);
    const [logActivityId, setLogActivityId] = useState<number | null>(null);

    const handleViewTaskLog = (projectId: number, taskId: number) => {
        setLogProjectId(projectId);
        setLogTaskId(taskId);
        setLogActivityId(null);
        setIsLogModalOpen(true);
    };

    const handleViewActivityLog = (activityId: number) => {
        setLogProjectId(null);
        setLogTaskId(null);
        setLogActivityId(activityId);
        setIsLogModalOpen(true);
    };

    const loadData = useCallback(() => {
        setLoading(true);
        fetchActivityLog(
            page, perPage,
            filterEventId ? Number(filterEventId) : undefined,
            filterSummary || undefined,
            filterProjectId ? Number(filterProjectId) : undefined,
            filterEntryTypes.length > 0 ? filterEntryTypes.join(",") : undefined
        )
            .then((results) => {
                setEntries(results.items);
                setTotalCount(results.totalCount);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [page, perPage, filterEventId, filterSummary, filterProjectId, filterEntryTypes]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const hasActiveFilters = filterEventId || filterSummary || filterProjectId || filterEntryTypes.length > 0;

    const applyFilters = () => {
        setFilterEventId(inputEventId);
        setFilterSummary(inputSummary);
        setFilterProjectId(inputProjectId);
        setPage(1);
    };

    const clearFilters = () => {
        setInputEventId("");
        setInputSummary("");
        setInputProjectId("");
        setFilterEventId("");
        setFilterSummary("");
        setFilterProjectId("");
        setFilterEntryTypes([]);
        setPage(1);
    };

    const onTypeSelect = (_event: React.MouseEvent | undefined, value: string | number | undefined) => {
        const val = value as string;
        setFilterEntryTypes((prev) =>
            prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]
        );
        setPage(1);
    };

    const typeToggle = (toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
            ref={toggleRef}
            onClick={() => setIsTypeSelectOpen(!isTypeSelectOpen)}
            isExpanded={isTypeSelectOpen}
            style={{ minWidth: "180px" }}
        >
            {filterEntryTypes.length > 0
                ? `${filterEntryTypes.length} type${filterEntryTypes.length > 1 ? "s" : ""} selected`
                : "Entry Type"}
        </MenuToggle>
    );

    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">Activity Log</Title>

            <Toolbar clearAllFilters={clearFilters} style={{ marginTop: "16px" }}>
                <ToolbarContent>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by event ID"
                            placeholder="Event ID"
                            value={inputEventId}
                            onChange={(_e, v) => setInputEventId(v)}
                            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                            onBlur={applyFilters}
                            style={{ width: "120px" }}
                        />
                    </ToolbarItem>
                    <ToolbarItem>
                        <Select
                            aria-label="Filter by entry type"
                            toggle={typeToggle}
                            onSelect={onTypeSelect}
                            selected={filterEntryTypes}
                            isOpen={isTypeSelectOpen}
                            onOpenChange={setIsTypeSelectOpen}
                        >
                            {ALL_ENTRY_TYPES.map((type) => (
                                <SelectOption
                                    key={type}
                                    value={type}
                                    hasCheckbox
                                    isSelected={filterEntryTypes.includes(type)}
                                >
                                    <Label isCompact color={ENTRY_TYPE_COLORS[type] || "grey"}>
                                        {type}
                                    </Label>
                                </SelectOption>
                            ))}
                        </Select>
                    </ToolbarItem>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by summary"
                            placeholder="Summary search"
                            value={inputSummary}
                            onChange={(_e, v) => setInputSummary(v)}
                            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                            onBlur={applyFilters}
                            style={{ width: "200px" }}
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
                        <EmptyStateBody>Loading activity log...</EmptyStateBody>
                    </EmptyState>
                ) : entries.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>
                            {hasActiveFilters
                                ? "No entries match the current filters."
                                : "No activity yet."}
                        </EmptyStateBody>
                    </EmptyState>
                ) : (
                    <Table aria-label="Activity Log" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>Time</Th>
                                <Th>Event</Th>
                                <Th>Type</Th>
                                <Th>Summary</Th>
                                <Th>Project</Th>
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
                                        <Label
                                            isCompact
                                            color={ENTRY_TYPE_COLORS[entry.entryType] || "grey"}
                                        >
                                            {entry.entryType}
                                        </Label>
                                    </Td>
                                    <Td>
                                        {entry.summary}
                                        {(entry.entryType === "task-completed" || entry.entryType === "task-failed")
                                                && entry.projectId && entry.taskId && (
                                            <>
                                                {" — "}
                                                <Button variant="link" isInline
                                                    onClick={() => handleViewTaskLog(entry.projectId!, entry.taskId!)}>
                                                    View Log
                                                </Button>
                                            </>
                                        )}
                                        {(entry.entryType === "manager-evaluated" || entry.entryType === "manager-error") && (
                                            <>
                                                {" — "}
                                                <Button variant="link" isInline
                                                    onClick={() => handleViewActivityLog(entry.id)}>
                                                    View Log
                                                </Button>
                                            </>
                                        )}
                                    </Td>
                                    <Td>
                                        {entry.projectId ? (
                                            <Button
                                                variant="link"
                                                isInline
                                                onClick={() =>
                                                    navigate(`/projects/${entry.projectId}`)
                                                }
                                            >
                                                Project #{entry.projectId}
                                            </Button>
                                        ) : (
                                            "—"
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
                projectId={logProjectId}
                taskId={logTaskId}
                activityId={logActivityId}
                onClose={() => setIsLogModalOpen(false)}
            />
        </PageSection>
    );
}
