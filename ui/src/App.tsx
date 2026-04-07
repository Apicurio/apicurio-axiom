import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
    Brand,
    Masthead,
    MastheadBrand,
    MastheadContent,
    MastheadMain,
    MastheadToggle,
    Nav,
    NavItem,
    NavList,
    Page,
    PageSidebar,
    PageSidebarBody,
    PageToggleButton,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
    Label,
} from "@patternfly/react-core";
import BarsIcon from "@patternfly/react-icons/dist/esm/icons/bars-icon";

import { DashboardPage } from "./pages/DashboardPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ActorsPage } from "./pages/ActorsPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { ActionTypesPage } from "./pages/ActionTypesPage";
import { ActivityLogPage } from "./pages/ActivityLogPage";
import { RepositoriesPage } from "./pages/RepositoriesPage";
import { fetchSystemHealth } from "./config/api";

interface NavEntry {
    path: string;
    label: string;
}

const NAV_ITEMS: NavEntry[] = [
    { path: "/", label: "Dashboard" },
    { path: "/projects", label: "Projects" },
    { path: "/actors", label: "Actors" },
    { path: "/policies", label: "Policies" },
    { path: "/action-types", label: "Action Types" },
    { path: "/activity", label: "Activity Log" },
    { path: "/repositories", label: "Repositories" },
];

export function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [backendStatus, setBackendStatus] = useState<string>("checking...");

    useEffect(() => {
        fetchSystemHealth()
            .then((health) => setBackendStatus(health.status))
            .catch(() => setBackendStatus("DOWN"));
    }, []);

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
                    <Brand alt="Apicurio Axiom">Apicurio Axiom</Brand>
                </MastheadBrand>
            </MastheadMain>
            <MastheadContent>
                <Toolbar>
                    <ToolbarContent>
                        <ToolbarItem>
                            <Label
                                color={backendStatus === "UP" ? "green" : "red"}
                            >
                                API: {backendStatus}
                            </Label>
                        </ToolbarItem>
                    </ToolbarContent>
                </Toolbar>
            </MastheadContent>
        </Masthead>
    );

    const sidebar = (
        <PageSidebar isSidebarOpen={isSidebarOpen}>
            <PageSidebarBody>
                <Nav>
                    <NavList>
                        {NAV_ITEMS.map((item) => (
                            <NavItem
                                key={item.path}
                                isActive={location.pathname === item.path}
                                onClick={() => navigate(item.path)}
                            >
                                {item.label}
                            </NavItem>
                        ))}
                    </NavList>
                </Nav>
            </PageSidebarBody>
        </PageSidebar>
    );

    return (
        <Page masthead={masthead} sidebar={sidebar}>
            <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/actors" element={<ActorsPage />} />
                <Route path="/policies" element={<PoliciesPage />} />
                <Route path="/action-types" element={<ActionTypesPage />} />
                <Route path="/activity" element={<ActivityLogPage />} />
                <Route path="/repositories" element={<RepositoriesPage />} />
            </Routes>
        </Page>
    );
}
