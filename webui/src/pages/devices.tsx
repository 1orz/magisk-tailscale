import { SearchIcon, SearchXIcon, UsersIcon } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { PeerDrawer } from "@/components/peer-drawer"
import { RequireService } from "@/components/require-service"
import { StatusDot } from "@/components/status-dot"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { formatRelative } from "@/lib/format"
import { ipv4, lastSeen, peers, shortName } from "@/lib/tailscale"
import type { PeerStatus, Status } from "@/lib/types"

export function DevicesPage() {
  return <RequireService>{(status) => <Devices status={status} />}</RequireService>
}

function matches(p: PeerStatus, q: string): boolean {
  const fields = [p.HostName, p.DNSName, p.OS, ...(p.TailscaleIPs ?? [])]
  return fields.some((f) => f.toLowerCase().includes(q))
}

function Devices({ status }: { status: Status }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string>()
  const q = useDeferredValue(query.trim().toLowerCase())

  const all = useMemo(() => peers(status), [status])
  const shown = useMemo(() => (q ? all.filter((p) => matches(p, q)) : all), [all, q])
  const online = all.filter((p) => p.Online).length
  const self = status.Self && (!q || matches(status.Self, q)) ? status.Self : undefined

  if (all.length === 0 && !status.Self) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon />
          </EmptyMedia>
          <EmptyTitle>{t("devices.empty")}</EmptyTitle>
          <EmptyDescription>{t("devices.emptyDesc")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("devices.search")}
        />
      </InputGroup>
      <p className="px-1 text-xs text-muted-foreground">
        {t("devices.count", { online, total: all.length })}
      </p>

      {shown.length === 0 && !self ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{t("devices.noMatch")}</EmptyTitle>
            <EmptyDescription>{t("devices.noMatchDesc")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-2">
          {self && <PeerItem peer={self} self onSelect={() => setSelected(self.ID)} />}
          {shown.map((p) => (
            <PeerItem key={p.ID} peer={p} onSelect={() => setSelected(p.ID)} />
          ))}
        </ItemGroup>
      )}

      <PeerDrawer status={status} peerID={selected} onClose={() => setSelected(undefined)} />
    </div>
  )
}

function PeerItem({
  peer,
  self = false,
  onSelect,
}: {
  peer: PeerStatus
  self?: boolean
  onSelect: () => void
}) {
  const { t, i18n } = useTranslation()
  const seen = lastSeen(peer)
  const presence = peer.Online
    ? t("devices.online")
    : seen
      ? t("devices.lastSeen", { time: formatRelative(seen, i18n.language) })
      : t("devices.offline")

  return (
    <Item variant="outline" asChild>
      <button type="button" onClick={onSelect} className="text-left">
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full">
            <StatusDot online={peer.Online} />
            <span className="truncate">{shortName(peer)}</span>
          </ItemTitle>
          <ItemDescription className="truncate">
            {[ipv4(peer), peer.OS, presence].filter(Boolean).join(" · ")}
          </ItemDescription>
        </ItemContent>
        {(self || peer.ExitNode || peer.ExitNodeOption) && (
          <ItemActions>
            {self ? (
              <Badge>{t("devices.self")}</Badge>
            ) : (
              <Badge variant={peer.ExitNode ? "default" : "secondary"}>
                {peer.ExitNode ? t("devices.inUse") : t("devices.exitNode")}
              </Badge>
            )}
          </ItemActions>
        )}
      </button>
    </Item>
  )
}
