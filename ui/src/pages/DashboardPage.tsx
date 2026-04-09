import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Card,
    CardBody,
    CardTitle,
    EmptyState,
    EmptyStateBody,
    Flex,
    FlexItem,
    Label,
    PageSection,
    Title,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import {
    type Project,
    type ActivityLogEntry,
    fetchProjects,
    fetchActivityLog,
} from "../config/api";

const STATUS_COLORS: Record<string, "blue" | "green" | "orange" | "grey"> = {
    Created: "blue",
    InProgress: "green",
    Idle: "orange",
    Completed: "grey",
};

const STATUS_LABELS: Record<string, string> = {
    Created: "Created",
    InProgress: "In Progress",
    Idle: "Idle",
    Completed: "Completed",
};

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
};

export function DashboardPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(() => {
        setLoading(true);
        Promise.all([fetchProjects(), fetchActivityLog()])
            .then(([p, a]) => {
                setProjects(p);
                setRecentActivity(a.reverse().slice(0, 10));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const statusCounts = projects.reduce(
        (acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    const activeProjects = projects.filter(
        (p) => p.status !== "Completed"
    );

    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">
                Dashboard
            </Title>

            {/* Status summary cards */}
            <Flex style={{ marginTop: "16px", gap: "16px" }}>
                {["Created", "InProgress", "Idle", "Completed"].map(
                    (status) => (
                        <FlexItem key={status}>
                            <Card isCompact>
                                <CardTitle>
                                    {STATUS_LABELS[status] || status}
                                </CardTitle>
                                <CardBody>
                                    <span style={{ fontSize: "24px", fontWeight: "bold" }}>
                                        {statusCounts[status] || 0}
                                    </span>
                                </CardBody>
                            </Card>
                        </FlexItem>
                    )
                )}
                <FlexItem>
                    <Card isCompact>
                        <CardTitle>Total</CardTitle>
                        <CardBody>
                            <span style={{ fontSize: "24px", fontWeight: "bold" }}>
                                {projects.length}
                            </span>
                        </CardBody>
                    </Card>
                </FlexItem>
            </Flex>

            {/* Active projects */}
            <Title headingLevel="h2" size="md" style={{ marginTop: "32px" }}>
                Active Projects
            </Title>
            <div style={{ marginTop: "8px" }}>
                {loading ? (
                    <EmptyState>
                        <EmptyStateBody>Loading...</EmptyStateBody>
                    </EmptyState>
                ) : activeProjects.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>No active projects.</EmptyStateBody>
                    </EmptyState>
                ) : (
                    <Table aria-label="Active Projects" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>Name</Th>
                                <Th>Status</Th>
                                <Th>Type</Th>
                                <Th>Issue</Th>
                                <Th>Updated</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {activeProjects.map((project) => (
                                <Tr
                                    key={project.id}
                                    isClickable
                                    onRowClick={() =>
                                        navigate(`/projects/${project.id}`)
                                    }
                                >
                                    <Td>{project.name}</Td>
                                    <Td>
                                        <Label color={STATUS_COLORS[project.status] || "grey"}>
                                            {STATUS_LABELS[project.status] || project.status}
                                        </Label>
                                    </Td>
                                    <Td>
                                        <Label isCompact>{project.type}</Label>
                                    </Td>
                                    <Td>{project.issueRef}</Td>
                                    <Td>{new Date(project.updatedOn).toLocaleString()}</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </div>

            {/* Recent activity */}
            <Title headingLevel="h2" size="md" style={{ marginTop: "32px" }}>
                Recent Activity
            </Title>
            <div style={{ marginTop: "8px" }}>
                {recentActivity.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>No recent activity.</EmptyStateBody>
                    </EmptyState>
                ) : (
                    <Table aria-label="Recent Activity" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>Time</Th>
                                <Th>Type</Th>
                                <Th>Summary</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {recentActivity.map((entry) => (
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
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                )}
            </div>
        </PageSection>
    );
}
