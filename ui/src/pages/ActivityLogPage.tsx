import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Button,
    EmptyState,
    EmptyStateBody,
    Flex,
    FlexItem,
    Label,
    PageSection,
    Title,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import { type ActivityLogEntry, fetchActivityLog } from "../config/api";

const ENTRY_TYPE_COLORS: Record<string, "blue" | "green" | "orange" | "grey" | "red"> = {
    "event-received": "blue",
    "task-created": "green",
    "task-started": "green",
    "task-completed": "green",
    "task-failed": "red",
    "project-created": "blue",
    "project-closed": "grey",
    "project-reopened": "orange",
    "event-ignored": "grey",
    "manager-escalation": "orange",
    "manager-no-decision": "grey",
    "manager-error": "red",
    "pipeline-error": "red",
};

export function ActivityLogPage() {
    const navigate = useNavigate();
    const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(() => {
        setLoading(true);
        fetchActivityLog()
            .then((data) => setEntries(data.reverse()))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return (
        <PageSection>
            <Flex
                justifyContent={{ default: "justifyContentSpaceBetween" }}
                alignItems={{ default: "alignItemsCenter" }}
            >
                <FlexItem>
                    <Title headingLevel="h1" size="lg">
                        Activity Log
                    </Title>
                </FlexItem>
                <FlexItem>
                    <Button variant="link" onClick={loadData}>
                        Refresh
                    </Button>
                </FlexItem>
            </Flex>

            <div style={{ marginTop: "16px" }}>
                {loading ? (
                    <EmptyState>
                        <EmptyStateBody>Loading activity log...</EmptyStateBody>
                    </EmptyState>
                ) : entries.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>No activity yet.</EmptyStateBody>
                    </EmptyState>
                ) : (
                    <Table aria-label="Activity Log" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>Time</Th>
                                <Th>Type</Th>
                                <Th>Summary</Th>
                                <Th>Project</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {entries.map((entry) => (
                                <Tr key={entry.id}>
                                    <Td style={{ whiteSpace: "nowrap" }}>
                                        {new Date(entry.createdOn).toLocaleString()}
                                    </Td>
                                    <Td>
                                        <Label
                                            isCompact
                                            color={ENTRY_TYPE_COLORS[entry.entryType] || "grey"}
                                        >
                                            {entry.entryType}
                                        </Label>
                                    </Td>
                                    <Td>{entry.summary}</Td>
                                    <Td>
                                        {entry.projectId ? (
                                            <Button
                                                variant="link"
                                                isInline
                                                onClick={() =>
                                                    navigate(`/projects/${entry.projectId}`)
                                                }
                                            >
                                                Project #{entry.projectId}
                                            </Button>
                                        ) : (
                                            "—"
                                        )}
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </div>
        </PageSection>
    );
}
