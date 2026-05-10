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
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    PageSection,
    TextInput,
    Title,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import {
    type ToolDefinition,
    type NewToolDefinition,
    fetchTools,
    createTool,
    deleteTool,
} from "../config/api";

export function ToolsPage() {
    const navigate = useNavigate();
    const [tools, setTools] = useState<ToolDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        fetchTools().then(setTools).catch(console.error).finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreate = () => {
        const data: NewToolDefinition = {
            name: newName,
        };
        createTool(data)
            .then((created) => {
                setIsCreateOpen(false);
                setNewName("");
                navigate(`/tools/${created.id}`);
            })
            .catch(console.error);
    };

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm("Delete this tool?")) {
            deleteTool(id).then(load).catch(console.error);
        }
    };

    return (
        <PageSection>
            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }} alignItems={{ default: "alignItemsCenter" }}>
                <FlexItem><Title headingLevel="h1" size="lg">Tools</Title></FlexItem>
                <FlexItem>
                    <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => {
                        setNewName("");
                        setIsCreateOpen(true);
                    }}>
                        Create Tool
                    </Button>
                </FlexItem>
            </Flex>

            <div style={{ marginTop: "16px" }}>
                {loading ? (
                    <EmptyState><EmptyStateBody>Loading...</EmptyStateBody></EmptyState>
                ) : tools.length === 0 ? (
                    <EmptyState><EmptyStateBody>No tools defined. Create a tool to provide custom capabilities to AI agents.</EmptyStateBody></EmptyState>
                ) : (
                    <Table aria-label="Tools" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>Name</Th>
                                <Th>Description</Th>
                                <Th />
                            </Tr>
                        </Thead>
                        <Tbody>
                            {tools.map((tool) => (
                                <Tr
                                    key={tool.id}
                                    isClickable
                                    onRowClick={() => navigate(`/tools/${tool.id}`)}
                                >
                                    <Td>{tool.name}</Td>
                                    <Td>{tool.description || "—"}</Td>
                                    <Td>
                                        <Button variant="plain" size="sm" style={{ padding: 0 }}
                                            onClick={(e) => handleDelete(e, tool.id)}>
                                            <TrashIcon />
                                        </Button>
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </div>

            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} variant="small">
                <ModalHeader title="Create Tool" />
                <ModalBody>
                    <Form>
                        <FormGroup label="Name" isRequired fieldId="name">
                            <TextInput
                                id="name"
                                isRequired
                                value={newName}
                                onChange={(_e, v) => setNewName(v)}
                                placeholder="e.g. post_github_comment"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && newName.trim()) {
                                        e.preventDefault();
                                        handleCreate();
                                    }
                                }}
                            />
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button variant="primary" onClick={handleCreate} isDisabled={!newName.trim()}>
                        Create
                    </Button>
                    <Button variant="link" onClick={() => setIsCreateOpen(false)}>
                        Cancel
                    </Button>
                </ModalFooter>
            </Modal>
        </PageSection>
    );
}
