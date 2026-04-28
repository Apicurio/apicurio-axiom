import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    Breadcrumb,
    BreadcrumbItem,
    Button,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    EmptyState,
    EmptyStateBody,
    Flex,
    FlexItem,
    Label,
    MenuToggle,
    MenuToggleElement,
    PageSection,
    Pagination,
    Select,
    SelectOption,
    Tab,
    TabContent,
    TabTitleText,
    Tabs,
    TextInput,
    Title,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import {
    type Actor,
    type Task,
    fetchActor,
    fetchActorTasks,
} from "../config/api";
import { ExecutionLogModal } from "../components/ExecutionLogModal";

const STATUS_COLORS: Record<string, "blue" | "green" | "orange" | "grey" | "red"> = {
    Pending: "blue",
    InProgress: "green",
    AwaitingInput: "orange",
    Completed: "grey",
    Failed: "red",
    Cancelled: "grey",
};

const TYPE_COLORS: Record<string, "blue" | "green" | "orange"> = {
    "ai-agent": "blue",
    "human": "green",
};

export function ActorDetailPage() {
    const { actorId } = useParams<{ actorId: string }>();
    const navigate = useNavigate();
    const id = Number(actorId);

    const [actor, setActor] = useState<Actor | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    // Task history state
    const [tasks, setTasks] = useState<Task[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [filterActionType, setFilterActionType] = useState("");
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    const [isStatusSelectOpen, setIsStatusSelectOpen] = useState(false);
    const [tasksLoading, setTasksLoading] = useState(false);

    // Execution log modal
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logProjectId, setLogProjectId] = useState<number | null>(null);
    const [logTaskId, setLogTaskId] = useState<number | null>(null);

    const loadActor = useCallback(() => {
        if (!id) return;
        setLoading(true);
        fetchActor(id)
            .then(setActor)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    const loadTasks = useCallback(() => {
        if (!id) return;
        setTasksLoading(true);
        fetchActorTasks(
            id, page, perPage,
            filterActionType || undefined,
            filterStatus.length > 0 ? filterStatus.join(",") : undefined
        )
            .then((results) => {
                setTasks(results.items);
                setTotalCount(results.totalCount);
            })
            .catch(console.error)
            .finally(() => setTasksLoading(false));
    }, [id, page, perPage, filterActionType, filterStatus]);

    useEffect(() => { loadActor(); }, [loadActor]);
    useEffect(() => { loadTasks(); }, [loadTasks]);

    const handleViewLog = (projectId: number, taskId: number) => {
        setLogProjectId(projectId);
        setLogTaskId(taskId);
        setIsLogModalOpen(true);
    };

    if (loading) {
        return (
            <PageSection>
                <EmptyState><EmptyStateBody>Loading actor...</EmptyStateBody></EmptyState>
            </PageSection>
        );
    }

    if (!actor) {
        return (
            <PageSection>
                <EmptyState><EmptyStateBody>Actor not found.</EmptyStateBody></EmptyState>
            </PageSection>
        );
    }

    return (
        <PageSection>
            <Breadcrumb style={{ marginBottom: "16px" }}>
                <BreadcrumbItem><Link to="/actors">Actors</Link></BreadcrumbItem>
                <BreadcrumbItem isActive>{actor.name}</BreadcrumbItem>
            </Breadcrumb>

            <Flex
                justifyContent={{ default: "justifyContentSpaceBetween" }}
                alignItems={{ default: "alignItemsCenter" }}
                style={{ marginBottom: "16px" }}
            >
                <FlexItem>
                    <Title headingLevel="h1" size="lg">{actor.name}</Title>
                </FlexItem>
                <FlexItem>
                    <Label color={TYPE_COLORS[actor.type] || "grey"}>{actor.type}</Label>
                </FlexItem>
            </Flex>

            <Tabs activeKey={activeTab} onSelect={(_e, k) => setActiveTab(k as number)}>
                <Tab eventKey={0} title={<TabTitleText>Info</TabTitleText>}>
                    <TabContent id="info-tab" eventKey={0} activeKey={activeTab}
                        style={{ marginTop: "24px" }}>
                        <InfoTab actor={actor} />
                    </TabContent>
                </Tab>
                <Tab eventKey={1} title={<TabTitleText>Task History ({totalCount})</TabTitleText>}>
                    <TabContent id="tasks-tab" eventKey={1} activeKey={activeTab}
                        style={{ marginTop: "16px" }}>
                        <TaskHistoryTab
                            tasks={tasks}
                            totalCount={totalCount}
                            page={page}
                            perPage={perPage}
                            filterActionType={filterActionType}
                            filterStatus={filterStatus}
                            isStatusSelectOpen={isStatusSelectOpen}
                            loading={tasksLoading}
                            onSetPage={setPage}
                            onSetPerPage={(pp) => { setPerPage(pp); setPage(1); }}
                            onFilterActionType={(v) => { setFilterActionType(v); setPage(1); }}
                            onFilterStatus={setFilterStatus}
                            onStatusSelectToggle={setIsStatusSelectOpen}
                            onRefresh={loadTasks}
                            onViewLog={handleViewLog}
                        />
                    </TabContent>
                </Tab>
            </Tabs>

            <ExecutionLogModal
                isOpen={isLogModalOpen}
                projectId={logProjectId}
                taskId={logTaskId}
                onClose={() => setIsLogModalOpen(false)}
            />
        </PageSection>
    );
}

function InfoTab({ actor }: { actor: Actor }) {
    return (
        <DescriptionList isHorizontal style={{ maxWidth: "600px" }}>
            <DescriptionListGroup>
                <DescriptionListTerm>Name</DescriptionListTerm>
                <DescriptionListDescription>{actor.name}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
                <DescriptionListTerm>Type</DescriptionListTerm>
                <DescriptionListDescription>
                    <Label color={actor.type === "ai-agent" ? "blue" : "green"}>
                        {actor.type}
                    </Label>
                </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
                <DescriptionListTerm>Description</DescriptionListTerm>
                <DescriptionListDescription>
                    {actor.description || "—"}
                </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
                <DescriptionListTerm>Capabilities</DescriptionListTerm>
                <DescriptionListDescription>
                    {actor.capabilities && actor.capabilities.length > 0
                        ? actor.capabilities.map((c) => (
                            <Label key={c} isCompact style={{ marginRight: "4px" }}>{c}</Label>
                        ))
                        : "—"}
                </DescriptionListDescription>
            </DescriptionListGroup>
        </DescriptionList>
    );
}

function TaskHistoryTab({ tasks, totalCount, page, perPage, filterActionType, filterStatus,
        isStatusSelectOpen, loading, onSetPage, onSetPerPage, onFilterActionType,
        onFilterStatus, onStatusSelectToggle, onRefresh, onViewLog }: {
    tasks: Task[];
    totalCount: number;
    page: number;
    perPage: number;
    filterActionType: string;
    filterStatus: string[];
    isStatusSelectOpen: boolean;
    loading: boolean;
    onSetPage: (p: number) => void;
    onSetPerPage: (pp: number) => void;
    onFilterActionType: (v: string) => void;
    onFilterStatus: (v: string[]) => void;
    onStatusSelectToggle: (open: boolean) => void;
    onRefresh: () => void;
    onViewLog: (projectId: number, taskId: number) => void;
}) {
    const hasActiveFilters = filterActionType || filterStatus.length > 0;

    const clearFilters = () => {
        onFilterActionType("");
        onFilterStatus([]);
    };

    const onStatusSelect = (_event: React.MouseEvent | undefined,
                             value: string | number | undefined) => {
        const val = value as string;
        onFilterStatus(
            filterStatus.includes(val)
                ? filterStatus.filter((s) => s !== val)
                : [...filterStatus, val]
        );
        onSetPage(1);
    };

    const statusToggle = (toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
            ref={toggleRef}
            onClick={() => onStatusSelectToggle(!isStatusSelectOpen)}
            isExpanded={isStatusSelectOpen}
            style={{ minWidth: "150px" }}
        >
            {filterStatus.length > 0
                ? `${filterStatus.length} status${filterStatus.length > 1 ? "es" : ""} selected`
                : "Status"}
        </MenuToggle>
    );

    return (
        <div>
            <Toolbar clearAllFilters={clearFilters}>
                <ToolbarContent>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by action type"
                            placeholder="Action type"
                            value={filterActionType}
                            onChange={(_e, v) => onFilterActionType(v)}
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
                            onOpenChange={onStatusSelectToggle}
                        >
                            {["Pending", "InProgress", "AwaitingInput", "Completed", "Failed"].map(
                                (status) => (
                                    <SelectOption key={status} value={status} hasCheckbox
                                        isSelected={filterStatus.includes(status)}>
                                        <Label isCompact color={STATUS_COLORS[status] || "grey"}>
                                            {status}
                                        </Label>
                                    </SelectOption>
                                )
                            )}
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
                        <Button variant="plain" aria-label="Refresh" onClick={onRefresh}>
                            <SyncAltIcon />
                        </Button>
                    </ToolbarItem>
                    <ToolbarItem variant="pagination" align={{ default: "alignEnd" }}>
                        <Pagination
                            itemCount={totalCount}
                            page={page}
                            perPage={perPage}
                            onSetPage={(_e, p) => onSetPage(p)}
                            onPerPageSelect={(_e, pp) => onSetPerPage(pp)}
                            isCompact
                        />
                    </ToolbarItem>
                </ToolbarContent>
            </Toolbar>

            {loading ? (
                <EmptyState>
                    <EmptyStateBody>Loading tasks...</EmptyStateBody>
                </EmptyState>
            ) : tasks.length === 0 ? (
                <EmptyState>
                    <EmptyStateBody>
                        {hasActiveFilters
                            ? "No tasks match the current filters."
                            : "No tasks have been assigned to this actor yet."}
                    </EmptyStateBody>
                </EmptyState>
            ) : (
                <Table aria-label="Actor Tasks" variant="compact">
                    <Thead>
                        <Tr>
                            <Th>Action Type</Th>
                            <Th>Project</Th>
                            <Th>Status</Th>
                            <Th>Created</Th>
                            <Th>Completed</Th>
                            <Th />
                        </Tr>
                    </Thead>
                    <Tbody>
                        {tasks.map((task) => (
                            <Tr key={task.id}>
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
                                            onClick={() => onViewLog(task.projectId, task.id)}>
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
    );
}
