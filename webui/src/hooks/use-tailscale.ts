import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { api } from "@/lib/api"
import type { LogKind } from "@/lib/types"

// REFRESH_MS is how often everything shown is re-read. Polling pauses
// while the page is hidden, and a read still running is not started again.
export const REFRESH_MS = 1000

export const keys = {
  service: ["service"] as const,
  profiles: ["profiles"] as const,
  status: ["status"] as const,
  prefs: ["prefs"] as const,
  config: ["config"] as const,
  logs: (kind: LogKind) => ["logs", kind] as const,
}

export function useService() {
  return useQuery({ queryKey: keys.service, queryFn: api.service, refetchInterval: REFRESH_MS })
}

export function useStatus() {
  const service = useService()
  return useQuery({
    queryKey: keys.status,
    queryFn: api.status,
    enabled: service.data?.running === true,
    refetchInterval: REFRESH_MS,
  })
}

export function usePrefs() {
  const service = useService()
  return useQuery({
    queryKey: keys.prefs,
    queryFn: api.prefs,
    enabled: service.data?.running === true,
    refetchInterval: REFRESH_MS,
  })
}

export function useProfiles() {
  const service = useService()
  return useQuery({
    queryKey: keys.profiles,
    queryFn: api.profiles,
    enabled: service.data?.running === true,
    refetchInterval: REFRESH_MS,
  })
}

export function useConfig() {
  return useQuery({ queryKey: keys.config, queryFn: api.config, refetchInterval: REFRESH_MS })
}

export function useLogs(kind: LogKind, { follow = true } = {}) {
  return useQuery({
    queryKey: keys.logs(kind),
    queryFn: () => api.logs(kind),
    refetchInterval: follow ? REFRESH_MS : false,
  })
}

// useAction wraps a command that changes state: it reports failures (and
// optionally success) in a toast, then refreshes everything that may have
// changed.
export function useAction<T = void>(
  fn: (arg: T) => Promise<unknown>,
  { success }: { success?: string } = {},
) {
  const { t } = useTranslation()
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast.success(success)
    },
    onError: (err) => {
      toast.error(t("common.failed"), { description: err.message })
    },
    onSettled: () => client.invalidateQueries(),
  })
}
