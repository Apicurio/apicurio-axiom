import {
    PageSection,
    Title,
    EmptyState,
    EmptyStateBody,
} from "@patternfly/react-core";

export function DashboardPage() {
    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">Dashboard</Title>
            <EmptyState>
                <EmptyStateBody>
                    Project overview and recent activity will appear here.
                </EmptyStateBody>
            </EmptyState>
        </PageSection>
    );
}
