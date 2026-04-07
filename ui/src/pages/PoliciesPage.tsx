import {
    PageSection,
    Title,
    EmptyState,
    EmptyStateBody,
} from "@patternfly/react-core";

export function PoliciesPage() {
    return (
        <PageSection>
            <Title headingLevel="h1" size="lg">Policies</Title>
            <EmptyState>
                <EmptyStateBody>
                    Policy configuration and testing will appear here.
                </EmptyStateBody>
            </EmptyState>
        </PageSection>
    );
}
