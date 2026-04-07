import {
    PageSection,
    Title,
    EmptyState,
    EmptyStateBody,
} from "@patternfly/react-core";

export function RepositoriesPage() {
    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">Repositories</Title>
            <EmptyState>
                <EmptyStateBody>
                    Monitored repository configuration will appear here.
                </EmptyStateBody>
            </EmptyState>
        </PageSection>
    );
}
