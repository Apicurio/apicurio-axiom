import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    Button,
    EmptyState,
    EmptyStateBody,
    Label,
    MenuToggle,
    MenuToggleElement,
    PageSection,
    Pagination,
    Select,
    SelectOption,
    TextInput,
    Title,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import BanIcon from "@patternfly/react-icons/dist/esm/icons/ban-icon";
import { type Task, fetchAllTasks, cancelTask } from "../config/api";
import { ExecutionLogModal } from "../components/ExecutionLogModal";

const STATUS_COLORS: Record<string, "blue" | "green" | "orange" | "grey" | "red"> = {
    Pending: "blue",
    InProgress: "green",
    AwaitingInput: "orange",
    Completed: "grey",
    Failed: "red",
    Cancelled: "grey",
};

const ALL_STATUSES = ["Pending", "InProgress", "AwaitingInput", "Completed", "Failed"];

export function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [loading, setLoading] = useState(true);

    // Committed filters
    const [filterActionType, setFilterActionType] = useState("");
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    // Input values
    const [inputActionType, setInputActionType] = useState("");
    const [isStatusSelectOpen, setIsStatusSelectOpen] = useState(false);

    // Execution log modal
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logProjectId, setLogProjectId] = useState<number | null>(null);
    const [logTaskId, setLogTaskId] = useState<number | null>(null);

    const loadData = useCallback(() => {
        setLoading(true);
        fetchAllTasks(
            page, perPage,
            filterActionType || undefined,
            filterStatus.length > 0 ? filterStatus.join(",") : undefined
        )
            .then((results) => {
                setTasks(results.items);
                setTotalCount(results.totalCount);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [page, perPage, filterActionType, filterStatus]);

    useEffect(() => { loadData(); }, [loadData]);

    const hasActiveFilters = filterActionType || filterStatus.length > 0;

    const applyFilters = () => {
        setFilterActionType(inputActionType);
        setPage(1);
    };

    const clearFilters = () => {
        setInputActionType("");
        setFilterActionType("");
        setFilterStatus([]);
        setPage(1);
    };

    const onStatusSelect = (_event: React.MouseEvent | undefined,
                             value: string | number | undefined) => {
        const val = value as string;
        setFilterStatus((prev) =>
            prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
        );
        setPage(1);
    };

    const statusToggle = (toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
            ref={toggleRef}
            onClick={() => setIsStatusSelectOpen(!isStatusSelectOpen)}
            isExpanded={isStatusSelectOpen}
            style={{ minWidth: "150px" }}
        >
            {filterStatus.length > 0
                ? `${filterStatus.length} status${filterStatus.length > 1 ? "es" : ""} selected`
                : "Status"}
        </MenuToggle>
    );

    const handleViewLog = (projectId: number, taskId: number) => {
        setLogProjectId(projectId);
        setLogTaskId(taskId);
        setIsLogModalOpen(true);
    };

    const handleCancel = (task: Task) => {
        if (confirm(`Cancel task #${task.id} (${task.actionType})?`)) {
            cancelTask(task.projectId, task.id)
                .then(loadData)
                .catch(console.error);
        }
    };

    const isActive = (status: string) =>
        status === "InProgress" || status === "AwaitingInput" || status === "Pending";

    return (
        <PageSection>
            <Title headingLevel="h1" size="lg" style={{ marginBottom: "16px" }}>
                Tasks
            </Title>

            <Toolbar clearAllFilters={clearFilters}>
                <ToolbarContent>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by action type"
                            placeholder="Action type"
                            value={inputActionType}
                            onChange={(_e, v) => setInputActionType(v)}
                            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                            onBlur={applyFilters}
                            style={{ width: "180px" }}
                        />
                    </ToolbarItem>
                    <ToolbarItem>
                        <Select
                            aria-label="Filter by status"
                            toggle={statusToggle}
                            onSelect={onStatusSelect}
                            selected={filterStatus}
                            isOpen={isStatusSelectOpen}
                            onOpenChange={setIsStatusSelectOpen}
                        >
                            {ALL_STATUSES.map((status) => (
                                <SelectOption key={status} value={status} hasCheckbox
                                    isSelected={filterStatus.includes(status)}>
                                    <Label isCompact color={STATUS_COLORS[status] || "grey"}>
                                        {status}
                                    </Label>
                                </SelectOption>
                            ))}
                        </Select>
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
                        <EmptyStateBody>Loading tasks...</EmptyStateBody>
                    </EmptyState>
                ) : tasks.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>
                            {hasActiveFilters
                                ? "No tasks match the current filters."
                                : "No tasks recorded yet."}
                        </EmptyStateBody>
                    </EmptyState>
                ) : (
                    <Table aria-label="Tasks" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>#</Th>
                                <Th>Action Type</Th>
                                <Th>Project</Th>
                                <Th>Status</Th>
                                <Th>Created By</Th>
                                <Th>Created</Th>
                                <Th>Completed</Th>
                                <Th />
                            </Tr>
                        </Thead>
                        <Tbody>
                            {tasks.map((task) => (
                                <Tr key={task.id}>
                                    <Td>{task.id}</Td>
                                    <Td>{task.actionType}</Td>
                                    <Td>
                                        <Link to={`/projects/${task.projectId}`}>
                                            Project #{task.projectId}
                                        </Link>
                                    </Td>
                                    <Td>
                                        <Label isCompact color={STATUS_COLORS[task.status] || "grey"}>
                                            {task.status}
                                        </Label>
                                    </Td>
                                    <Td>{task.createdBy}</Td>
                                    <Td style={{ whiteSpace: "nowrap" }}>
                                        {new Date(task.createdOn).toLocaleString()}
                                    </Td>
                                    <Td style={{ whiteSpace: "nowrap" }}>
                                        {task.completedOn
                                            ? new Date(task.completedOn).toLocaleString()
                                            : "—"}
                                    </Td>
                                    <Td>
                                        {(task.status === "Completed" || task.status === "Failed") && (
                                            <Button variant="link" isInline
                                                onClick={() => handleViewLog(task.projectId, task.id)}>
                                                View Log
                                            </Button>
                                        )}
                                        {isActive(task.status) && (
                                            <Button variant="link" isInline isDanger
                                                icon={<BanIcon />}
                                                onClick={() => handleCancel(task)}>
                                                Cancel
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
                projectId={logProjectId}
                taskId={logTaskId}
                onClose={() => setIsLogModalOpen(false)}
            />
        </PageSection>
    );
}
