import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    PageSection, Spinner,
    Title,
} from "@patternfly/react-core";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import { type Report, fetchReport, deleteReport } from "../config/api";
import { sseClient, type AxiomSseEvent } from "../config/sse";
import { RenderedReport } from "../components/RenderedReport";
import { ExecutionLogModal } from "../components/ExecutionLogModal";
import {If} from "../components/If.tsx";

export function ReportDetailPage() {
    const { reportId } = useParams<{ reportId: string }>();
    const navigate = useNavigate();
    const id = Number(reportId);

    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const handleDelete = () => {
        deleteReport(id)
            .then(() => navigate("/reports"))
            .catch(console.error);
    };

    const loadData = useCallback(() => {
        if (!id) return;
        setLoading(true);
        fetchReport(id)
            .then(setReport)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        const unsubscribe = sseClient.subscribe((event: AxiomSseEvent) => {
            if (event.type === "report-updated") {
                const data = event.data as { reportId?: number };
                if (data.reportId === id) {
                    loadData();
                }
            }
        });
        return unsubscribe;
    }, [id, loadData]);

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
                <FlexItem>
                    {(report.status === "Completed" || report.status === "Failed") && (
                        <Button variant="secondary" onClick={() => setIsLogModalOpen(true)}
                            style={{ marginRight: "8px" }}>
                            View Execution Log
                        </Button>
                    )}
                    <Button variant="danger" icon={<TrashIcon />} onClick={() => setIsDeleteOpen(true)}>
                        Delete
                    </Button>
                </FlexItem>
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
                        {report.durationMs != null && (
                            <DescriptionListGroup>
                                <DescriptionListTerm>Duration</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {formatDuration(report.durationMs)}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        )}
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
                        <If condition={report.status === "Generating"}>
                            <Spinner size="md" />
                            &nbsp;
                            <span><em>Report is being generated...</em></span>
                        </If>
                        <If condition={report.status != "Generating"}>
                            <span>No content available.</span>
                        </If>
                    </EmptyStateBody>
                </EmptyState>
            )}

            <ExecutionLogModal
                isOpen={isLogModalOpen}
                reportId={report.id}
                onClose={() => setIsLogModalOpen(false)}
            />

            <Modal isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                variant="small"
                aria-label="Confirm delete report">
                <ModalHeader title="Delete Report" />
                <ModalBody>
                    Are you sure you want to delete this report? This action cannot be undone.
                </ModalBody>
                <ModalFooter>
                    <Button variant="danger" onClick={handleDelete}>Delete</Button>
                    <Button variant="link" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                </ModalFooter>
            </Modal>
        </PageSection>
    );
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
}
