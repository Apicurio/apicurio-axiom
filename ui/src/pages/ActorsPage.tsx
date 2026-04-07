import {
    PageSection,
    Title,
    EmptyState,
    EmptyStateBody,
} from "@patternfly/react-core";

export function ActorsPage() {
    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">Actors</Title>
            <EmptyState>
                <EmptyStateBody>
                    Actor configuration and management will appear here.
                </EmptyStateBody>
            </EmptyState>
        </PageSection>
    );
}
