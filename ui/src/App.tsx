import { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
    Button,
    Masthead,
    MastheadBrand,
    MastheadContent,
    MastheadMain,
    MastheadToggle,
    Nav,
    NavExpandable,
    NavItem,
    NavList,
    NotificationBadge,
    NotificationDrawer,
    NotificationDrawerBody,
    NotificationDrawerHeader,
    NotificationDrawerList,
    NotificationDrawerListItem,
    NotificationDrawerListItemBody,
    NotificationDrawerListItemHeader,
    Page,
    PageSidebar,
    PageSidebarBody,
    PageToggleButton,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
} from "@patternfly/react-core";
import BarsIcon from "@patternfly/react-icons/dist/esm/icons/bars-icon";
import CheckCircleIcon from "@patternfly/react-icons/dist/esm/icons/check-circle-icon";
import ExclamationCircleIcon from "@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon";

import { DashboardPage } from "./pages/DashboardPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ActorsPage } from "./pages/ActorsPage";
import { ActorDetailPage } from "./pages/ActorDetailPage";
import { ManagerConfigPage } from "./pages/ManagerConfigPage";
import { ActionTypesPage } from "./pages/ActionTypesPage";
import { ActivityLogPage } from "./pages/ActivityLogPage";
import { RepositoriesPage } from "./pages/RepositoriesPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ActionTypeDetailPage } from "./pages/ActionTypeDetailPage";
import { ToolsPage } from "./pages/ToolsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ReportDetailPage } from "./pages/ReportDetailPage";
import { ReportDefinitionsPage } from "./pages/ReportDefinitionsPage";
import { ReportDefinitionDetailPage } from "./pages/ReportDefinitionDetailPage";
import { MetricsPage } from "./pages/MetricsPage";
import { ToolDetailPage } from "./pages/ToolDetailPage";
import { ConfigurationWarning } from "./components/ConfigurationWarning";
import { type StartupCheck, fetchSystemHealth, fetchSystemConfig } from "./config/api";
import { sseClient, type AxiomSseEvent } from "./config/sse";

interface Notification {
    id: number;
    message: string;
    severity: string;
    timestamp: Date;
    read: boolean;
}

const CONFIG_PATHS = ["/actors", "/manager", "/action-types", "/tools", "/repositories", "/report-definitions"];

let notificationIdCounter = 0;

export function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [backendStatus, setBackendStatus] = useState<string>("checking...");
    const [startupChecks, setStartupChecks] = useState<StartupCheck[] | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const addNotification = useCallback((message: string, severity: string) => {
        setNotifications((prev) => [
            {
                id: ++notificationIdCounter,
                message,
                severity,
                timestamp: new Date(),
                read: false,
            },
            ...prev,
        ].slice(0, 50)); // Keep last 50
    }, []);

    useEffect(() => {
        fetchSystemHealth()
            .then((health) => {
                setBackendStatus(health.status);
                // Only connect SSE after confirming the backend is reachable
                sseClient.connect();
            })
            .catch(() => setBackendStatus("DOWN"));

        fetchSystemConfig()
            .then((config) => {
                if (config.checks) {
                    setStartupChecks(config.checks);
                }
            })
            .catch(console.error);

        const unsubscribe = sseClient.subscribe((event: AxiomSseEvent) => {
            if (event.type === "notification") {
                const data = event.data as { message?: string; severity?: string };
                addNotification(
                    data.message || "New notification",
                    data.severity || "info"
                );
            }
        });

        return () => {
            unsubscribe();
            sseClient.disconnect();
        };
    }, [addNotification]);

    const markAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    const clearAll = () => {
        setNotifications([]);
        setIsDrawerOpen(false);
    };

    const masthead = (
        <Masthead>
            <MastheadMain>
                <MastheadToggle>
                    <PageToggleButton
                        variant="plain"
                        aria-label="Global navigation"
                        isSidebarOpen={isSidebarOpen}
                        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        <BarsIcon />
                    </PageToggleButton>
                </MastheadToggle>
                <MastheadBrand>
                    <span style={{ fontSize: "18px", fontWeight: "bold" }}>
                        Apicurio Axiom
                    </span>
                </MastheadBrand>
            </MastheadMain>
            <MastheadContent>
                <Toolbar>
                    <ToolbarContent>
                        <ToolbarItem align={{ default: "alignEnd" }}>
                            <NotificationBadge
                                variant={unreadCount > 0 ? "unread" : "read"}
                                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                                aria-label="Notifications"
                                count={unreadCount}
                            >
                            </NotificationBadge>
                        </ToolbarItem>
                        <ToolbarItem>
                            <Button
                                variant="plain"
                                aria-label={`API: ${backendStatus}`}
                                title={`API: ${backendStatus}`}
                                style={{ color: backendStatus === "UP" ? "var(--pf-t--global--color--status--success--default)" : "var(--pf-t--global--color--status--danger--default)" }}
                            >
                                {backendStatus === "UP" ? <CheckCircleIcon /> : <ExclamationCircleIcon />}
                            </Button>
                        </ToolbarItem>
                    </ToolbarContent>
                </Toolbar>
            </MastheadContent>
        </Masthead>
    );

    const isConfigActive = CONFIG_PATHS.some(
        (p) => location.pathname === p || location.pathname.startsWith(p + "/")
    );

    const sidebar = (
        <PageSidebar isSidebarOpen={isSidebarOpen}>
            <PageSidebarBody>
                <Nav>
                    <NavList>
                        <NavItem isActive={location.pathname === "/"} onClick={() => navigate("/")}>
                            Dashboard
                        </NavItem>
                        <NavItem isActive={location.pathname.startsWith("/reports")} onClick={() => navigate("/reports")}>
                            Reports
                        </NavItem>
                        <NavItem isActive={location.pathname.startsWith("/projects")} onClick={() => navigate("/projects")}>
                            Projects
                        </NavItem>
                        <NavItem isActive={location.pathname === "/activity"} onClick={() => navigate("/activity")}>
                            Activity Log
                        </NavItem>
                        <NavItem isActive={location.pathname === "/metrics"} onClick={() => navigate("/metrics")}>
                            Metrics
                        </NavItem>
                        <NavExpandable title="Configuration" isActive={isConfigActive} isExpanded={isConfigActive}>
                            <NavItem isActive={location.pathname.startsWith("/actors")} onClick={() => navigate("/actors")}>
                                Actors
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/manager")} onClick={() => navigate("/manager")}>
                                Manager
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/action-types")} onClick={() => navigate("/action-types")}>
                                Action Types
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/tools")} onClick={() => navigate("/tools")}>
                                Tools
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/repositories")} onClick={() => navigate("/repositories")}>
                                Repositories
                            </NavItem>
                            <NavItem isActive={location.pathname === "/report-definitions"} onClick={() => navigate("/report-definitions")}>
                                Report Definitions
                            </NavItem>
                        </NavExpandable>
                    </NavList>
                </Nav>
            </PageSidebarBody>
        </PageSidebar>
    );

    const notificationDrawer = isDrawerOpen ? (
        <NotificationDrawer>
            <NotificationDrawerHeader
                count={unreadCount}
                onClose={() => setIsDrawerOpen(false)}
            >
                <Button variant="link" onClick={markAllRead} isInline>
                    Mark all read
                </Button>
                {" "}
                <Button variant="link" onClick={clearAll} isInline>
                    Clear all
                </Button>
            </NotificationDrawerHeader>
            <NotificationDrawerBody>
                <NotificationDrawerList>
                    {notifications.length === 0 ? (
                        <div style={{ padding: "24px", textAlign: "center", color: "#6a6e73" }}>
                            No notifications
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <NotificationDrawerListItem
                                key={n.id}
                                variant={
                                    n.severity === "error"
                                        ? "danger"
                                        : n.severity === "warning"
                                          ? "warning"
                                          : "info"
                                }
                                isRead={n.read}
                                onClick={() =>
                                    setNotifications((prev) =>
                                        prev.map((x) =>
                                            x.id === n.id
                                                ? { ...x, read: true }
                                                : x
                                        )
                                    )
                                }
                            >
                                <NotificationDrawerListItemHeader
                                    title={n.message}
                                    variant={
                                        n.severity === "error"
                                            ? "danger"
                                            : n.severity === "warning"
                                              ? "warning"
                                              : "info"
                                    }
                                />
                                <NotificationDrawerListItemBody
                                    timestamp={n.timestamp.toLocaleString()}
                                />
                            </NotificationDrawerListItem>
                        ))
                    )}
                </NotificationDrawerList>
            </NotificationDrawerBody>
        </NotificationDrawer>
    ) : undefined;

    const hasCheckErrors = startupChecks != null &&
        startupChecks.some((c) => c.status === "error");

    return (
        <Page
            masthead={masthead}
            sidebar={hasCheckErrors ? undefined : sidebar}
            notificationDrawer={notificationDrawer}
            isNotificationDrawerExpanded={isDrawerOpen}
        >
            {hasCheckErrors ? (
                <ConfigurationWarning checks={startupChecks!} />
            ) : (
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                    <Route path="/actors" element={<ActorsPage />} />
                    <Route path="/actors/:actorId" element={<ActorDetailPage />} />
                    <Route path="/manager" element={<ManagerConfigPage />} />
                    <Route path="/action-types" element={<ActionTypesPage />} />
                    <Route path="/action-types/:actionTypeId" element={<ActionTypeDetailPage />} />
                    <Route path="/tools" element={<ToolsPage />} />
                    <Route path="/tools/:toolId" element={<ToolDetailPage />} />
                    <Route path="/activity" element={<ActivityLogPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/reports/:reportId" element={<ReportDetailPage />} />
                    <Route path="/report-definitions" element={<ReportDefinitionsPage />} />
                    <Route path="/report-definitions/:definitionId" element={<ReportDefinitionDetailPage />} />
                    <Route path="/metrics" element={<MetricsPage />} />
                    <Route path="/repositories" element={<RepositoriesPage />} />
                </Routes>
            )}
        </Page>
    );
}
