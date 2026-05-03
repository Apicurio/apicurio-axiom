import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Button,
    Card,
    CardBody,
    EmptyState,
    EmptyStateBody,
    Gallery,
    GalleryItem,
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
import { type DiskUsageProject, fetchDiskUsage, formatBytes } from "../config/api";

export function DiskUsagePage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<DiskUsageProject[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [totalDiskUsageBytes, setTotalDiskUsageBytes] = useState(0);
    const [projectCount, setProjectCount] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [loading, setLoading] = useState(true);

    // Committed filter (drives the API call)
    const [filterName, setFilterName] = useState("");
    // Input value (updated on every keystroke, committed on Enter/blur)
    const [inputName, setInputName] = useState("");

    const loadData = useCallback(() => {
        setLoading(true);
        fetchDiskUsage(page, perPage, filterName || undefined)
            .then((results) => {
                setProjects(results.items);
                setTotalCount(results.totalCount);
                setTotalDiskUsageBytes(results.totalDiskUsageBytes || 0);
                setProjectCount(results.projectCount || 0);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [page, perPage, filterName]);

    useEffect(() => { loadData(); }, [loadData]);

    const applyFilter = () => {
        setFilterName(inputName);
        setPage(1);
    };

    const clearFilters = () => {
        setInputName("");
        setFilterName("");
        setPage(1);
    };

    const hasActiveFilters = !!filterName;

    return (
        <PageSection>
            <Title headingLevel="h1" size="lg" style={{ marginBottom: "16px" }}>
                Disk Usage
            </Title>

            <Gallery hasGutter minWidths={{ default: "180px" }} style={{ marginBottom: "16px" }}>
                <GalleryItem>
                    <Card isCompact>
                        <CardBody style={{ textAlign: "center", padding: "16px" }}>
                            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                                {formatBytes(totalDiskUsageBytes)}
                            </div>
                            <div style={{ fontSize: "13px", color: "#6a6e73" }}>
                                Total Disk Usage
                            </div>
                        </CardBody>
                    </Card>
                </GalleryItem>
                <GalleryItem>
                    <Card isCompact>
                        <CardBody style={{ textAlign: "center", padding: "16px" }}>
                            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                                {projectCount}
                            </div>
                            <div style={{ fontSize: "13px", color: "#6a6e73" }}>
                                Projects
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
                            aria-label="Filter by project name"
                            placeholder="Project name"
                            value={inputName}
                            onChange={(_e, v) => setInputName(v)}
                            onKeyDown={(e) => { if (e.key === "Enter") applyFilter(); }}
                            onBlur={applyFilter}
                            style={{ width: "220px" }}
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

            {loading ? (
                <EmptyState>
                    <EmptyStateBody>Loading disk usage...</EmptyStateBody>
                </EmptyState>
            ) : projects.length === 0 ? (
                <EmptyState>
                    <EmptyStateBody>
                        {hasActiveFilters
                            ? "No projects match the current filter."
                            : "No projects found."}
                    </EmptyStateBody>
                </EmptyState>
            ) : (
                <Table aria-label="Disk Usage by Project" variant="compact">
                    <Thead>
                        <Tr>
                            <Th>Project</Th>
                            <Th>Disk Usage</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {projects.map((p) => (
                            <Tr key={p.projectId} isClickable
                                onRowClick={() => navigate(`/projects/${p.projectId}`)}>
                                <Td>{p.projectName}</Td>
                                <Td>{formatBytes(p.diskUsageBytes)}</Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            )}
        </PageSection>
    );
}
