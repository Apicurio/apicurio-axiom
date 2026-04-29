import { useState, useRef, useEffect } from "react";
import {
    Button,
    Content,
    TextArea,
    Title,
} from "@patternfly/react-core";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import PaperPlaneIcon from "@patternfly/react-icons/dist/esm/icons/paper-plane-icon";
import {
    type NewToolDefinition,
    type ToolParameter,
    aiEditTool,
} from "../config/api";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface ToolAiPanelProps {
    form: NewToolDefinition;
    params: ToolParameter[];
    onUpdate: (form: Partial<NewToolDefinition>, params: ToolParameter[]) => void;
    onClose: () => void;
}

/**
 * Side panel providing a chat interface for AI-assisted tool editing.
 * The user describes what they want and Claude Code generates or updates
 * the tool definition (name, description, parameters, script template).
 */
export function ToolAiPanel({ form, params, onUpdate, onClose }: ToolAiPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
            ...form,
            parameters: params.length > 0 ? params : undefined,
        };

        aiEditTool({ message: text, currentTool })
            .then((response) => {
                const aiMessage: ChatMessage = {
                    role: "assistant",
                    content: response.explanation || "Done.",
                };
                setMessages((prev) => [...prev, aiMessage]);

                if (response.tool) {
                    onUpdate(
                        {
                            name: response.tool.name,
                            description: response.tool.description,
                            scriptTemplate: response.tool.scriptTemplate,
                        },
                        response.tool.parameters || []
                    );
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

    return (
        <div style={{
            width: "380px",
            minWidth: "380px",
            borderLeft: "1px solid var(--pf-t--global--border--color--default)",
            display: "flex",
            flexDirection: "column",
            height: "100%",
        }}>
            {/* Header */}
            <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--pf-t--global--border--color--default)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}>
                <Title headingLevel="h4" size="md">AI Assistant</Title>
                <Button variant="plain" size="sm" onClick={onClose}>
                    <TimesIcon />
                </Button>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
            }}>
                {messages.length === 0 && (
                    <div style={{ color: "#6a6e73", fontSize: "13px", textAlign: "center",
                        marginTop: "32px" }}>
                        Describe the tool you want to create or how you'd like to
                        modify the current tool. The AI will generate the name,
                        description, parameters, and script template.
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
                            <Content><Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown></Content>
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
                        Thinking...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--pf-t--global--border--color--default)",
                display: "flex",
                gap: "8px",
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
            </div>
        </div>
    );
}
