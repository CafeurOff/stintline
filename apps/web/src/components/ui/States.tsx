import type { ReactNode } from "react";

import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/context";

import { Button } from "./Button";

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex flex-col items-start gap-1">
      <p className="font-bold text-loss">{t("common.error")}</p>
      <p className="text-muted">{errorMessage(error, t)}</p>
      {onRetry && (
        <Button
          variant="quiet"
          onClick={() => {
            onRetry();
          }}
        >
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-10 text-center">
      <p className="font-bold">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  );
}
