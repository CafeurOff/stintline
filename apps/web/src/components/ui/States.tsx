import type { ReactNode } from "react";

import { errorMessage } from "@/lib/errors";

import { Button } from "./Button";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

/** Error with the API's safe message and a retry action. */
export function ErrorState({ error, onRetry, title = "Something went wrong" }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-4"
    >
      <p className="font-semibold text-danger">{title}</p>
      <p className="text-sm text-text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button
          onClick={() => {
            onRetry();
          }}
        >
          Retry
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong p-6 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-text-muted">{children}</div>}
    </div>
  );
}
