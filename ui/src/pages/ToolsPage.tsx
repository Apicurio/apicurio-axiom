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
    Pagination,
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
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");

    const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

    const [filterDraft, setFilterDraft] = useState("");
    const [filterApplied, setFilterApplied] = useState("");
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);

    const load = useCallback(() => {
        setLoading(true);
        fetchTools(page, perPage, filterApplied || undefined)
            .then((results) => {
                setTools(results.items);
                setTotalCount(results.totalCount);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [page, perPage, filterApplied]);

    useEffect(() => { load(); }, [load]);

    const applyFilter = () => {
        if (filterDraft !== filterApplied) {
            setFilterApplied(filterDraft);
            setPage(1);
        }
    };

    const handleFilterKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            applyFilter();
        }
    };

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
        setDeleteTarget(id);
    };

    const confirmDelete = () => {
        if (deleteTarget !== null) {
            deleteTool(deleteTarget).then(load).catch(console.error);
            setDeleteTarget(null);
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

            <Toolbar style={{ marginTop: "16px" }}>
                <ToolbarContent>
                    <ToolbarItem style={{ maxWidth: "400px", flex: 1 }}>
                        <TextInput
                            placeholder="Filter by name or description..."
                            value={filterDraft}
                            onChange={(_e, v) => setFilterDraft(v)}
                            onKeyDown={handleFilterKeyDown}
                            onBlur={applyFilter}
                            aria-label="Filter tools"
                        />
                    </ToolbarItem>
                    {filterApplied && (
                        <ToolbarItem>
                            <Button variant="link" icon={<TimesIcon />} onClick={() => {
                                setFilterDraft("");
                                setFilterApplied("");
                                setPage(1);
                            }}>
                                Clear filters
                            </Button>
                        </ToolbarItem>
                    )}
                    <ToolbarItem variant="separator" />
                    <ToolbarItem>
                        <Button variant="plain" aria-label="Refresh" onClick={load}>
                            <SyncAltIcon />
                        </Button>
                    </ToolbarItem>
                </ToolbarContent>
            </Toolbar>

            <div>
                {loading ? (
                    <EmptyState><EmptyStateBody>Loading...</EmptyStateBody></EmptyState>
                ) : tools.length === 0 ? (
                    <EmptyState><EmptyStateBody>
                        {filterApplied
                            ? "No tools match the current filter."
                            : "No tools defined. Create a tool to provide custom capabilities to AI agents."}
                    </EmptyStateBody></EmptyState>
                ) : (
                    <>
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
                        {totalCount > perPage && (
                            <Pagination
                                itemCount={totalCount}
                                perPage={perPage}
                                page={page}
                                onSetPage={(_e, p) => setPage(p)}
                                onPerPageSelect={(_e, pp) => { setPerPage(pp); setPage(1); }}
                                variant="bottom"
                                style={{ marginTop: "8px" }}
                            />
                        )}
                    </>
                )}
            </div>

            <Modal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} variant="small">
                <ModalHeader title="Delete Tool" />
                <ModalBody>
                    Delete this tool?
                </ModalBody>
                <ModalFooter>
                    <Button variant="danger" onClick={confirmDelete}>
                        Delete
                    </Button>
                    <Button variant="link" onClick={() => setDeleteTarget(null)}>
                        Cancel
                    </Button>
                </ModalFooter>
            </Modal>

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
