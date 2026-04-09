import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Breadcrumb,
    BreadcrumbItem,
    Button,
    Card,
    CardBody,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    EmptyState,
    EmptyStateBody,
    Flex,
    FlexItem,
    Form,
    FormGroup,
    FormSelect,
    FormSelectOption,
    Label,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    PageSection,
    Tab,
    TabContent,
    TabTitleText,
    Tabs,
    TextArea,
    Title,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import PlayIcon from "@patternfly/react-icons/dist/esm/icons/play-icon";
import {
    type ActionType,
    type Project,
    type Task,
    type ThreadEntry,
    fetchActionTypes,
    fetchProject,
    fetchProjectTasks,
    fetchThreadEntries,
    createTask,
} from "../config/api";

const STATUS_COLORS: Record<string, "blue" | "green" | "orange" | "grey" | "red"> = {
    Created: "blue",
    InProgress: "green",
    Idle: "orange",
    Completed: "grey",
    Pending: "blue",
    AwaitingInput: "orange",
    Failed: "red",
    Cancelled: "grey",
};

export function ProjectDetailPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [thread, setThread] = useState<ThreadEntry[]>([]);
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(true);

    // Trigger Action state
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
    const [selectedActionType, setSelectedActionType] = useState("");
    const [actionInput, setActionInput] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const id = Number(projectId);

    const loadData = useCallback(() => {
        if (!id) return;
        setLoading(true);
        Promise.all([
            fetchProject(id),
            fetchProjectTasks(id),
            fetchThreadEntries(id),
        ])
            .then(([p, t, th]) => {
                setProject(p);
                setTasks(t);
                setThread(th);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openActionModal = () => {
        fetchActionTypes()
            .then((types) => {
                const triggerable = types.filter(
                    (t) => t.userTriggerable && t.executionMode === "actor"
                );
                setActionTypes(triggerable);
                if (triggerable.length > 0) {
                    setSelectedActionType(triggerable[0].name);
                }
                setActionInput("");
                setIsActionModalOpen(true);
            })
            .catch(console.error);
    };

    const handleTriggerAction = () => {
        if (!selectedActionType) return;
        setSubmitting(true);
        createTask(id, {
            actionType: selectedActionType,
            input: actionInput || undefined,
        })
            .then(() => {
                setIsActionModalOpen(false);
                loadData();
            })
            .catch(console.error)
            .finally(() => setSubmitting(false));
    };

    if (loading) {
        return (
            <PageSection>
                <EmptyState>
                    <EmptyStateBody>Loading project...</EmptyStateBody>
                </EmptyState>
            </PageSection>
        );
    }

    if (!project) {
        return (
            <PageSection>
                <EmptyState>
                    <EmptyStateBody>Project not found.</EmptyStateBody>
                </EmptyState>
            </PageSection>
        );
    }

    const selectedActionDesc = actionTypes.find(
        (t) => t.name === selectedActionType
    )?.description;

    return (
        <PageSection>
            <Breadcrumb style={{ marginBottom: "16px" }}>
                <BreadcrumbItem onClick={() => navigate("/")}>
                    Dashboard
                </BreadcrumbItem>
                <BreadcrumbItem onClick={() => navigate("/projects")}>
                    Projects
                </BreadcrumbItem>
                <BreadcrumbItem isActive>{project.name}</BreadcrumbItem>
            </Breadcrumb>

            {/* Project header */}
            <Flex
                justifyContent={{ default: "justifyContentSpaceBetween" }}
                alignItems={{ default: "alignItemsCenter" }}
            >
                <FlexItem>
                    <Title headingLevel="h1" size="lg">
                        {project.name}
                    </Title>
                </FlexItem>
                <FlexItem>
                    <Button
                        variant="secondary"
                        icon={<PlayIcon />}
                        onClick={openActionModal}
                        style={{ marginRight: "8px" }}
                    >
                        Trigger Action
                    </Button>
                    <Label color={STATUS_COLORS[project.status] || "grey"}>
                        {project.status}
                    </Label>
                </FlexItem>
            </Flex>

            {/* Project metadata */}
            <Card style={{ marginTop: "16px" }}>
                <CardBody>
                    <DescriptionList isHorizontal columnModifier={{ default: "3Col" }}>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Type</DescriptionListTerm>
                            <DescriptionListDescription>
                                <Label isCompact>{project.type}</Label>
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Issue</DescriptionListTerm>
                            <DescriptionListDescription>
                                {project.issueRef}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Repository</DescriptionListTerm>
                            <DescriptionListDescription>
                                {project.repository}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Source</DescriptionListTerm>
                            <DescriptionListDescription>
                                {project.issueSource}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Created</DescriptionListTerm>
                            <DescriptionListDescription>
                                {new Date(project.createdOn).toLocaleString()}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Updated</DescriptionListTerm>
                            <DescriptionListDescription>
                                {new Date(project.updatedOn).toLocaleString()}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    </DescriptionList>
                    {project.description && (
                        <p style={{ marginTop: "12px", color: "#6a6e73" }}>
                            {project.description}
                        </p>
                    )}
                </CardBody>
            </Card>

            {/* Tabs */}
            <div style={{ marginTop: "24px" }}>
                <Tabs activeKey={activeTab} onSelect={(_e, k) => setActiveTab(k as number)}>
                    <Tab eventKey={0} title={<TabTitleText>Tasks ({tasks.length})</TabTitleText>} />
                    <Tab eventKey={1} title={<TabTitleText>Thread ({thread.length})</TabTitleText>} />
                </Tabs>

                <TabContent id="tasks-tab" eventKey={0} activeKey={activeTab} style={{ marginTop: "16px" }}>
                    <TasksTab tasks={tasks} />
                </TabContent>
                <TabContent id="thread-tab" eventKey={1} activeKey={activeTab} style={{ marginTop: "16px" }}>
                    <ThreadTab entries={thread} />
                </TabContent>
            </div>

            <div style={{ marginTop: "16px" }}>
                <Button variant="link" onClick={loadData}>
                    Refresh
                </Button>
            </div>

            {/* Trigger Action Modal */}
            <Modal
                isOpen={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                variant="medium"
            >
                <ModalHeader title="Trigger Action" />
                <ModalBody>
                    {actionTypes.length === 0 ? (
                        <EmptyState>
                            <EmptyStateBody>
                                No user-triggerable action types configured.
                            </EmptyStateBody>
                        </EmptyState>
                    ) : (
                        <Form>
                            <FormGroup label="Action Type" isRequired fieldId="actionType">
                                <FormSelect
                                    id="actionType"
                                    value={selectedActionType}
                                    onChange={(_e, v) => setSelectedActionType(v)}
                                >
                                    {actionTypes.map((at) => (
                                        <FormSelectOption
                                            key={at.name}
                                            value={at.name}
                                            label={at.name}
                                        />
                                    ))}
                                </FormSelect>
                            </FormGroup>
                            {selectedActionDesc && (
                                <p style={{ color: "#6a6e73", fontSize: "14px", marginTop: "-8px" }}>
                                    {selectedActionDesc}
                                </p>
                            )}
                            <FormGroup label="Instructions (optional)" fieldId="input">
                                <TextArea
                                    id="input"
                                    placeholder="Additional context or instructions for the actor..."
                                    value={actionInput}
                                    onChange={(_e, v) => setActionInput(v)}
                                    rows={4}
                                />
                            </FormGroup>
                        </Form>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="primary"
                        onClick={handleTriggerAction}
                        isDisabled={!selectedActionType || submitting}
                        isLoading={submitting}
                    >
                        {submitting ? "Creating..." : "Trigger"}
                    </Button>
                    <Button
                        variant="link"
                        onClick={() => setIsActionModalOpen(false)}
                    >
                        Cancel
                    </Button>
                </ModalFooter>
            </Modal>
        </PageSection>
    );
}

function TasksTab({ tasks }: { tasks: Task[] }) {
    if (tasks.length === 0) {
        return (
            <EmptyState>
                <EmptyStateBody>No tasks yet.</EmptyStateBody>
            </EmptyState>
        );
    }

    return (
        <Table aria-label="Tasks" variant="compact">
            <Thead>
                <Tr>
                    <Th>Action</Th>
                    <Th>Status</Th>
                    <Th>Created By</Th>
                    <Th>Created</Th>
                    <Th>Completed</Th>
                    <Th>Cost</Th>
                </Tr>
            </Thead>
            <Tbody>
                {tasks.map((task) => (
                    <Tr key={task.id}>
                        <Td>{task.actionType}</Td>
                        <Td>
                            <Label color={STATUS_COLORS[task.status] || "grey"}>
                                {task.status}
                            </Label>
                        </Td>
                        <Td>{task.createdBy}</Td>
                        <Td>{new Date(task.createdOn).toLocaleString()}</Td>
                        <Td>
                            {task.completedOn
                                ? new Date(task.completedOn).toLocaleString()
                                : "—"}
                        </Td>
                        <Td>
                            {task.costUsd != null
                                ? `$${task.costUsd.toFixed(4)}`
                                : "—"}
                        </Td>
                    </Tr>
                ))}
            </Tbody>
        </Table>
    );
}

function ThreadTab({ entries }: { entries: ThreadEntry[] }) {
    if (entries.length === 0) {
        return (
            <EmptyState>
                <EmptyStateBody>No conversation yet.</EmptyStateBody>
            </EmptyState>
        );
    }

    const AUTHOR_COLORS: Record<string, "blue" | "green" | "orange" | "grey"> = {
        manager: "blue",
        actor: "green",
        user: "orange",
        system: "grey",
    };

    return (
        <div>
            {entries.map((entry) => (
                <Card key={entry.id} isCompact style={{ marginBottom: "8px" }}>
                    <CardBody>
                        <Flex
                            justifyContent={{ default: "justifyContentSpaceBetween" }}
                            alignItems={{ default: "alignItemsCenter" }}
                            style={{ marginBottom: "8px" }}
                        >
                            <FlexItem>
                                <Label
                                    isCompact
                                    color={AUTHOR_COLORS[entry.authorType] || "grey"}
                                >
                                    {entry.authorType}
                                </Label>
                                <Label isCompact style={{ marginLeft: "8px" }}>
                                    {entry.entryType}
                                </Label>
                            </FlexItem>
                            <FlexItem>
                                <span style={{ fontSize: "12px", color: "#6a6e73" }}>
                                    {new Date(entry.createdOn).toLocaleString()}
                                </span>
                            </FlexItem>
                        </Flex>
                        <pre style={{
                            whiteSpace: "pre-wrap",
                            fontFamily: "inherit",
                            margin: 0,
                            fontSize: "14px",
                        }}>
                            {entry.content}
                        </pre>
                    </CardBody>
                </Card>
            ))}
        </div>
    );
}
