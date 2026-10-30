import { LogOutIcon, MoveUpRightIcon } from "lucide-react"
import { lazy, Suspense } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { StatusDot } from "@/components/status-dot"
import { Badge } from "@/components/ui/badge"
import { ValueRow } from "@/components/value-row"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAction } from "@/hooks/use-tailscale"
import { api } from "@/lib/api"
import { formatBytes, formatRelative } from "@/lib/format"
import { connection, fqdn, ipv4, lastSeen, shortName } from "@/lib/tailscale"
import type { Status } from "@/lib/types"

// The chart library is large; load it with the first ping.
const PingPanel = lazy(() => import("@/components/ping-panel").then((m) => ({ default: m.PingPanel })))

// PeerDrawer shows the details of the peer with peerID (or this device's,
// for its own ID), kept current from the latest status, with a live ping.
export function PeerDrawer({
  status,
  peerID,
  onClose,
}: {
  status: Status
  peerID: string | undefined
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const self = peerID !== undefined && peerID === status.Self?.ID
  const peer = self ? status.Self : Object.values(status.Peer ?? {}).find((p) => p.ID === peerID)
  const pingIP = !self && peer?.Online ? ipv4(peer) ?? peer.TailscaleIPs?.[0] : undefined
  const exit = useAction((ip: string) => api.set({ "exit-node": ip }))

  const user = peer && status.User?.[String(peer.UserID)]
  const conn = peer && connection(peer)
  const seen = peer && lastSeen(peer)
  const expiry = peer?.KeyExpiry ? new Date(peer.KeyExpiry) : undefined

  return (
    <Drawer open={peer !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="mx-auto max-w-xl">
        {peer && (
          <>
            <DrawerHeader>
              <DrawerTitle className="flex items-center justify-center gap-2">
                <StatusDot online={peer.Online} />
                <span className="truncate">{shortName(peer)}</span>
                {self && <Badge variant="secondary">{t("devices.self")}</Badge>}
              </DrawerTitle>
              <DrawerDescription>
                {peer.Online
                  ? t("devices.online")
                  : seen
                    ? t("devices.lastSeen", { time: formatRelative(seen, i18n.language) })
                    : t("devices.offline")}
              </DrawerDescription>
            </DrawerHeader>
            <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col px-4">
                {pingIP && (
                  <>
                    <Suspense fallback={<Skeleton className="h-52 w-full rounded-lg" />}>
                      <PingPanel key={pingIP} ip={pingIP} />
                    </Suspense>
                    <Separator className="my-3" />
                  </>
                )}
                {peer.TailscaleIPs?.map((ip) => (
                  <ValueRow
                    key={ip}
                    label={ip.includes(":") ? t("overview.ipv6") : t("overview.ipv4")}
                    value={ip}
                    copy={ip}
                  />
                ))}
                {peer.DNSName && (
                  <ValueRow label={t("peer.magicDNS")} value={fqdn(peer)} copy={fqdn(peer)} />
                )}
                <Separator className="my-2" />
                <ValueRow label={t("peer.os")} value={peer.OS || "-"} />
                {user && <ValueRow label={t("peer.user")} value={user.LoginName} />}
                {peer.Tags?.length ? <ValueRow label={t("peer.tags")} value={peer.Tags.join(", ")} /> : null}
                {!self && <ValueRow
                  label={t("peer.connection")}
                  value={
                    conn
                      ? conn.direct
                        ? `${t("peer.direct")} ${conn.via}`
                        : t("peer.relay", { region: conn.via })
                      : t("peer.idle")
                  }
                />}
                <ValueRow
                  label={t("peer.traffic")}
                  value={t("peer.trafficValue", {
                    rx: formatBytes(peer.RxBytes),
                    tx: formatBytes(peer.TxBytes),
                  })}
                />
                {peer.PrimaryRoutes?.length ? (
                  <ValueRow label={t("peer.routes")} value={peer.PrimaryRoutes.join(", ")} />
                ) : null}
                {expiry && (
                  <ValueRow
                    label={t("peer.keyExpiry")}
                    value={
                      peer.Expired
                        ? t("peer.expired")
                        : expiry.toLocaleDateString(i18n.language, { dateStyle: "medium" })
                    }
                  />
                )}
              </div>
            </ScrollArea>
            {!self && peer.ExitNodeOption && (
              <DrawerFooter>
                <Button
                  variant={peer.ExitNode ? "outline" : "default"}
                  disabled={exit.isPending || (!peer.ExitNode && !peer.Online)}
                  onClick={() =>
                    exit.mutate(peer.ExitNode ? "" : (peer.TailscaleIPs?.[0] ?? ""), {
                      onSuccess: () => {
                        toast.success(peer.ExitNode ? t("peer.exitNodeOff") : t("peer.exitNodeOn"))
                        onClose()
                      },
                    })
                  }
                >
                  {exit.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : peer.ExitNode ? (
                    <LogOutIcon data-icon="inline-start" />
                  ) : (
                    <MoveUpRightIcon data-icon="inline-start" />
                  )}
                  {peer.ExitNode ? t("peer.stopExitNode") : t("peer.useExitNode")}
                </Button>
              </DrawerFooter>
            )}
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
