import {
    PageSection,
    Title,
    EmptyState,
    EmptyStateBody,
} from "@patternfly/react-core";

export function ActionTypesPage() {
    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">Action Types</Title>
            <EmptyState>
                <EmptyStateBody>
                    Action type registry management will appear here.
                </EmptyStateBody>
            </EmptyState>
        </PageSection>
    );
}
