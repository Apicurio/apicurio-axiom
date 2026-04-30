import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
    Breadcrumb,
    BreadcrumbItem,
    Button,
    Card,
    CardBody,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    EmptyState,
    EmptyStateBody,
    Flex,
    FlexItem,
    Label,
    PageSection,
    Title,
} from "@patternfly/react-core";
import { type Report, fetchReport } from "../config/api";
import { RenderedReport } from "../components/RenderedReport";
import { ExecutionLogModal } from "../components/ExecutionLogModal";

export function ReportDetailPage() {
    const { reportId } = useParams<{ reportId: string }>();
    const id = Number(reportId);

    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);

    const loadData = useCallback(() => {
        if (!id) return;
        setLoading(true);
        fetchReport(id)
            .then(setReport)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => { loadData(); }, [loadData]);

    if (loading) {
        return (
            <PageSection>
                <EmptyState><EmptyStateBody>Loading report...</EmptyStateBody></EmptyState>
            </PageSection>
        );
    }

    if (!report) {
        return (
            <PageSection>
                <EmptyState><EmptyStateBody>Report not found.</EmptyStateBody></EmptyState>
            </PageSection>
        );
    }

    return (
        <PageSection>
            <Breadcrumb style={{ marginBottom: "16px" }}>
                <BreadcrumbItem><Link to="/reports">Reports</Link></BreadcrumbItem>
                <BreadcrumbItem isActive>{report.title || `Report #${report.id}`}</BreadcrumbItem>
            </Breadcrumb>

            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}
                alignItems={{ default: "alignItemsCenter" }}
                style={{ marginBottom: "16px" }}>
                <FlexItem>
                    <Title headingLevel="h1" size="lg">
                        {report.title || `Report #${report.id}`}
                    </Title>
                </FlexItem>
                {(report.status === "Completed" || report.status === "Failed") && (
                    <FlexItem>
                        <Button variant="secondary" onClick={() => setIsLogModalOpen(true)}>
                            View Execution Log
                        </Button>
                    </FlexItem>
                )}
            </Flex>

            <Card style={{ marginBottom: "24px" }}>
                <CardBody>
                    <DescriptionList isHorizontal isCompact columnModifier={{ default: "3Col" }}>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Status</DescriptionListTerm>
                            <DescriptionListDescription>
                                <Label color={report.status === "Completed" ? "green"
                                    : report.status === "Failed" ? "red" : "blue"}>
                                    {report.status}
                                </Label>
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        {report.timeRangeStart && report.timeRangeEnd && (
                            <DescriptionListGroup>
                                <DescriptionListTerm>Time Range</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {new Date(report.timeRangeStart).toLocaleDateString()}
                                    {" — "}
                                    {new Date(report.timeRangeEnd).toLocaleDateString()}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        )}
                        <DescriptionListGroup>
                            <DescriptionListTerm>Generated</DescriptionListTerm>
                            <DescriptionListDescription>
                                {new Date(report.createdOn).toLocaleString()}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        {report.costUsd != null && (
                            <DescriptionListGroup>
                                <DescriptionListTerm>AI Cost</DescriptionListTerm>
                                <DescriptionListDescription>
                                    ${report.costUsd.toFixed(4)}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        )}
                    </DescriptionList>
                </CardBody>
            </Card>

            {report.content ? (
                <RenderedReport content={report.content} />
            ) : (
                <EmptyState>
                    <EmptyStateBody>
                        {report.status === "Generating"
                            ? "Report is being generated..."
                            : "No content available."}
                    </EmptyStateBody>
                </EmptyState>
            )}

            <ExecutionLogModal
                isOpen={isLogModalOpen}
                reportId={report.id}
                onClose={() => setIsLogModalOpen(false)}
            />
        </PageSection>
    );
}
