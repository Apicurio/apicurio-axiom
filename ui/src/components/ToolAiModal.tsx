import {useEffect, useRef, useState} from "react";
import {
    Button,
    Content,
    Grid,
    GridItem,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader, Spinner,
    Stack,
    StackItem,
    TextArea,
    Title,
} from "@patternfly/react-core";
import {Table, Tbody, Td, Th, Thead, Tr} from "@patternfly/react-table";
import {CodeEditor, Language} from "@patternfly/react-code-editor";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PaperPlaneIcon from "@patternfly/react-icons/dist/esm/icons/paper-plane-icon";
import {aiEditTool, type NewToolDefinition, type ToolParameter,} from "../config/api";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface ToolAiModalProps {
    isOpen: boolean;
    form: NewToolDefinition;
    params: ToolParameter[];
    onApply: (form: Partial<NewToolDefinition>, params: ToolParameter[]) => void;
    onClose: () => void;
}

/**
 * Full-screen modal for AI-assisted tool editing. Left side shows the
 * current parameters and script template (read-only preview, updated live
 * by AI). Right side is a chat interface for giving instructions.
 */
export function ToolAiModal({ isOpen, form, params, onApply, onClose }: ToolAiModalProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [localForm, setLocalForm] = useState(form);
    const [localParams, setLocalParams] = useState(params);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Sync local state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalForm(form);
            setLocalParams(params);
        }
    }, [isOpen, form, params]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMessage: ChatMessage = { role: "user", content: text };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        const currentTool: NewToolDefinition = {
            ...localForm,
            parameters: localParams.length > 0 ? localParams : undefined,
        };

        aiEditTool({ message: text, currentTool })
            .then((response) => {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: response.explanation || "Done." },
                ]);

                if (response.tool) {
                    setLocalForm((prev) => ({
                        ...prev,
                        name: response.tool!.name || prev.name,
                        description: response.tool!.description || prev.description,
                        scriptTemplate: response.tool!.scriptTemplate || prev.scriptTemplate,
                    }));
                    setLocalParams(response.tool!.parameters || []);
                }
            })
            .catch((err) => {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: "Error: " + err.message },
                ]);
            })
            .finally(() => setLoading(false));
    };

    const handleApply = () => {
        onApply(
            {
                name: localForm.name,
                description: localForm.description,
                scriptTemplate: localForm.scriptTemplate,
            },
            localParams
        );
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} variant="large"
            style={{ maxWidth: "95vw", width: "95vw" }}>
            <ModalHeader title="AI-Assisted Tool Editor" />
            <ModalBody style={{ padding: 0, height: "100vh", display: "flex" }}>
                <Grid style={{ width: "100%" }}>
                    <GridItem className="content" span={9}>
                        <Stack>
                            {/* Parameters */}
                            <StackItem style={{ padding: "16px" }}>
                                <Title headingLevel="h4" size="md" style={{ marginBottom: "8px" }}>
                                    Parameters ({localParams.length})
                                </Title>
                                {localParams.length > 0 ? (
                                    <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                                        <Table aria-label="Parameters" variant="compact">
                                            <Thead>
                                                <Tr>
                                                    <Th>Name</Th>
                                                    <Th>Type</Th>
                                                    <Th>Description</Th>
                                                    <Th>Required</Th>
                                                </Tr>
                                            </Thead>
                                            <Tbody>
                                                {localParams.map((p, i) => (
                                                    <Tr key={i}>
                                                        <Td><code>{p.name}</code></Td>
                                                        <Td>{p.type}</Td>
                                                        <Td>{p.description || "—"}</Td>
                                                        <Td>{p.required ? "Yes" : "No"}</Td>
                                                    </Tr>
                                                ))}
                                            </Tbody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div style={{ color: "#6a6e73", fontSize: "13px" }}>
                                        No parameters defined yet. Ask the AI to create them.
                                    </div>
                                )}
                            </StackItem>
                            <StackItem>
                                <Title headingLevel="h4" size="md" style={{ paddingLeft: "16px" }}>
                                    Script Template
                                </Title>
                            </StackItem>
                            {/* Tool Content */}
                            <StackItem isFilled={true} style={{ paddingLeft: "16px", paddingRight: "16px" }}>
                                <CodeEditor
                                    code={localForm.scriptTemplate || ""}
                                    language={Language.shell}
                                    isFullHeight={true}
                                    isReadOnly={false}
                                    isLineNumbersVisible={true}
                                />
                            </StackItem>
                        </Stack>
                    </GridItem>
                    <GridItem className="chat" span={3} style={{ borderLeft: "1px solid var(--pf-t--global--border--color--default)" }}>
                        <Stack>
                            {/* Messages */}
                            <StackItem isFilled={true} style={{
                                overflowY: "auto",
                                padding: "16px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                            }}>
                                {messages.length === 0 && (
                                    <div style={{
                                        color: "#6a6e73", fontSize: "13px", textAlign: "center",
                                        marginTop: "32px",
                                    }}>
                                        Describe the tool you want to create or how you'd like
                                        to modify it. The AI will generate the parameters and
                                        script template.
                                    </div>
                                )}
                                {messages.map((msg, i) => (
                                    <div key={i} style={{
                                        alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                                        maxWidth: "90%",
                                        padding: "8px 12px",
                                        borderRadius: "8px",
                                        backgroundColor: msg.role === "user"
                                            ? "var(--pf-t--global--color--brand--default)"
                                            : "var(--pf-t--global--background--color--secondary--default)",
                                        color: msg.role === "user" ? "white" : "inherit",
                                        fontSize: "13px",
                                    }}>
                                        {msg.role === "assistant" ? (
                                            <Content>
                                                <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                                            </Content>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                ))}
                                {loading && (
                                    <div style={{
                                        alignSelf: "flex-start",
                                        padding: "8px 12px",
                                        borderRadius: "8px",
                                        backgroundColor: "var(--pf-t--global--background--color--secondary--default)",
                                        fontSize: "13px",
                                        color: "#6a6e73",
                                    }}>
                                        <Spinner size="sm" style={{ marginRight: "5px" }} />
                                        Thinking...
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </StackItem>
                            {/* Input */}
                            <StackItem style={{
                                padding: "6px 8px",
                                borderTop: "1px solid var(--pf-t--global--border--color--default)",
                                display: "flex",
                                gap: "8px"
                            }}>
                                <TextArea
                                    value={input}
                                    onChange={(_e, v) => setInput(v)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="Describe what this tool should do..."
                                    rows={2}
                                    isDisabled={loading}
                                    style={{ flex: 1, resize: "none" }}
                                />
                                <Button
                                    variant="primary"
                                    onClick={handleSend}
                                    isDisabled={!input.trim() || loading}
                                    isLoading={loading}
                                    style={{ alignSelf: "flex-end" }}
                                >
                                    <PaperPlaneIcon />
                                </Button>
                            </StackItem>
                        </Stack>
                    </GridItem>
                </Grid>
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" onClick={handleApply}>
                    Apply Changes
                </Button>
                <Button variant="link" onClick={onClose}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}
