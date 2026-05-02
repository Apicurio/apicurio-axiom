import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Button,
    EmptyState,
    EmptyStateBody,
    Form,
    FormGroup,
    FormSelect,
    FormSelectOption,
    Label,
    MenuToggle,
    MenuToggleElement,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    PageSection,
    Pagination,
    Select,
    SelectOption,
    TextArea,
    TextInput,
    Title,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import {
    type Project,
    type NewProject,
    fetchProjects,
    createProject,
} from "../config/api";

const STATUS_COLORS: Record<string, "blue" | "green" | "orange" | "grey"> = {
    Created: "blue",
    InProgress: "green",
    Idle: "orange",
    Completed: "grey",
};

const STATUS_LABELS: Record<string, string> = {
    Created: "Created",
    InProgress: "In Progress",
    Idle: "Idle",
    Completed: "Completed",
};

export function ProjectsPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [loading, setLoading] = useState(true);

    // Committed filter values (drive the API call)
    const [filterName, setFilterName] = useState("");
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    // Input value (updated on every keystroke, committed on Enter/blur)
    const [inputName, setInputName] = useState("");
    const [isStatusSelectOpen, setIsStatusSelectOpen] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProject, setNewProject] = useState<NewProject>({
        name: "",
        type: "other",
        issueSource: "github",
        issueRef: "",
        repository: "",
    });

    const loadProjects = useCallback(() => {
        setLoading(true);
        fetchProjects(
            page, perPage,
            filterName || undefined,
            filterStatus.length > 0 ? filterStatus.join(",") : undefined
        )
            .then((results) => {
                setProjects(results.items);
                setTotalCount(results.totalCount);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [page, perPage, filterName, filterStatus]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const hasActiveFilters = filterName || filterStatus.length > 0;

    const applyNameFilter = () => {
        setFilterName(inputName);
        setPage(1);
    };

    const clearFilters = () => {
        setInputName("");
        setFilterName("");
        setFilterStatus([]);
        setPage(1);
    };

    const onStatusSelect = (_event: React.MouseEvent | undefined, value: string | number | undefined) => {
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

    const handleCreate = () => {
        createProject(newProject)
            .then(() => {
                setIsModalOpen(false);
                setNewProject({
                    name: "",
                    type: "other",
                    issueSource: "github",
                    issueRef: "",
                    repository: "",
                });
                loadProjects();
            })
            .catch(console.error);
    };

    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">Projects</Title>

            <Toolbar clearAllFilters={clearFilters} style={{ marginTop: "16px" }}>
                <ToolbarContent>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by name or issue"
                            placeholder="Filter by name or issue"
                            value={inputName}
                            onChange={(_e, v) => setInputName(v)}
                            onKeyDown={(e) => { if (e.key === "Enter") applyNameFilter(); }}
                            onBlur={applyNameFilter}
                            style={{ width: "220px" }}
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
                            {["Created", "InProgress", "Idle", "Completed"].map((status) => (
                                <SelectOption
                                    key={status}
                                    value={status}
                                    hasCheckbox
                                    isSelected={filterStatus.includes(status)}
                                >
                                    <Label isCompact color={STATUS_COLORS[status] || "grey"}>
                                        {STATUS_LABELS[status] || status}
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
                        <Button variant="plain" aria-label="Refresh" onClick={loadProjects}>
                            <SyncAltIcon />
                        </Button>
                    </ToolbarItem>
                    <ToolbarItem>
                        <Button
                            variant="primary"
                            icon={<PlusCircleIcon />}
                            onClick={() => setIsModalOpen(true)}
                        >
                            Create Project
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
                        <EmptyStateBody>Loading projects...</EmptyStateBody>
                    </EmptyState>
                ) : projects.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>
                            {hasActiveFilters
                                ? "No projects match the current filters."
                                : "No projects yet. Create one or wait for events from a monitored repository."}
                        </EmptyStateBody>
                    </EmptyState>
                ) : (
                    <Table aria-label="Projects" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>Name</Th>
                                <Th>Status</Th>
                                <Th>Type</Th>
                                <Th>Issue</Th>
                                <Th>Repository</Th>
                                <Th>Updated</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {projects.map((project) => (
                                <Tr
                                    key={project.id}
                                    isClickable
                                    onRowClick={() => navigate(`/projects/${project.id}`)}
                                >
                                    <Td>{project.name}</Td>
                                    <Td>
                                        <Label color={STATUS_COLORS[project.status] || "grey"}>
                                            {STATUS_LABELS[project.status] || project.status}
                                        </Label>
                                    </Td>
                                    <Td>
                                        <Label isCompact>{project.type}</Label>
                                    </Td>
                                    <Td>{project.issueRef}</Td>
                                    <Td>{project.repository}</Td>
                                    <Td>{new Date(project.updatedOn).toLocaleString()}</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </div>

            {/* Create Project Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                variant="medium"
            >
                <ModalHeader title="Create Project" />
                <ModalBody>
                    <Form>
                        <FormGroup label="Name" isRequired fieldId="name">
                            <TextInput
                                id="name"
                                isRequired
                                value={newProject.name}
                                onChange={(_e, v) =>
                                    setNewProject({ ...newProject, name: v })
                                }
                            />
                        </FormGroup>
                        <FormGroup label="Description" fieldId="description">
                            <TextArea
                                id="description"
                                value={newProject.description || ""}
                                onChange={(_e, v) =>
                                    setNewProject({
                                        ...newProject,
                                        description: v,
                                    })
                                }
                            />
                        </FormGroup>
                        <FormGroup label="Type" isRequired fieldId="type">
                            <FormSelect
                                id="type"
                                value={newProject.type}
                                onChange={(_e, v) =>
                                    setNewProject({ ...newProject, type: v })
                                }
                            >
                                <FormSelectOption value="bug-fix" label="Bug Fix" />
                                <FormSelectOption value="feature" label="Feature" />
                                <FormSelectOption value="question" label="Question" />
                                <FormSelectOption value="help" label="Help" />
                                <FormSelectOption value="other" label="Other" />
                            </FormSelect>
                        </FormGroup>
                        <FormGroup label="Issue Source" isRequired fieldId="issueSource">
                            <FormSelect
                                id="issueSource"
                                value={newProject.issueSource}
                                onChange={(_e, v) =>
                                    setNewProject({
                                        ...newProject,
                                        issueSource: v,
                                    })
                                }
                            >
                                <FormSelectOption value="github" label="GitHub" />
                                <FormSelectOption value="jira" label="Jira" />
                            </FormSelect>
                        </FormGroup>
                        <FormGroup label="Issue Reference" isRequired fieldId="issueRef">
                            <TextInput
                                id="issueRef"
                                isRequired
                                placeholder="owner/repo#123"
                                value={newProject.issueRef}
                                onChange={(_e, v) =>
                                    setNewProject({
                                        ...newProject,
                                        issueRef: v,
                                    })
                                }
                            />
                        </FormGroup>
                        <FormGroup label="Repository" isRequired fieldId="repository">
                            <TextInput
                                id="repository"
                                isRequired
                                placeholder="owner/repo"
                                value={newProject.repository}
                                onChange={(_e, v) =>
                                    setNewProject({
                                        ...newProject,
                                        repository: v,
                                    })
                                }
                            />
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="primary"
                        onClick={handleCreate}
                        isDisabled={
                            !newProject.name ||
                            !newProject.issueRef ||
                            !newProject.repository
                        }
                    >
                        Create
                    </Button>
                    <Button
                        variant="link"
                        onClick={() => setIsModalOpen(false)}
                    >
                        Cancel
                    </Button>
                </ModalFooter>
            </Modal>
        </PageSection>
    );
}
