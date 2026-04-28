import { useState, useEffect, useCallback } from "react";
import {
    Button,
    Card,
    CardBody,
    EmptyState,
    EmptyStateBody,
    Gallery,
    GalleryItem,
    Label,
    PageSection,
    Pagination,
    TextInput,
    Title,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import { type AiUsage, type AiUsageSearchResults, fetchUsage } from "../config/api";

const TYPE_COLORS: Record<string, "blue" | "green"> = {
    task: "green",
    manager: "blue",
};

export function UsagePage() {
    const [records, setRecords] = useState<AiUsage[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterActionType, setFilterActionType] = useState("");
    const [filterInvocationType, setFilterInvocationType] = useState("");

    // Summary stats
    const [totalCost, setTotalCost] = useState(0);
    const [totalInputTokens, setTotalInputTokens] = useState(0);
    const [totalOutputTokens, setTotalOutputTokens] = useState(0);

    const loadData = useCallback(() => {
        setLoading(true);
        fetchUsage(
            page, perPage,
            filterInvocationType || undefined,
            undefined, undefined,
            filterActionType || undefined
        )
            .then((results) => {
                setRecords(results.items);
                setTotalCount(results.totalCount);
                setTotalCost(results.totalCostUsd || 0);
                setTotalInputTokens(results.totalInputTokens || 0);
                setTotalOutputTokens(results.totalOutputTokens || 0);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [page, perPage, filterActionType, filterInvocationType]);

    useEffect(() => { loadData(); }, [loadData]);

    const hasActiveFilters = filterActionType || filterInvocationType;

    const clearFilters = () => {
        setFilterActionType("");
        setFilterInvocationType("");
        setPage(1);
    };

    return (
        <PageSection>
            <Title headingLevel="h1" size="lg" style={{ marginBottom: "16px" }}>
                AI Usage
            </Title>

            {/* Summary cards */}
            <Gallery hasGutter minWidths={{ default: "180px" }} style={{ marginBottom: "16px" }}>
                <GalleryItem>
                    <Card isCompact>
                        <CardBody style={{ textAlign: "center", padding: "16px" }}>
                            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                                {totalCount}
                            </div>
                            <div style={{ fontSize: "13px", color: "#6a6e73" }}>
                                Total Invocations
                            </div>
                        </CardBody>
                    </Card>
                </GalleryItem>
                <GalleryItem>
                    <Card isCompact>
                        <CardBody style={{ textAlign: "center", padding: "16px" }}>
                            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                                ${totalCost.toFixed(4)}
                            </div>
                            <div style={{ fontSize: "13px", color: "#6a6e73" }}>
                                Total Cost
                            </div>
                        </CardBody>
                    </Card>
                </GalleryItem>
                <GalleryItem>
                    <Card isCompact>
                        <CardBody style={{ textAlign: "center", padding: "16px" }}>
                            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                                {totalInputTokens.toLocaleString()}
                            </div>
                            <div style={{ fontSize: "13px", color: "#6a6e73" }}>
                                Input Tokens
                            </div>
                        </CardBody>
                    </Card>
                </GalleryItem>
                <GalleryItem>
                    <Card isCompact>
                        <CardBody style={{ textAlign: "center", padding: "16px" }}>
                            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                                {totalOutputTokens.toLocaleString()}
                            </div>
                            <div style={{ fontSize: "13px", color: "#6a6e73" }}>
                                Output Tokens
                            </div>
                        </CardBody>
                    </Card>
                </GalleryItem>
            </Gallery>

            <Toolbar clearAllFilters={clearFilters}>
                <ToolbarContent>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by invocation type"
                            placeholder="Type (task/manager)"
                            value={filterInvocationType}
                            onChange={(_e, v) => { setFilterInvocationType(v); setPage(1); }}
                            style={{ width: "180px" }}
                        />
                    </ToolbarItem>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by action type"
                            placeholder="Action type"
                            value={filterActionType}
                            onChange={(_e, v) => { setFilterActionType(v); setPage(1); }}
                            style={{ width: "180px" }}
                        />
                    </ToolbarItem>
                    {hasActiveFilters && (
                        <ToolbarItem>
                            <Button variant="link" icon={<TimesIcon />} onClick={clearFilters}>
                                Clear filters
                            </Button>
                        </ToolbarItem>
                    )}
                    <ToolbarItem variant="separator" />
                    <ToolbarItem>
                        <Button variant="plain" aria-label="Refresh" onClick={loadData}>
                            <SyncAltIcon />
                        </Button>
                    </ToolbarItem>
                    <ToolbarItem variant="pagination" align={{ default: "alignEnd" }}>
                        <Pagination
                            itemCount={totalCount}
                            page={page}
                            perPage={perPage}
                            onSetPage={(_e, p) => setPage(p)}
                            onPerPageSelect={(_e, pp) => { setPerPage(pp); setPage(1); }}
                            isCompact
                        />
                    </ToolbarItem>
                </ToolbarContent>
            </Toolbar>

            <div>
                {loading ? (
                    <EmptyState>
                        <EmptyStateBody>Loading usage data...</EmptyStateBody>
                    </EmptyState>
                ) : records.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>
                            {hasActiveFilters
                                ? "No usage records match the current filters."
                                : "No AI usage recorded yet."}
                        </EmptyStateBody>
                    </EmptyState>
                ) : (
                    <Table aria-label="AI Usage" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>Time</Th>
                                <Th>Type</Th>
                                <Th>Action</Th>
                                <Th>Project</Th>
                                <Th>Cost</Th>
                                <Th>Input Tokens</Th>
                                <Th>Output Tokens</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {records.map((r) => (
                                <Tr key={r.id}>
                                    <Td style={{ whiteSpace: "nowrap" }}>
                                        {new Date(r.createdOn).toLocaleString()}
                                    </Td>
                                    <Td>
                                        <Label isCompact
                                            color={TYPE_COLORS[r.invocationType] || "grey"}>
                                            {r.invocationType}
                                        </Label>
                                    </Td>
                                    <Td>{r.actionType || "—"}</Td>
                                    <Td>
                                        {r.projectId ? `Project #${r.projectId}` : "—"}
                                    </Td>
                                    <Td>
                                        {r.costUsd != null
                                            ? `$${r.costUsd.toFixed(4)}`
                                            : "—"}
                                    </Td>
                                    <Td>
                                        {r.inputTokens != null
                                            ? r.inputTokens.toLocaleString()
                                            : "—"}
                                    </Td>
                                    <Td>
                                        {r.outputTokens != null
                                            ? r.outputTokens.toLocaleString()
                                            : "—"}
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
