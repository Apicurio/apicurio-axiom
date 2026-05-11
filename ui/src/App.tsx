import { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
    AboutModal,
    Button,
    Masthead,
    MastheadBrand,
    MastheadContent,
    MastheadMain,
    Nav,
    NavExpandable,
    NavItem,
    NavList,
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
    Toolbar,
    ToolbarContent,
    ToolbarItem,
    Content,
} from "@patternfly/react-core";
import QuestionCircleIcon from "@patternfly/react-icons/dist/esm/icons/question-circle-icon";

import { DashboardPage } from "./pages/DashboardPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ActorsPage } from "./pages/ActorsPage";
import { ActorDetailPage } from "./pages/ActorDetailPage";
import { ManagerConfigPage } from "./pages/ManagerConfigPage";
import { ActionTypesPage } from "./pages/ActionTypesPage";
import { ActivityLogPage } from "./pages/ActivityLogPage";
import { EventsPage } from "./pages/EventsPage";
import { ManagerDecisionsPage } from "./pages/ManagerDecisionsPage";
import { TasksPage } from "./pages/TasksPage";
import { EventSourcesPage } from "./pages/EventSourcesPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ActionTypeDetailPage } from "./pages/ActionTypeDetailPage";
import { ToolsPage } from "./pages/ToolsPage";
import { McpServersPage } from "./pages/McpServersPage";
import { McpServerDetailPage } from "./pages/McpServerDetailPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ReportDetailPage } from "./pages/ReportDetailPage";
import { ReportDefinitionsPage } from "./pages/ReportDefinitionsPage";
import { ReportDefinitionDetailPage } from "./pages/ReportDefinitionDetailPage";
import { AiUsagePage } from "./pages/AiUsagePage";
import { DiskUsagePage } from "./pages/DiskUsagePage";
import { ToolDetailPage } from "./pages/ToolDetailPage";
import { ToolsetsPage } from "./pages/ToolsetsPage";
import { ToolsetDetailPage } from "./pages/ToolsetDetailPage";
import { SecretsPage } from "./pages/SecretsPage";
import { ConfigurationWarning } from "./components/ConfigurationWarning";
import { EngineSettingsPage } from "./pages/EngineSettingsPage";
import { type StartupCheck, fetchSystemHealth, fetchSystemConfig } from "./config/api";
import { sseClient, type AxiomSseEvent } from "./config/sse";

interface Notification {
    id: number;
    message: string;
    severity: string;
    timestamp: Date;
    read: boolean;
}

const CONFIG_PATHS = ["/actors", "/manager", "/action-types", "/tools", "/toolsets", "/mcp-servers", "/secrets", "/event-sources", "/report-definitions", "/engine"];

let notificationIdCounter = 0;

export function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [startupChecks, setStartupChecks] = useState<StartupCheck[] | null>(null);
    const [engineName, setEngineName] = useState<string | undefined>(undefined);
    const [appVersion, setAppVersion] = useState<string>("");
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
            .then(() => sseClient.connect())
            .catch(console.error);

        fetchSystemConfig()
            .then((config) => {
                if (config.checks) {
                    setStartupChecks(config.checks);
                }
                if (config.engine) {
                    setEngineName(config.engine);
                }
                if (config.version) {
                    setAppVersion(config.version);
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
        <Masthead style={{
            position: "relative",
            borderBottom: "none",
            boxShadow: "none",
            background: "white",
            marginBottom: "6px",
        }}>
            <MastheadMain>
                <MastheadBrand>
                    <img src="/logo.png" alt="Apicurio Axiom"
                        style={{ height: "42px", padding: "0", cursor: "pointer" }}
                        onClick={() => navigate("/")} />
                </MastheadBrand>
            </MastheadMain>
            <MastheadContent>
                <Toolbar>
                    <ToolbarContent>
                        <ToolbarItem align={{ default: "alignEnd" }}>
                            <Button variant="plain" aria-label="About"
                                onClick={() => setIsAboutOpen(true)}>
                                <QuestionCircleIcon style={{ color: "#2082a3" }} />
                            </Button>
                        </ToolbarItem>
                    </ToolbarContent>
                </Toolbar>
            </MastheadContent>
            <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: "linear-gradient(90deg, #0b2545, #1b6b93, #4fc0d0)",
            }} />
        </Masthead>
    );

    const isConfigActive = CONFIG_PATHS.some(
        (p) => location.pathname === p || location.pathname.startsWith(p + "/")
    );

    const sidebar = (
        <PageSidebar>
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
                        <NavExpandable title="Logs"
                            isActive={location.pathname.startsWith("/logs")}
                            isExpanded={location.pathname.startsWith("/logs")}>
                            <NavItem isActive={location.pathname === "/logs/activity"} onClick={() => navigate("/logs/activity")}>
                                All Activity
                            </NavItem>
                            <NavItem isActive={location.pathname === "/logs/events"} onClick={() => navigate("/logs/events")}>
                                Events
                            </NavItem>
                            <NavItem isActive={location.pathname === "/logs/manager"} onClick={() => navigate("/logs/manager")}>
                                Manager Decisions
                            </NavItem>
                            <NavItem isActive={location.pathname === "/logs/tasks"} onClick={() => navigate("/logs/tasks")}>
                                Tasks
                            </NavItem>
                        </NavExpandable>
                        <NavExpandable title="Metrics"
                            isActive={location.pathname.startsWith("/metrics")}
                            isExpanded={location.pathname.startsWith("/metrics")}>
                            <NavItem isActive={location.pathname === "/metrics/ai-usage"} onClick={() => navigate("/metrics/ai-usage")}>
                                AI Usage
                            </NavItem>
                            <NavItem isActive={location.pathname === "/metrics/disk-usage"} onClick={() => navigate("/metrics/disk-usage")}>
                                Disk Usage
                            </NavItem>
                        </NavExpandable>
                        <NavExpandable title="Configuration" isActive={isConfigActive} isExpanded={isConfigActive}>
                            <NavItem isActive={location.pathname.startsWith("/engine")} onClick={() => navigate("/engine")}>
                                AI Engine
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/action-types")} onClick={() => navigate("/action-types")}>
                                Action Types
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/actors")} onClick={() => navigate("/actors")}>
                                Actors
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/manager")} onClick={() => navigate("/manager")}>
                                Manager
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/mcp-servers")} onClick={() => navigate("/mcp-servers")}>
                                MCP Servers
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/report-definitions")} onClick={() => navigate("/report-definitions")}>
                                Report Definitions
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/event-sources")} onClick={() => navigate("/event-sources")}>
                                Event Sources
                            </NavItem>
                            <NavItem isActive={location.pathname === "/secrets"} onClick={() => navigate("/secrets")}>
                                Secrets
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/tools") && !location.pathname.startsWith("/toolsets")} onClick={() => navigate("/tools")}>
                                Tools
                            </NavItem>
                            <NavItem isActive={location.pathname.startsWith("/toolsets")} onClick={() => navigate("/toolsets")}>
                                Toolsets
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
                    <Route path="/engine" element={<EngineSettingsPage />} />
                    <Route path="/actors" element={<ActorsPage />} />
                    <Route path="/actors/:actorId" element={<ActorDetailPage />} />
                    <Route path="/manager" element={<ManagerConfigPage />} />
                    <Route path="/action-types" element={<ActionTypesPage />} />
                    <Route path="/action-types/:actionTypeId" element={<ActionTypeDetailPage />} />
                    <Route path="/tools" element={<ToolsPage />} />
                    <Route path="/tools/:toolId" element={<ToolDetailPage />} />
                    <Route path="/toolsets" element={<ToolsetsPage />} />
                    <Route path="/toolsets/:toolsetId" element={<ToolsetDetailPage />} />
                    <Route path="/mcp-servers" element={<McpServersPage />} />
                    <Route path="/mcp-servers/:mcpServerId" element={<McpServerDetailPage />} />
                    <Route path="/logs/activity" element={<ActivityLogPage />} />
                    <Route path="/logs/events" element={<EventsPage />} />
                    <Route path="/logs/manager" element={<ManagerDecisionsPage />} />
                    <Route path="/logs/tasks" element={<TasksPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/reports/:reportId" element={<ReportDetailPage />} />
                    <Route path="/report-definitions" element={<ReportDefinitionsPage />} />
                    <Route path="/report-definitions/:definitionId" element={<ReportDefinitionDetailPage />} />
                    <Route path="/metrics/ai-usage" element={<AiUsagePage />} />
                    <Route path="/metrics/disk-usage" element={<DiskUsagePage />} />
                    <Route path="/event-sources" element={<EventSourcesPage />} />
                    <Route path="/secrets" element={<SecretsPage />} />
                </Routes>
            )}

            <AboutModal
                isOpen={isAboutOpen}
                onClose={() => setIsAboutOpen(false)}
                brandImageSrc="/logo.png"
                brandImageAlt="Apicurio Axiom"
                trademark="Copyright &copy; 2025-2026"
            >
                <Content component="dl">
                    <dt>Version</dt>
                    <dd>{appVersion || "—"}</dd>
                    <dt>AI Engine</dt>
                    <dd>
                        {engineName === "opencode" ? "OpenCode"
                            : engineName === "claude-code" ? "Claude Code"
                            : engineName || "—"}
                    </dd>
                    <dt>License</dt>
                    <dd>Apache License 2.0</dd>
                    <dt>Source</dt>
                    <dd>
                        <a href="https://github.com/Apicurio/apicurio-axiom"
                            target="_blank" rel="noopener noreferrer">
                            github.com/Apicurio/apicurio-axiom
                        </a>
                    </dd>
                </Content>
            </AboutModal>
        </Page>
    );
}
