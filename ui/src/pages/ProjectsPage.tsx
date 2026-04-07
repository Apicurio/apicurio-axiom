import {
    PageSection,
    Title,
    EmptyState,
    EmptyStateBody,
} from "@patternfly/react-core";

export function ProjectsPage() {
    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">Projects</Title>
            <EmptyState>
                <EmptyStateBody>
                    Project list and management will appear here.
                </EmptyStateBody>
            </EmptyState>
        </PageSection>
    );
}
