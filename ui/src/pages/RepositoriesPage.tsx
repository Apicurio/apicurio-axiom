import { useState, useEffect, useCallback } from "react";
import {
    Button,
    Checkbox,
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
    TextInput,
    Title,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import PencilAltIcon from "@patternfly/react-icons/dist/esm/icons/pencil-alt-icon";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import {
    type Repository,
    type NewRepository,
    fetchRepositories,
    createRepository,
    updateRepository,
    deleteRepository,
} from "../config/api";

export function RepositoriesPage() {
    const [repos, setRepos] = useState<Repository[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Repository | null>(null);
    const [form, setForm] = useState<NewRepository>({
        name: "", owner: "", source: "github", url: "",
    });

    const load = useCallback(() => {
        setLoading(true);
        fetchRepositories().then(setRepos).catch(console.error).finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditing(null);
        setForm({ name: "", owner: "", source: "github", url: "" });
        setIsModalOpen(true);
    };

    const openEdit = (r: Repository) => {
        setEditing(r);
        setForm({
            name: r.name, owner: r.owner, source: r.source, url: r.url,
            pollInterval: r.pollInterval, webhookSecret: r.webhookSecret,
            pollingEnabled: r.pollingEnabled,
        });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        const action = editing ? updateRepository(editing.id, form) : createRepository(form);
        action.then(() => { setIsModalOpen(false); load(); }).catch(console.error);
    };

    const handleDelete = (id: number) => {
        if (confirm("Delete this repository?")) {
            deleteRepository(id).then(load).catch(console.error);
        }
    };

    return (
        <PageSection>
            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }} alignItems={{ default: "alignItemsCenter" }}>
                <FlexItem><Title headingLevel="h1" size="lg">Repositories</Title></FlexItem>
                <FlexItem><Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Repository</Button></FlexItem>
            </Flex>

            <div style={{ marginTop: "16px" }}>
                {loading ? (
                    <EmptyState><EmptyStateBody>Loading...</EmptyStateBody></EmptyState>
                ) : repos.length === 0 ? (
                    <EmptyState><EmptyStateBody>No monitored repositories.</EmptyStateBody></EmptyState>
                ) : (
                    <Table aria-label="Repositories" variant="compact">
                        <Thead><Tr><Th>Name</Th><Th>Owner</Th><Th>Source</Th><Th>Polling</Th><Th>URL</Th><Th /></Tr></Thead>
                        <Tbody>
                            {repos.map((r) => (
                                <Tr key={r.id}>
                                    <Td>{r.name}</Td>
                                    <Td>{r.owner}</Td>
                                    <Td><Label isCompact>{r.source}</Label></Td>
                                    <Td>{r.pollingEnabled ? <Label isCompact color="green">On</Label> : <Label isCompact color="grey">Off</Label>}</Td>
                                    <Td>{r.url}</Td>
                                    <Td>
                                        <Button variant="plain" onClick={() => openEdit(r)}><PencilAltIcon /></Button>
                                        <Button variant="plain" onClick={() => handleDelete(r.id)}><TrashIcon /></Button>
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} variant="medium">
                <ModalHeader title={editing ? "Edit Repository" : "Add Repository"} />
                <ModalBody>
                    <Form>
                        <FormGroup label="Owner" isRequired fieldId="owner">
                            <TextInput id="owner" isRequired value={form.owner} onChange={(_e, v) => setForm({ ...form, owner: v })} placeholder="e.g. Apicurio" />
                        </FormGroup>
                        <FormGroup label="Name" isRequired fieldId="name">
                            <TextInput id="name" isRequired value={form.name} onChange={(_e, v) => setForm({ ...form, name: v })} placeholder="e.g. apicurio-axiom" />
                        </FormGroup>
                        <FormGroup label="Source" isRequired fieldId="source">
                            <FormSelect id="source" value={form.source} onChange={(_e, v) => setForm({ ...form, source: v })}>
                                <FormSelectOption value="github" label="GitHub" />
                                <FormSelectOption value="jira" label="Jira" />
                            </FormSelect>
                        </FormGroup>
                        <FormGroup label="URL" isRequired fieldId="url">
                            <TextInput id="url" isRequired value={form.url} onChange={(_e, v) => setForm({ ...form, url: v })} placeholder="https://github.com/owner/repo" />
                        </FormGroup>
                        <FormGroup label="Webhook Secret" fieldId="webhookSecret">
                            <TextInput id="webhookSecret" value={form.webhookSecret || ""} onChange={(_e, v) => setForm({ ...form, webhookSecret: v })} type="password" />
                        </FormGroup>
                        <FormGroup label="Poll Interval (seconds)" fieldId="pollInterval">
                            <TextInput id="pollInterval" type="number" value={form.pollInterval?.toString() || ""} onChange={(_e, v) => setForm({ ...form, pollInterval: v ? parseInt(v) : undefined })} />
                        </FormGroup>
                        <FormGroup fieldId="pollingEnabled">
                            <Checkbox id="pollingEnabled" label="Enable polling" isChecked={form.pollingEnabled || false} onChange={(_e, v) => setForm({ ...form, pollingEnabled: v })} />
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button variant="primary" onClick={handleSave} isDisabled={!form.name || !form.owner || !form.url}>Save</Button>
                    <Button variant="link" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                </ModalFooter>
            </Modal>
        </PageSection>
    );
}
