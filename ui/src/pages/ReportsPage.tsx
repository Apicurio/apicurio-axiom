import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Button,
    EmptyState,
    EmptyStateBody,
    Label,
    MenuToggle,
    MenuToggleElement,
    PageSection,
    Pagination,
    Select,
    SelectOption,
    TextInput,
    Title,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import { type Report, fetchReports } from "../config/api";

const STATUS_COLORS: Record<string, "blue" | "green" | "grey" | "red"> = {
    Pending: "blue",
    Generating: "blue",
    Completed: "green",
    Failed: "red",
};

export function ReportsPage() {
    const navigate = useNavigate();
    const [reports, setReports] = useState<Report[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterTitle, setFilterTitle] = useState("");
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    const [isStatusSelectOpen, setIsStatusSelectOpen] = useState(false);

    const loadData = useCallback(() => {
        setLoading(true);
        fetchReports(
            page, perPage,
            undefined,
            filterStatus.length > 0 ? filterStatus.join(",") : undefined,
            filterTitle || undefined
        )
            .then((results) => {
                setReports(results.items);
                setTotalCount(results.totalCount);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [page, perPage, filterTitle, filterStatus]);

    useEffect(() => { loadData(); }, [loadData]);

    const hasActiveFilters = filterTitle || filterStatus.length > 0;

    const clearFilters = () => {
        setFilterTitle("");
        setFilterStatus([]);
        setPage(1);
    };

    const onStatusSelect = (_event: React.MouseEvent | undefined,
                             value: string | number | undefined) => {
        const val = value as string;
        setFilterStatus((prev) =>
            prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
        );
        setPage(1);
    };

    const statusToggle = (toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
            ref={toggleRef}
            onClick={() => setIsStatusSelectOpen(!isStatusSelectOpen)}
            isExpanded={isStatusSelectOpen}
            style={{ minWidth: "150px" }}
        >
            {filterStatus.length > 0
                ? `${filterStatus.length} status${filterStatus.length > 1 ? "es" : ""} selected`
                : "Status"}
        </MenuToggle>
    );

    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">Reports</Title>

            <Toolbar clearAllFilters={clearFilters} style={{ marginTop: "16px" }}>
                <ToolbarContent>
                    <ToolbarItem>
                        <TextInput
                            type="text"
                            aria-label="Filter by title"
                            placeholder="Filter by title"
                            value={filterTitle}
                            onChange={(_e, v) => { setFilterTitle(v); setPage(1); }}
                            style={{ width: "220px" }}
                        />
                    </ToolbarItem>
                    <ToolbarItem>
                        <Select
                            aria-label="Filter by status"
                            toggle={statusToggle}
                            onSelect={onStatusSelect}
                            selected={filterStatus}
                            isOpen={isStatusSelectOpen}
                            onOpenChange={setIsStatusSelectOpen}
                        >
                            {["Pending", "Generating", "Completed", "Failed"].map((status) => (
                                <SelectOption key={status} value={status} hasCheckbox
                                    isSelected={filterStatus.includes(status)}>
                                    <Label isCompact color={STATUS_COLORS[status] || "grey"}>
                                        {status}
                                    </Label>
                                </SelectOption>
                            ))}
                        </Select>
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
                        <EmptyStateBody>Loading reports...</EmptyStateBody>
                    </EmptyState>
                ) : reports.length === 0 ? (
                    <EmptyState>
                        <EmptyStateBody>
                            {hasActiveFilters
                                ? "No reports match the current filters."
                                : "No reports generated yet. Configure and enable a report definition under Configuration \u2192 Report Definitions, or click \"Run Now\" to generate one immediately."}
                        </EmptyStateBody>
                    </EmptyState>
                ) : (
                    <Table aria-label="Reports" variant="compact">
                        <Thead>
                            <Tr>
                                <Th>Title</Th>
                                <Th>Status</Th>
                                <Th>Time Range</Th>
                                <Th>Generated</Th>
                                <Th>Cost</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {reports.map((report) => (
                                <Tr key={report.id} isClickable
                                    onRowClick={() => navigate(`/reports/${report.id}`)}>
                                    <Td>{report.title || `Report #${report.id}`}</Td>
                                    <Td>
                                        <Label isCompact
                                            color={STATUS_COLORS[report.status] || "grey"}>
                                            {report.status}
                                        </Label>
                                    </Td>
                                    <Td>
                                        {report.timeRangeStart && report.timeRangeEnd
                                            ? `${new Date(report.timeRangeStart).toLocaleDateString()} \u2014 ${new Date(report.timeRangeEnd).toLocaleDateString()}`
                                            : "\u2014"}
                                    </Td>
                                    <Td style={{ whiteSpace: "nowrap" }}>
                                        {new Date(report.createdOn).toLocaleString()}
                                    </Td>
                                    <Td>
                                        {report.costUsd != null
                                            ? `$${report.costUsd.toFixed(4)}`
                                            : "\u2014"}
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
