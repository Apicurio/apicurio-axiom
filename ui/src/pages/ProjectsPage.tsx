import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Button,
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
    TextArea,
    TextInput,
    Title,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
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
    const [loading, setLoading] = useState(true);
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
        fetchProjects()
            .then(setProjects)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

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
            <Flex
                justifyContent={{ default: "justifyContentSpaceBetween" }}
                alignItems={{ default: "alignItemsCenter" }}
            >
                <FlexItem>
                    <Title headingLevel="h1" size="lg">
                        Projects
                    </Title>
                </FlexItem>
                <FlexItem>
                    <Button
                        variant="primary"
                        icon={<PlusCircleIcon />}
                        onClick={() => setIsModalOpen(true)}
                    >
                        Create Project
                    </Button>
                </FlexItem>
            </Flex>

            <div style={{ marginTop: "16px" }}>
                {loading ? (
                    <EmptyState>
                        <EmptyStateBody>Loading projects...</EmptyStateBody>
                    </EmptyState>
                ) : projects.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>
                            No projects yet. Create one or wait for events from
                            a monitored repository.
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
                                    onRowClick={() =>
                                        navigate(`/projects/${project.id}`)
                                    }
                                >
                                    <Td>{project.name}</Td>
                                    <Td>
                                        <Label
                                            color={
                                                STATUS_COLORS[project.status] ||
                                                "grey"
                                            }
                                        >
                                            {STATUS_LABELS[project.status] ||
                                                project.status}
                                        </Label>
                                    </Td>
                                    <Td>
                                        <Label isCompact>{project.type}</Label>
                                    </Td>
                                    <Td>{project.issueRef}</Td>
                                    <Td>{project.repository}</Td>
                                    <Td>
                                        {new Date(
                                            project.updatedOn
                                        ).toLocaleString()}
                                    </Td>
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
