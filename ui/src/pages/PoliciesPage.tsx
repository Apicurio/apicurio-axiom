import { useState, useEffect, useCallback } from "react";
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
    TextArea,
    TextInput,
    Title,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import PencilAltIcon from "@patternfly/react-icons/dist/esm/icons/pencil-alt-icon";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import {
    type Policy,
    type NewPolicy,
    fetchPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy,
} from "../config/api";

export function PoliciesPage() {
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Policy | null>(null);
    const [form, setForm] = useState<NewPolicy>({
        name: "", guideline: "", actionType: "", actorHint: "",
    });

    const load = useCallback(() => {
        setLoading(true);
        fetchPolicies().then(setPolicies).catch(console.error).finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditing(null);
        setForm({ name: "", guideline: "", actionType: "", actorHint: "" });
        setIsModalOpen(true);
    };

    const openEdit = (p: Policy) => {
        setEditing(p);
        setForm({ name: p.name, guideline: p.guideline, actionType: p.actionType || "", actorHint: p.actorHint || "" });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        const action = editing
            ? updatePolicy(editing.id, form)
            : createPolicy(form);
        action.then(() => { setIsModalOpen(false); load(); }).catch(console.error);
    };

    const handleDelete = (id: number) => {
        if (confirm("Delete this policy?")) {
            deletePolicy(id).then(load).catch(console.error);
        }
    };

    return (
        <PageSection>
            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }} alignItems={{ default: "alignItemsCenter" }}>
                <FlexItem><Title headingLevel="h1" size="lg">Policies</Title></FlexItem>
                <FlexItem><Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Create Policy</Button></FlexItem>
            </Flex>

            <div style={{ marginTop: "16px" }}>
                {loading ? (
                    <EmptyState><EmptyStateBody>Loading...</EmptyStateBody></EmptyState>
                ) : policies.length === 0 ? (
                    <EmptyState><EmptyStateBody>No policies configured.</EmptyStateBody></EmptyState>
                ) : (
                    <Table aria-label="Policies" variant="compact">
                        <Thead><Tr><Th>Name</Th><Th>Action Type</Th><Th>Actor Hint</Th><Th>Guideline</Th><Th /></Tr></Thead>
                        <Tbody>
                            {policies.map((p) => (
                                <Tr key={p.id}>
                                    <Td>{p.name}</Td>
                                    <Td>{p.actionType || "—"}</Td>
                                    <Td>{p.actorHint || "—"}</Td>
                                    <Td>{p.guideline.length > 80 ? p.guideline.substring(0, 80) + "..." : p.guideline}</Td>
                                    <Td>
                                        <Button variant="plain" onClick={() => openEdit(p)}><PencilAltIcon /></Button>
                                        <Button variant="plain" onClick={() => handleDelete(p.id)}><TrashIcon /></Button>
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} variant="medium">
                <ModalHeader title={editing ? "Edit Policy" : "Create Policy"} />
                <ModalBody>
                    <Form>
                        <FormGroup label="Name" isRequired fieldId="name">
                            <TextInput id="name" isRequired value={form.name} onChange={(_e, v) => setForm({ ...form, name: v })} />
                        </FormGroup>
                        <FormGroup label="Guideline" isRequired fieldId="guideline">
                            <TextArea id="guideline" isRequired value={form.guideline} onChange={(_e, v) => setForm({ ...form, guideline: v })} rows={6} />
                        </FormGroup>
                        <FormGroup label="Action Type" fieldId="actionType">
                            <TextInput id="actionType" value={form.actionType || ""} onChange={(_e, v) => setForm({ ...form, actionType: v })} placeholder="e.g. analyze, auto-tag" />
                        </FormGroup>
                        <FormGroup label="Actor Hint" fieldId="actorHint">
                            <TextInput id="actorHint" value={form.actorHint || ""} onChange={(_e, v) => setForm({ ...form, actorHint: v })} placeholder="e.g. claude-code-agent" />
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button variant="primary" onClick={handleSave} isDisabled={!form.name || !form.guideline}>Save</Button>
                    <Button variant="link" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                </ModalFooter>
            </Modal>
        </PageSection>
    );
}
