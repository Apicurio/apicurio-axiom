import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
    InputGroup,
    InputGroupItem,
    Label,
    PageSection,
    Switch,
    Tab,
    TabContent,
    TabTitleText,
    Tabs,
    TextArea,
    TextInput,
    Title, Alert,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { registerPlaceholderCompletions, REPORT_PLACEHOLDERS } from "../components/PlaceholderCompletionProvider";
import { AddToolInput } from "../components/AddToolInput";
import { ReportAiModal } from "../components/ReportAiModal";
import SaveIcon from "@patternfly/react-icons/dist/esm/icons/save-icon";
import MagicIcon from "@patternfly/react-icons/dist/esm/icons/magic-icon";
import PlayIcon from "@patternfly/react-icons/dist/esm/icons/play-icon";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import {
    type ReportDefinition,
    type NewReportDefinition,
    type Report,
    fetchReportDefinition,
    updateReportDefinition,
    runReportDefinition,
    fetchReports,
} from "../config/api";

export function ReportDefinitionDetailPage() {
    const { definitionId } = useParams<{ definitionId: string }>();
    const navigate = useNavigate();
    const id = Number(definitionId);

    const [definition, setDefinition] = useState<ReportDefinition | null>(null);
    const [form, setForm] = useState<NewReportDefinition>({
        name: "", schedule: "daily", timeWindow: "last-24h", promptTemplate: "", enabled: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [repos, setRepos] = useState<string[]>([]);
    const [tools, setTools] = useState<string[]>([]);

    // Generated reports for this definition
    const [reports, setReports] = useState<Report[]>([]);
    const [reportsTotalCount, setReportsTotalCount] = useState(0);

    const loadData = useCallback(() => {
        if (!id) return;
        setLoading(true);
        Promise.all([
            fetchReportDefinition(id),
            fetchReports(1, 10, id),
        ])
            .then(([def, rpts]) => {
                setDefinition(def);
                setForm({
                    name: def.name, description: def.description,
                    schedule: def.schedule, scheduleTime: def.scheduleTime,
                    timeWindow: def.timeWindow, repositories: def.repositories,
                    promptTemplate: def.promptTemplate, enabled: def.enabled,
                });
                setRepos(def.repositories || []);
                setTools(def.allowedTools || []);
                setReports(rpts.items);
                setReportsTotalCount(rpts.totalCount);
                setDirty(false);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => { loadData(); }, [loadData]);

    const updateForm = (updates: Partial<NewReportDefinition>) => {
        setForm((prev) => ({ ...prev, ...updates }));
        setDirty(true);
    };

    const handleSave = () => {
        setSaving(true);
        const data = {
            ...form,
            repositories: repos.length > 0 ? repos : undefined,
            allowedTools: tools.length > 0 ? tools : undefined,
        };
        updateReportDefinition(id, data)
            .then((updated) => { setDefinition(updated); setDirty(false); })
            .catch(console.error)
            .finally(() => setSaving(false));
    };

    const addTool = (tool: string) => {
        if (tool && !tools.includes(tool)) {
            setTools([...tools, tool]);
            setDirty(true);
        }
    };

    const removeTool = (tool: string) => {
        setTools(tools.filter((t) => t !== tool));
        setDirty(true);
    };

    const addRepo = (repo: string) => {
        const trimmed = repo.trim();
        if (trimmed && !repos.includes(trimmed)) {
            setRepos([...repos, trimmed]);
            setDirty(true);
        }
    };

    const removeRepo = (repo: string) => {
        setRepos(repos.filter((r) => r !== repo));
        setDirty(true);
    };

    const handleRunNow = () => {
        runReportDefinition(id)
            .then((report) => navigate(`/reports/${report.id}`))
            .catch(console.error);
    };

    if (loading) {
        return (
            <PageSection>
                <EmptyState><EmptyStateBody>Loading...</EmptyStateBody></EmptyState>
            </PageSection>
        );
    }

    if (!definition) {
        return (
            <PageSection>
                <EmptyState><EmptyStateBody>Report definition not found.</EmptyStateBody></EmptyState>
            </PageSection>
        );
    }

    return (
        <PageSection>
            <Breadcrumb style={{ marginBottom: "16px" }}>
                <BreadcrumbItem><Link to="/report-definitions">Report Definitions</Link></BreadcrumbItem>
                <BreadcrumbItem isActive>{definition.name}</BreadcrumbItem>
            </Breadcrumb>

            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}
                alignItems={{ default: "alignItemsCenter" }}
                style={{ marginBottom: "16px" }}>
                <FlexItem>
                    <Title headingLevel="h1" size="lg">{definition.name}</Title>
                </FlexItem>
                <FlexItem>
                    <Button variant="secondary" icon={<PlayIcon />} onClick={handleRunNow}
                        style={{ marginRight: "8px" }}>
                        Run Now
                    </Button>
                    <Button variant="secondary" icon={<MagicIcon />}
                            onClick={() => setAiModalOpen(true)}
                            style={{ marginRight: "8px" }}>
                        AI Assistant
                    </Button>
                    <Button variant="primary" icon={<SaveIcon />} onClick={handleSave}
                        isDisabled={!dirty || !form.name || saving} isLoading={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </FlexItem>
            </Flex>

            <ReportAiModal
                isOpen={aiModalOpen}
                promptTemplate={form.promptTemplate || ""}
                allowedTools={tools}
                reportName={form.name}
                reportDescription={form.description}
                onApply={(prompt, newTools) => {
                    updateForm({ promptTemplate: prompt });
                    setTools(newTools);
                    setDirty(true);
                }}
                onClose={() => setAiModalOpen(false)}
            />

            <Tabs activeKey={activeTab} onSelect={(_e, k) => setActiveTab(k as number)}>
                <Tab eventKey={0} title={<TabTitleText>Info</TabTitleText>}>
                    <TabContent id="info-tab" eventKey={0} activeKey={activeTab}
                        style={{ marginTop: "24px" }}>
                        <InfoTab form={form} updateForm={updateForm} />
                    </TabContent>
                </Tab>
                <Tab eventKey={1} title={<TabTitleText>Repositories ({repos.length})</TabTitleText>}>
                    <TabContent id="repos-tab" eventKey={1} activeKey={activeTab}
                        style={{ marginTop: "24px" }}>
                        <RepositoriesTab repos={repos} addRepo={addRepo} removeRepo={removeRepo} />
                    </TabContent>
                </Tab>
                <Tab eventKey={2} title={<TabTitleText>Allowed Tools ({tools.length})</TabTitleText>}>
                    <TabContent id="tools-tab" eventKey={2} activeKey={activeTab}
                        style={{ marginTop: "24px" }}>
                        <AllowedToolsTab
                            tools={tools} addTool={addTool} removeTool={removeTool}
                        />
                    </TabContent>
                </Tab>
                <Tab eventKey={3} title={<TabTitleText>Prompt Template</TabTitleText>}>
                    <TabContent id="prompt-tab" eventKey={3} activeKey={activeTab}
                        style={{ marginTop: "24px" }}>
                        <PromptTemplateTab
                            value={form.promptTemplate}
                            onChange={(v) => updateForm({ promptTemplate: v })}
                        />
                    </TabContent>
                </Tab>
                <Tab eventKey={4} title={<TabTitleText>
                    Generated Reports ({reportsTotalCount})
                </TabTitleText>}>
                    <TabContent id="reports-tab" eventKey={4} activeKey={activeTab}
                        style={{ marginTop: "24px" }}>
                        <GeneratedReportsTab reports={reports} />
                    </TabContent>
                </Tab>
            </Tabs>
        </PageSection>
    );
}

function InfoTab({ form, updateForm }: {
    form: NewReportDefinition;
    updateForm: (updates: Partial<NewReportDefinition>) => void;
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
            <FormGroup label="Schedule" isRequired fieldId="schedule">
                <FormSelect id="schedule" value={form.schedule}
                    onChange={(_e, v) => updateForm({ schedule: v })}>
                    <FormSelectOption value="hourly" label="Hourly" />
                    <FormSelectOption value="daily" label="Daily" />
                    <FormSelectOption value="weekly" label="Weekly" />
                    <FormSelectOption value="monthly" label="Monthly" />
                </FormSelect>
            </FormGroup>
            <FormGroup label="Time of Day" fieldId="scheduleTime">
                <TextInput id="scheduleTime" value={form.scheduleTime || ""}
                    onChange={(_e, v) => updateForm({ scheduleTime: v })}
                    placeholder="08:00" />
            </FormGroup>
            <FormGroup label="Time Window" isRequired fieldId="timeWindow">
                <FormSelect id="timeWindow" value={form.timeWindow}
                    onChange={(_e, v) => updateForm({ timeWindow: v })}>
                    <FormSelectOption value="since-last-run" label="Since Last Run" />
                    <FormSelectOption value="last-24h" label="Last 24 Hours" />
                    <FormSelectOption value="last-7d" label="Last 7 Days" />
                    <FormSelectOption value="last-30d" label="Last 30 Days" />
                </FormSelect>
            </FormGroup>
            <FormGroup fieldId="enabled">
                <Switch id="enabled" label="Enabled — report will run automatically on schedule"
                    isChecked={form.enabled}
                    onChange={(_e, v) => updateForm({ enabled: v })} />
            </FormGroup>
        </Form>
    );
}

function PromptTemplateTab({ value, onChange }: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <p style={{ color: "#6a6e73", marginBottom: "16px" }}>
                Instructions for the AI agent when generating this report.
                Supports placeholders:{" "}
                <code>{"{{repositories}}"}</code>,{" "}
                <code>{"{{timeRangeStart}}"}</code>,{" "}
                <code>{"{{timeRangeEnd}}"}</code>,{" "}
                <code>{"{{timeWindow}}"}</code>
            </p>
            <CodeEditor
                code={value}
                onCodeChange={(v) => onChange(v)}
                language={Language.markdown}
                height="400px"
                isLineNumbersVisible
                onEditorDidMount={(editor, monaco) => {
                    registerPlaceholderCompletions(editor, monaco, "markdown", REPORT_PLACEHOLDERS);
                }}
            />
        </div>
    );
}

function AllowedToolsTab({ tools, addTool, removeTool }: {
    tools: string[];
    addTool: (tool: string) => void;
    removeTool: (tool: string) => void;
}) {
    return (
        <div style={{ maxWidth: "700px" }}>
            <p style={{ color: "#6a6e73", marginBottom: "16px" }}>
                Define which tools the AI agent is allowed to use when generating this
                report. Use patterns like <code>Bash(gh issue *)</code> for specific
                shell commands and <code>mcp__axiom-tools__*</code> for MCP tools.
                Reference a toolset using <code>@ToolsetName</code> (e.g.{" "}
                <code>@Report Tools</code>) to include all tools from that collection.
            </p>

            <div style={{ marginBottom: "16px" }}>
                <AddToolInput onAdd={addTool} existingTools={tools} />
            </div>

            {tools.length === 0 ? (
                <Alert variant="info" title="No tools configured. A default set of read-only tools will be used." ouiaId="InfoAlert" />
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {tools.map((tool) => (
                        <Flex key={tool} alignItems={{ default: "alignItemsCenter" }}
                            style={{
                                padding: "8px 12px",
                                backgroundColor: tool.startsWith("@")
                                    ? "var(--pf-t--global--background--color--primary--default)"
                                    : "var(--pf-t--global--background--color--secondary--default)",
                                borderRadius: "4px",
                                border: tool.startsWith("@")
                                    ? "1px solid var(--pf-t--global--border--color--default)"
                                    : "none",
                            }}>
                            <FlexItem grow={{ default: "grow" }}>
                                <code style={{
                                    fontSize: "13px",
                                    color: tool.startsWith("@")
                                        ? "var(--pf-t--global--color--brand--default)"
                                        : "inherit",
                                }}>{tool}</code>
                            </FlexItem>
                            <FlexItem>
                                <Button variant="plain" size="sm" onClick={() => removeTool(tool)}
                                    aria-label={`Remove ${tool}`}>
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

function RepositoriesTab({ repos, addRepo, removeRepo }: {
    repos: string[];
    addRepo: (repo: string) => void;
    removeRepo: (repo: string) => void;
}) {
    const [newRepo, setNewRepo] = useState("");

    return (
        <div style={{ maxWidth: "600px" }}>
            <p style={{ color: "#6a6e73", marginBottom: "16px" }}>
                Specify which repositories this report should cover. Leave empty to
                include all monitored repositories.
            </p>

            <InputGroup style={{ marginBottom: "16px" }}>
                <InputGroupItem isFill>
                    <TextInput
                        id="newRepo"
                        value={newRepo}
                        onChange={(_e, v) => setNewRepo(v)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addRepo(newRepo);
                                setNewRepo("");
                            }
                        }}
                        placeholder="owner/repo (press Enter or click Add)"
                    />
                </InputGroupItem>
                <InputGroupItem>
                    <Button variant="control" onClick={() => { addRepo(newRepo); setNewRepo(""); }}
                        isDisabled={!newRepo.trim()}>
                        Add
                    </Button>
                </InputGroupItem>
            </InputGroup>

            {repos.length === 0 ? (
                <Alert variant="info" title="No repositories specified — the report will cover all monitored repositories." ouiaId="InfoAlert" />
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {repos.map((repo) => (
                        <Flex key={repo} alignItems={{ default: "alignItemsCenter" }}
                            style={{
                                padding: "8px 12px",
                                backgroundColor: "var(--pf-t--global--background--color--secondary--default)",
                                borderRadius: "4px",
                            }}>
                            <FlexItem grow={{ default: "grow" }}>
                                <code style={{ fontSize: "13px" }}>{repo}</code>
                            </FlexItem>
                            <FlexItem>
                                <Button variant="plain" size="sm" onClick={() => removeRepo(repo)}
                                    aria-label={`Remove ${repo}`}>
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

const STATUS_COLORS: Record<string, "blue" | "green" | "grey" | "red"> = {
    Pending: "blue",
    Generating: "blue",
    Completed: "green",
    Failed: "red",
};

function GeneratedReportsTab({ reports }: { reports: Report[] }) {
    if (reports.length === 0) {
        return (
            <EmptyState>
                <EmptyStateBody>No reports generated yet. Click "Run Now" to generate one.</EmptyStateBody>
            </EmptyState>
        );
    }

    return (
        <Table aria-label="Generated Reports" variant="compact">
            <Thead>
                <Tr>
                    <Th>Title</Th>
                    <Th>Status</Th>
                    <Th>Time Range</Th>
                    <Th>Generated</Th>
                </Tr>
            </Thead>
            <Tbody>
                {reports.map((report) => (
                    <Tr key={report.id} isClickable>
                        <Td>
                            <Link to={`/reports/${report.id}`}>
                                {report.title || `Report #${report.id}`}
                            </Link>
                        </Td>
                        <Td>
                            <Label isCompact color={STATUS_COLORS[report.status] || "grey"}>
                                {report.status}
                            </Label>
                        </Td>
                        <Td>
                            {report.timeRangeStart && report.timeRangeEnd
                                ? `${new Date(report.timeRangeStart).toLocaleDateString()} — ${new Date(report.timeRangeEnd).toLocaleDateString()}`
                                : "—"}
                        </Td>
                        <Td style={{ whiteSpace: "nowrap" }}>
                            {new Date(report.createdOn).toLocaleString()}
                        </Td>
                    </Tr>
                ))}
            </Tbody>
        </Table>
    );
}
