import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
    Breadcrumb,
    BreadcrumbItem,
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
    InputGroup,
    InputGroupItem,
    PageSection,
    Tab,
    TabContent,
    TabTitleText,
    Tabs,
    TextArea,
    TextInput,
    Title,
} from "@patternfly/react-core";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import SaveIcon from "@patternfly/react-icons/dist/esm/icons/save-icon";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import {
    type ActionType,
    type NewActionType,
    fetchActionType,
    updateActionType,
} from "../config/api";

export function ActionTypeDetailPage() {
    const { actionTypeId } = useParams<{ actionTypeId: string }>();
    const id = Number(actionTypeId);

    const [actionType, setActionType] = useState<ActionType | null>(null);
    const [form, setForm] = useState<NewActionType>({
        name: "", executionMode: "actor", userTriggerable: false, emitsEvent: true,
    });
    const [tools, setTools] = useState<string[]>([]);
    const [newTool, setNewTool] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const loadData = useCallback(() => {
        if (!id) return;
        setLoading(true);
        fetchActionType(id)
            .then((at) => {
                setActionType(at);
                setForm({
                    name: at.name,
                    description: at.description,
                    executionMode: at.executionMode,
                    userTriggerable: at.userTriggerable,
                    emitsEvent: at.emitsEvent,
                    inputSchema: at.inputSchema,
                    allowedTools: at.allowedTools,
                    promptTemplate: at.promptTemplate,
                });
                setTools(at.allowedTools || []);
                setDirty(false);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const updateForm = (updates: Partial<NewActionType>) => {
        setForm((prev) => ({ ...prev, ...updates }));
        setDirty(true);
    };

    const addTool = () => {
        const trimmed = newTool.trim();
        if (trimmed && !tools.includes(trimmed)) {
            setTools([...tools, trimmed]);
            setNewTool("");
            setDirty(true);
        }
    };

    const removeTool = (tool: string) => {
        setTools(tools.filter((t) => t !== tool));
        setDirty(true);
    };

    const handleSave = () => {
        setSaving(true);
        const data = { ...form, allowedTools: tools };
        updateActionType(id, data)
            .then((updated) => {
                setActionType(updated);
                setDirty(false);
            })
            .catch(console.error)
            .finally(() => setSaving(false));
    };

    if (loading) {
        return (
            <PageSection>
                <EmptyState>
                    <EmptyStateBody>Loading action type...</EmptyStateBody>
                </EmptyState>
            </PageSection>
        );
    }

    if (!actionType) {
        return (
            <PageSection>
                <EmptyState>
                    <EmptyStateBody>Action type not found.</EmptyStateBody>
                </EmptyState>
            </PageSection>
        );
    }

    return (
        <PageSection>
            <Breadcrumb style={{ marginBottom: "16px" }}>
                <BreadcrumbItem><Link to="/action-types">Action Types</Link></BreadcrumbItem>
                <BreadcrumbItem isActive>{actionType.name}</BreadcrumbItem>
            </Breadcrumb>

            <Flex
                justifyContent={{ default: "justifyContentSpaceBetween" }}
                alignItems={{ default: "alignItemsCenter" }}
                style={{ marginBottom: "16px" }}
            >
                <FlexItem>
                    <Title headingLevel="h1" size="lg">
                        {actionType.name}
                    </Title>
                </FlexItem>
                <FlexItem>
                    <Button
                        variant="primary"
                        icon={<SaveIcon />}
                        onClick={handleSave}
                        isDisabled={!dirty || !form.name || saving}
                        isLoading={saving}
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </FlexItem>
            </Flex>

            <Tabs activeKey={activeTab} onSelect={(_e, k) => setActiveTab(k as number)}>
                <Tab eventKey={0} title={<TabTitleText>Info</TabTitleText>}>
                    <TabContent id="info-tab" eventKey={0} activeKey={activeTab} style={{ marginTop: "24px" }}>
                        <InfoTab form={form} updateForm={updateForm} />
                    </TabContent>
                </Tab>
                <Tab eventKey={1} title={<TabTitleText>Allowed Tools ({tools.length})</TabTitleText>}>
                    <TabContent id="tools-tab" eventKey={1} activeKey={activeTab} style={{ marginTop: "24px" }}>
                        <AllowedToolsTab
                            tools={tools}
                            newTool={newTool}
                            setNewTool={setNewTool}
                            addTool={addTool}
                            removeTool={removeTool}
                        />
                    </TabContent>
                </Tab>
                <Tab eventKey={2} title={<TabTitleText>Prompt Template</TabTitleText>}>
                    <TabContent id="prompt-tab" eventKey={2} activeKey={activeTab} style={{ marginTop: "24px" }}>
                        <PromptTemplateTab
                            value={form.promptTemplate || ""}
                            onChange={(v) => updateForm({ promptTemplate: v })}
                        />
                    </TabContent>
                </Tab>
            </Tabs>
        </PageSection>
    );
}

function InfoTab({ form, updateForm }: {
    form: NewActionType;
    updateForm: (updates: Partial<NewActionType>) => void;
}) {
    return (
        <Form style={{ maxWidth: "600px" }}>
            <FormGroup label="Name" isRequired fieldId="name">
                <TextInput
                    id="name"
                    isRequired
                    value={form.name}
                    onChange={(_e, v) => updateForm({ name: v })}
                />
            </FormGroup>
            <FormGroup label="Description" fieldId="description">
                <TextArea
                    id="description"
                    value={form.description || ""}
                    onChange={(_e, v) => updateForm({ description: v })}
                    rows={3}
                />
            </FormGroup>
            <FormGroup label="Execution Mode" isRequired fieldId="executionMode">
                <FormSelect
                    id="executionMode"
                    value={form.executionMode}
                    onChange={(_e, v) => updateForm({ executionMode: v })}
                >
                    <FormSelectOption value="actor" label="Actor — executed by an AI agent or human" />
                    <FormSelectOption value="system" label="System — executed directly by the application" />
                </FormSelect>
            </FormGroup>
            <FormGroup fieldId="flags">
                <Checkbox
                    id="userTriggerable"
                    label="User triggerable — can be manually triggered from the project detail page"
                    isChecked={form.userTriggerable}
                    onChange={(_e, v) => updateForm({ userTriggerable: v })}
                />
                <Checkbox
                    id="emitsEvent"
                    label="Emits internal event on completion — allows the Manager to chain follow-up actions"
                    isChecked={form.emitsEvent}
                    onChange={(_e, v) => updateForm({ emitsEvent: v })}
                />
            </FormGroup>
        </Form>
    );
}

function AllowedToolsTab({ tools, newTool, setNewTool, addTool, removeTool }: {
    tools: string[];
    newTool: string;
    setNewTool: (v: string) => void;
    addTool: () => void;
    removeTool: (tool: string) => void;
}) {
    return (
        <div style={{ maxWidth: "700px" }}>
            <p style={{ color: "#6a6e73", marginBottom: "16px" }}>
                Define which tools the AI agent is allowed to use when performing this
                action type. Use patterns like <code>Bash(git log *)</code> to allow
                specific shell commands. Tools not in this list will be denied.
            </p>

            <InputGroup style={{ marginBottom: "16px" }}>
                <InputGroupItem isFill>
                    <TextInput
                        id="newTool"
                        value={newTool}
                        onChange={(_e, v) => setNewTool(v)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addTool();
                            }
                        }}
                        placeholder="Type a tool name and press Enter or click Add"
                    />
                </InputGroupItem>
                <InputGroupItem>
                    <Button variant="control" onClick={addTool} isDisabled={!newTool.trim()}>
                        Add
                    </Button>
                </InputGroupItem>
            </InputGroup>

            {tools.length === 0 ? (
                <EmptyState>
                    <EmptyStateBody>
                        No tools configured. The actor will use minimal read-only defaults.
                    </EmptyStateBody>
                </EmptyState>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {tools.map((tool) => (
                        <Flex
                            key={tool}
                            alignItems={{ default: "alignItemsCenter" }}
                            style={{
                                padding: "8px 12px",
                                backgroundColor: "var(--pf-t--global--background--color--secondary--default)",
                                borderRadius: "4px",
                            }}
                        >
                            <FlexItem grow={{ default: "grow" }}>
                                <code style={{ fontSize: "13px" }}>{tool}</code>
                            </FlexItem>
                            <FlexItem>
                                <Button
                                    variant="plain"
                                    size="sm"
                                    onClick={() => removeTool(tool)}
                                    aria-label={`Remove ${tool}`}
                                >
                                    <TimesIcon />
                                </Button>
                            </FlexItem>
                        </Flex>
                    ))}
                </div>
            )}
        </div>
    );
}

function PromptTemplateTab({ value, onChange }: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <p style={{ color: "#6a6e73", marginBottom: "16px" }}>
                The prompt sent to the AI agent when executing this action type.
                Supports placeholders:{" "}
                <code>{"{{managerInput}}"}</code>,{" "}
                <code>{"{{issueRef}}"}</code>,{" "}
                <code>{"{{repository}}"}</code>,{" "}
                <code>{"{{projectName}}"}</code>
            </p>
            <CodeEditor
                code={value}
                onCodeChange={(v) => onChange(v)}
                language={Language.markdown}
                height="500px"
                isLineNumbersVisible
            />
        </div>
    );
}
