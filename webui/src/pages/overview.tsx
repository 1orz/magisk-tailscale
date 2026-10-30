import { ExternalLinkIcon, LogInIcon, TriangleAlertIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { LoginDrawer } from "@/components/login-drawer"
import { RequireService } from "@/components/require-service"
import { StatusDot } from "@/components/status-dot"
import { ValueRow } from "@/components/value-row"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useAction, useService } from "@/hooks/use-tailscale"
import { ADMIN_URL, api } from "@/lib/api"
import { exitNode, fqdn, ipv4, ipv6, shortName } from "@/lib/tailscale"
import type { Status } from "@/lib/types"

export function OverviewPage({ onShowSettings }: { onShowSettings: () => void }) {
  return (
    <RequireService>
      {(status) => <Overview status={status} onShowSettings={onShowSettings} />}
    </RequireService>
  )
}

function Overview({ status, onShowSettings }: { status: Status; onShowSettings: () => void }) {
  const { t } = useTranslation()

  // Announce the end of a login started from this page.
  const previous = useRef(status.BackendState)
  useEffect(() => {
    if (previous.current === "NeedsLogin" && status.BackendState !== "NeedsLogin") {
      toast.success(t("login.success"))
    }
    previous.current = status.BackendState
  }, [status.BackendState, t])

  switch (status.BackendState) {
    case "NeedsLogin":
    case "NoState":
      return <LoginCard status={status} />
    case "NeedsMachineAuth":
      return <MachineAuthCard />
  }

  return (
    <div className="flex flex-col gap-4">
      <ConnectionCard status={status} />
      <HealthAlert health={status.Health} />
      <AddressCard status={status} />
      <ExitNodeCard status={status} onShowSettings={onShowSettings} />
      <VersionCard />
    </div>
  )
}

function LoginCard({ status }: { status: Status }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("login.title")}</CardTitle>
        <CardDescription>{t("login.desc")}</CardDescription>
      </CardHeader>
      <CardFooter>
        <LoginDrawer authURL={status.AuthURL}>
          <Button className="w-full">
            <LogInIcon data-icon="inline-start" />
            {t("login.button")}
          </Button>
        </LoginDrawer>
      </CardFooter>
    </Card>
  )
}

function MachineAuthCard() {
  const { t } = useTranslation()
  const open = useAction(() => api.openURL(ADMIN_URL))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("machineAuth.title")}</CardTitle>
        <CardDescription>{t("machineAuth.desc")}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={() => open.mutate()}>
          <ExternalLinkIcon data-icon="inline-start" />
          {t("machineAuth.open")}
        </Button>
      </CardFooter>
    </Card>
  )
}

function ConnectionCard({ status }: { status: Status }) {
  const { t } = useTranslation()
  const connected = status.BackendState === "Running" || status.BackendState === "Starting"
  const toggle = useAction((on: boolean) => (on ? api.up() : api.down()))
  const self = status.Self
  const user = self && status.User?.[String(self.UserID)]

  return (
    <Card>
      {self && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusDot online={status.BackendState === "Running"} />
            <span className="truncate">{shortName(self)}</span>
          </CardTitle>
          <CardDescription className="truncate">
            {[status.CurrentTailnet?.Name, user?.LoginName].filter(Boolean).join(" · ")}
          </CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="connect">{t("overview.connect")}</FieldLabel>
            <FieldDescription>
              {t(`state.${status.BackendState}`)}
              {!connected && ` · ${t("overview.connectDesc")}`}
            </FieldDescription>
          </FieldContent>
          <Switch
            id="connect"
            checked={toggle.isPending ? toggle.variables : connected}
            disabled={toggle.isPending}
            onCheckedChange={(on) => toggle.mutate(on)}
          />
        </Field>
      </CardContent>
    </Card>
  )
}

function HealthAlert({ health }: { health: string[] | null }) {
  const { t } = useTranslation()
  if (!health?.length) return null
  return (
    <Alert>
      <TriangleAlertIcon />
      <AlertTitle>{t("overview.health")}</AlertTitle>
      <AlertDescription>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {health.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function AddressCard({ status }: { status: Status }) {
  const { t } = useTranslation()
  const self = status.Self
  if (!self) return null
  const v4 = ipv4(self)
  const v6 = ipv6(self)
  const name = fqdn(self)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("overview.addresses")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {v4 && <ValueRow label={t("overview.ipv4")} value={v4} copy={v4} />}
        {v6 && <ValueRow label={t("overview.ipv6")} value={v6} copy={v6} />}
        {name && <ValueRow label={t("overview.magicDNS")} value={name} copy={name} />}
      </CardContent>
    </Card>
  )
}

function ExitNodeCard({ status, onShowSettings }: { status: Status; onShowSettings: () => void }) {
  const { t } = useTranslation()
  const node = exitNode(status)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("overview.exitNode")}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          {node && <StatusDot online={node.Online} />}
          <span className="truncate">{node ? shortName(node) : t("overview.exitNodeNone")}</span>
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={onShowSettings}>
            {t("overview.exitNodeChange")}
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  )
}

function VersionCard() {
  const { t } = useTranslation()
  const service = useService()
  if (!service.data) return null
  const { moduleVersion, tailscaleVersion, tun } = service.data
  const userspace = tun === "userspace-networking"
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("overview.version")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        <ValueRow label={t("overview.moduleVersion")} value={moduleVersion} />
        <ValueRow label={t("overview.tailscaleVersion")} value={tailscaleVersion} />
        <ValueRow
          label={t("overview.mode")}
          value={userspace ? t("overview.modeUserspace") : t("overview.modeTun", { dev: tun })}
        />
      </CardContent>
    </Card>
  )
}
