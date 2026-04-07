import {
    PageSection,
    Title,
    EmptyState,
    EmptyStateBody,
} from "@patternfly/react-core";

export function ActivityLogPage() {
    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">Activity Log</Title>
            <EmptyState>
                <EmptyStateBody>
                    Global activity log will appear here.
                </EmptyStateBody>
            </EmptyState>
        </PageSection>
    );
}
