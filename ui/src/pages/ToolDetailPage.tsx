import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
    Breadcrumb,
    BreadcrumbItem,
    Button,
    EmptyState,
    EmptyStateBody,
    Flex,
    FlexItem,
    Form,
    FormGroup,
    FormSelect,
    FormSelectOption,
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
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import SaveIcon from "@patternfly/react-icons/dist/esm/icons/save-icon";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import MagicIcon from "@patternfly/react-icons/dist/esm/icons/magic-icon";
import {
    type ToolDefinition,
    type ToolParameter,
    type NewToolDefinition,
    fetchTool,
    updateTool,
} from "../config/api";
import { ToolAiPanel } from "../components/ToolAiPanel";

export function ToolDetailPage() {
    const { toolId } = useParams<{ toolId: string }>();
    const id = Number(toolId);

    const [tool, setTool] = useState<ToolDefinition | null>(null);
    const [form, setForm] = useState<NewToolDefinition>({ name: "", type: "script" });
    const [params, setParams] = useState<ToolParameter[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [aiPanelOpen, setAiPanelOpen] = useState(false);

    // Warn on browser close/refresh with unsaved changes
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (dirty) {
                e.preventDefault();
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [dirty]);

    const loadData = useCallback(() => {
        if (!id) return;
        setLoading(true);
        fetchTool(id)
            .then((t) => {
                setTool(t);
                setForm({
                    name: t.name, description: t.description, type: t.type,
                    scriptTemplate: t.scriptTemplate,
                    serverCommand: t.serverCommand, serverUrl: t.serverUrl,
                    serverArgs: t.serverArgs, serverEnv: t.serverEnv,
                });
                setParams(t.parameters || []);
                setDirty(false);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => { loadData(); }, [loadData]);

    const updateForm = (updates: Partial<NewToolDefinition>) => {
        setForm((prev) => ({ ...prev, ...updates }));
        setDirty(true);
    };

    const handleSave = () => {
        setSaving(true);
        const data = { ...form, parameters: params };
        updateTool(id, data)
            .then((updated) => {
                setTool(updated);
                setDirty(false);
            })
            .catch(console.error)
            .finally(() => setSaving(false));
    };

    const addParam = () => {
        setParams([...params, { name: "", type: "string", description: "", required: true }]);
        setDirty(true);
    };

    const updateParam = (index: number, updates: Partial<ToolParameter>) => {
        setParams(params.map((p, i) => i === index ? { ...p, ...updates } : p));
        setDirty(true);
    };

    const removeParam = (index: number) => {
        setParams(params.filter((_, i) => i !== index));
        setDirty(true);
    };

    if (loading) {
        return (
            <PageSection>
                <EmptyState><EmptyStateBody>Loading tool...</EmptyStateBody></EmptyState>
            </PageSection>
        );
    }

    if (!tool) {
        return (
            <PageSection>
                <EmptyState><EmptyStateBody>Tool not found.</EmptyStateBody></EmptyState>
            </PageSection>
        );
    }

    return (
        <PageSection>
            <Breadcrumb style={{ marginBottom: "16px" }}>
                <BreadcrumbItem><Link to="/tools">Tools</Link></BreadcrumbItem>
                <BreadcrumbItem isActive>{tool.name}</BreadcrumbItem>
            </Breadcrumb>

            <Flex
                justifyContent={{ default: "justifyContentSpaceBetween" }}
                alignItems={{ default: "alignItemsCenter" }}
                style={{ marginBottom: "16px" }}
            >
                <FlexItem>
                    <Title headingLevel="h1" size="lg">{tool.name}</Title>
                </FlexItem>
                <FlexItem>
                    <Button
                        variant="primary" icon={<SaveIcon />}
                        onClick={handleSave}
                        isDisabled={!dirty || !form.name || saving}
                        isLoading={saving}
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                        variant={aiPanelOpen ? "secondary" : "tertiary"}
                        icon={<MagicIcon />}
                        onClick={() => setAiPanelOpen(!aiPanelOpen)}
                        style={{ marginLeft: "8px" }}
                    >
                        AI Assistant
                    </Button>
                </FlexItem>
            </Flex>

            <div style={{ display: "flex", gap: "0", minHeight: "500px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Tabs activeKey={activeTab} onSelect={(_e, k) => setActiveTab(k as number)}>
                        <Tab eventKey={0} title={<TabTitleText>Info</TabTitleText>}>
                            <TabContent id="info-tab" eventKey={0} activeKey={activeTab} style={{ marginTop: "24px" }}>
                                <InfoTab form={form} updateForm={updateForm} />
                            </TabContent>
                        </Tab>
                        <Tab eventKey={1} title={<TabTitleText>Parameters ({params.length})</TabTitleText>}>
                            <TabContent id="params-tab" eventKey={1} activeKey={activeTab} style={{ marginTop: "24px" }}>
                                <ParametersTab
                                    params={params}
                                    addParam={addParam}
                                    updateParam={updateParam}
                                    removeParam={removeParam}
                                />
                            </TabContent>
                        </Tab>
                        <Tab eventKey={2} title={<TabTitleText>Script Template</TabTitleText>}>
                            <TabContent id="script-tab" eventKey={2} activeKey={activeTab} style={{ marginTop: "24px" }}>
                                <ScriptTemplateTab
                                    value={form.scriptTemplate || ""}
                                    onChange={(v) => updateForm({ scriptTemplate: v })}
                                />
                            </TabContent>
                        </Tab>
                    </Tabs>
                </div>
                {aiPanelOpen && (
                    <ToolAiPanel
                        form={form}
                        params={params}
                        onUpdate={(updates, newParams) => {
                            setForm((prev) => ({ ...prev, ...updates }));
                            setParams(newParams);
                            setDirty(true);
                        }}
                        onClose={() => setAiPanelOpen(false)}
                    />
                )}
            </div>
        </PageSection>
    );
}

function InfoTab({ form, updateForm }: {
    form: NewToolDefinition;
    updateForm: (updates: Partial<NewToolDefinition>) => void;
}) {
    return (
        <Form style={{ maxWidth: "600px" }}>
            <FormGroup label="Name" isRequired fieldId="name">
                <TextInput id="name" isRequired value={form.name}
                    onChange={(_e, v) => updateForm({ name: v })} />
            </FormGroup>

            <FormGroup label="Description" fieldId="description">
                <TextArea id="description" value={form.description || ""}
                    onChange={(_e, v) => updateForm({ description: v })} rows={3} />
            </FormGroup>
        </Form>
    );
}

function ParametersTab({ params, addParam, updateParam, removeParam }: {
    params: ToolParameter[];
    addParam: () => void;
    updateParam: (index: number, updates: Partial<ToolParameter>) => void;
    removeParam: (index: number) => void;
}) {
    return (
        <div style={{ maxWidth: "800px" }}>
            <p style={{ color: "#6a6e73", marginBottom: "16px" }}>
                Define the parameters the AI agent will provide when calling this tool.
                Use <code>{"{{param_name}}"}</code> in the script template to substitute values.
            </p>

            {params.length > 0 && (
                <Table aria-label="Parameters" variant="compact">
                    <Thead>
                        <Tr>
                            <Th>Name</Th>
                            <Th>Type</Th>
                            <Th>Description</Th>
                            <Th>Required</Th>
                            <Th />
                        </Tr>
                    </Thead>
                    <Tbody>
                        {params.map((p, i) => (
                            <Tr key={i}>
                                <Td>
                                    <TextInput value={p.name}
                                        onChange={(_e, v) => updateParam(i, { name: v })}
                                        placeholder="param_name" />
                                </Td>
                                <Td>
                                    <FormSelect value={p.type}
                                        onChange={(_e, v) => updateParam(i, { type: v })}>
                                        <FormSelectOption value="string" label="string" />
                                        <FormSelectOption value="number" label="number" />
                                        <FormSelectOption value="boolean" label="boolean" />
                                    </FormSelect>
                                </Td>
                                <Td>
                                    <TextInput value={p.description || ""}
                                        onChange={(_e, v) => updateParam(i, { description: v })}
                                        placeholder="Description" />
                                </Td>
                                <Td>
                                    <input type="checkbox" checked={p.required || false}
                                        onChange={(e) => updateParam(i, { required: e.target.checked })} />
                                </Td>
                                <Td>
                                    <Button variant="plain" size="sm" onClick={() => removeParam(i)}>
                                        <TimesIcon />
                                    </Button>
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            )}

            <Button variant="link" icon={<PlusCircleIcon />} onClick={addParam}
                style={{ marginTop: "8px" }}>
                Add Parameter
            </Button>
        </div>
    );
}

function ScriptTemplateTab({ value, onChange }: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <p style={{ color: "#6a6e73", marginBottom: "16px" }}>
                Bash script to execute when the tool is called. Supports multi-line scripts
                with variables, pipes, and control flow.
                Use <code>{"{{param_name}}"}</code> for parameter substitution.
                Use <code>{"{{param_name_file}}"}</code> to write the value to a temp file
                and substitute the file path (useful for long text like comment bodies).
            </p>
            <CodeEditor
                code={value}
                onCodeChange={(v) => onChange(v)}
                language={Language.shell}
                height="400px"
                isLineNumbersVisible
            />
        </div>
    );
}
