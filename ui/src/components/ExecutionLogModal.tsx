import { useState, useEffect } from "react";
import {
    Button,
    EmptyState,
    EmptyStateBody,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
} from "@patternfly/react-core";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { fetchTaskExecutionLog } from "../config/api";

interface ExecutionLogModalProps {
    isOpen: boolean;
    projectId: number | null;
    taskId: number | null;
    onClose: () => void;
}

/**
 * Modal that displays the execution log for a completed or failed task.
 * Fetches the log from the REST API when opened and displays it in a
 * read-only Monaco code editor.
 */
export function ExecutionLogModal({ isOpen, projectId, taskId, onClose }: ExecutionLogModalProps) {
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && projectId != null && taskId != null) {
            setLoading(true);
            setContent("");
            fetchTaskExecutionLog(projectId, taskId)
                .then(setContent)
                .catch((err) => setContent("Error loading log: " + err.message))
                .finally(() => setLoading(false));
        }
    }, [isOpen, projectId, taskId]);

    const handleClose = () => {
        onClose();
        setContent("");
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} variant="large">
            <ModalHeader title={`Execution Log — Task #${taskId}`} />
            <ModalBody>
                {loading ? (
                    <EmptyState>
                        <EmptyStateBody>Loading execution log...</EmptyStateBody>
                    </EmptyState>
                ) : (
                    <CodeEditor
                        code={content}
                        language={Language.markdown}
                        height="600px"
                        isReadOnly
                        isLineNumbersVisible
                    />
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="link" onClick={handleClose}>Close</Button>
            </ModalFooter>
        </Modal>
    );
}
