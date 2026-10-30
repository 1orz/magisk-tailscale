import { PlayIcon, PlugZapIcon, TriangleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAction, useService, useStatus } from "@/hooks/use-tailscale"
import { api } from "@/lib/api"
import { BridgeMissingError } from "@/lib/exec"
import type { Status } from "@/lib/types"

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useTranslation()
  const missing = error instanceof BridgeMissingError
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{missing ? t("bridge.missingTitle") : t("service.loadFailed")}</EmptyTitle>
        <EmptyDescription>{missing ? t("bridge.missingDesc") : error.message}</EmptyDescription>
      </EmptyHeader>
      {!missing && (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}

function ServiceStopped() {
  const { t } = useTranslation()
  const start = useAction(api.start, { success: t("service.started") })
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PlugZapIcon />
        </EmptyMedia>
        <EmptyTitle>{t("service.stoppedTitle")}</EmptyTitle>
        <EmptyDescription>{t("service.stoppedDesc")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button disabled={start.isPending} onClick={() => start.mutate()}>
          {start.isPending ? <Spinner data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
          {t("service.start")}
        </Button>
      </EmptyContent>
    </Empty>
  )
}

// RequireService renders children with the current status once the daemon
// is running and has answered, and the matching placeholder until then.
export function RequireService({ children }: { children: (status: Status) => ReactNode }) {
  const service = useService()
  const status = useStatus()

  if (service.isPending) return <PageSkeleton />
  if (service.isError) return <ErrorState error={service.error} onRetry={() => service.refetch()} />
  if (!service.data.running) return <ServiceStopped />
  if (status.isPending) return <PageSkeleton />
  if (status.isError) return <ErrorState error={status.error} onRetry={() => status.refetch()} />
  return children(status.data)
}
