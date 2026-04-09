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
    type ActionType,
    type NewActionType,
    fetchActionTypes,
    createActionType,
    updateActionType,
    deleteActionType,
} from "../config/api";

export function ActionTypesPage() {
    const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<ActionType | null>(null);
    const [form, setForm] = useState<NewActionType>({
        name: "", executionMode: "actor", userTriggerable: false, emitsEvent: true,
    });

    const load = useCallback(() => {
        setLoading(true);
        fetchActionTypes().then(setActionTypes).catch(console.error).finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditing(null);
        setForm({ name: "", executionMode: "actor", userTriggerable: false, emitsEvent: true });
        setIsModalOpen(true);
    };

    const openEdit = (at: ActionType) => {
        setEditing(at);
        setForm({
            name: at.name, description: at.description, executionMode: at.executionMode,
            userTriggerable: at.userTriggerable, emitsEvent: at.emitsEvent,
            inputSchema: at.inputSchema, toolConstraints: at.toolConstraints,
        });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        const action = editing ? updateActionType(editing.id, form) : createActionType(form);
        action.then(() => { setIsModalOpen(false); load(); }).catch(console.error);
    };

    const handleDelete = (id: number) => {
        if (confirm("Delete this action type?")) {
            deleteActionType(id).then(load).catch(console.error);
        }
    };

    return (
        <PageSection>
            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }} alignItems={{ default: "alignItemsCenter" }}>
                <FlexItem><Title headingLevel="h1" size="lg">Action Types</Title></FlexItem>
                <FlexItem><Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Create Action Type</Button></FlexItem>
            </Flex>

            <div style={{ marginTop: "16px" }}>
                {loading ? (
                    <EmptyState><EmptyStateBody>Loading...</EmptyStateBody></EmptyState>
                ) : actionTypes.length === 0 ? (
                    <EmptyState><EmptyStateBody>No action types.</EmptyStateBody></EmptyState>
                ) : (
                    <Table aria-label="Action Types" variant="compact">
                        <Thead><Tr><Th>Name</Th><Th>Mode</Th><Th>User Triggerable</Th><Th>Emits Event</Th><Th>Description</Th><Th /></Tr></Thead>
                        <Tbody>
                            {actionTypes.map((at) => (
                                <Tr key={at.id}>
                                    <Td>{at.name}</Td>
                                    <Td><Label isCompact color={at.executionMode === "actor" ? "blue" : "grey"}>{at.executionMode}</Label></Td>
                                    <Td>{at.userTriggerable ? "Yes" : "No"}</Td>
                                    <Td>{at.emitsEvent ? "Yes" : "No"}</Td>
                                    <Td>{at.description || "—"}</Td>
                                    <Td>
                                        <Button variant="plain" onClick={() => openEdit(at)}><PencilAltIcon /></Button>
                                        <Button variant="plain" onClick={() => handleDelete(at.id)}><TrashIcon /></Button>
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} variant="medium">
                <ModalHeader title={editing ? "Edit Action Type" : "Create Action Type"} />
                <ModalBody>
                    <Form>
                        <FormGroup label="Name" isRequired fieldId="name">
                            <TextInput id="name" isRequired value={form.name} onChange={(_e, v) => setForm({ ...form, name: v })} />
                        </FormGroup>
                        <FormGroup label="Description" fieldId="description">
                            <TextInput id="description" value={form.description || ""} onChange={(_e, v) => setForm({ ...form, description: v })} />
                        </FormGroup>
                        <FormGroup label="Execution Mode" isRequired fieldId="executionMode">
                            <FormSelect id="executionMode" value={form.executionMode} onChange={(_e, v) => setForm({ ...form, executionMode: v })}>
                                <FormSelectOption value="actor" label="Actor" />
                                <FormSelectOption value="system" label="System" />
                            </FormSelect>
                        </FormGroup>
                        <FormGroup fieldId="flags">
                            <Checkbox id="userTriggerable" label="User triggerable" isChecked={form.userTriggerable} onChange={(_e, v) => setForm({ ...form, userTriggerable: v })} />
                            <Checkbox id="emitsEvent" label="Emits internal event on completion" isChecked={form.emitsEvent} onChange={(_e, v) => setForm({ ...form, emitsEvent: v })} />
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button variant="primary" onClick={handleSave} isDisabled={!form.name}>Save</Button>
                    <Button variant="link" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                </ModalFooter>
            </Modal>
        </PageSection>
    );
}
