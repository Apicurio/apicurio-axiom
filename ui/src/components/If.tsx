import { type ReactNode } from "react";

export function If({ condition, children }: { condition: boolean; children: ReactNode }) {
    return condition ? <>{children}</> : null;
}
