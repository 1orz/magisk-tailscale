import {
  ArrowLeftRightIcon,
  ExternalLinkIcon,
  LogOutIcon,
  RotateCwIcon,
  SquareIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { LoginDrawer } from "@/components/login-drawer"
import { useTheme, type Theme } from "@/components/theme-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAction, useConfig, usePrefs, useProfiles, useService, useStatus } from "@/hooks/use-tailscale"
import {
  languageNames,
  languagePreference,
  languages,
  setLanguagePreference,
  type Language,
} from "@/i18n"
import { ADMIN_URL, PROJECT_URL, api } from "@/lib/api"
import {
  exitNode,
  isAdvertisingExitNode,
  parseRoutes,
  peers,
  shortName,
  subnetRoutes,
} from "@/lib/tailscale"
import type { Prefs, Status, TunMode } from "@/lib/types"

export function SettingsPage() {
  const service = useService()
  const status = useStatus()
  const prefs = usePrefs()
  const ready = service.data?.running && status.data && prefs.data
  const loggedIn = ready && status.data?.BackendState !== "NeedsLogin"

  return (
    <div className="flex flex-col gap-4">
      {loggedIn && status.data && prefs.data && (
        <>
          <ExitNodeCard status={status.data} prefs={prefs.data} />
          <AdvertiseCard prefs={prefs.data} />
          <NetworkCard prefs={prefs.data} />
          <DeviceNameCard status={status.data} prefs={prefs.data} />
        </>
      )}
      <ServiceCard running={service.data?.running ?? false} />
      <AppearanceCard />
      {/* Kept while running, not just logged in: adding an account passes
          through NeedsLogin, and its login drawer lives here. */}
      {service.data?.running && <AccountCard />}
      <AboutCard />
    </div>
  )
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <FieldGroup>{children}</FieldGroup>
      </CardContent>
    </Card>
  )
}

// PrefSwitch toggles one `tailscale set` flag.
function PrefSwitch({
  id,
  flag,
  checked,
  label,
  description,
  disabled,
}: {
  id: string
  flag: string
  checked: boolean
  label: string
  description: string
  disabled?: boolean
}) {
  const set = useAction((on: boolean) => api.set({ [flag]: on }))
  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined}>
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch
        id={id}
        checked={set.isPending ? set.variables : checked}
        disabled={disabled || set.isPending}
        onCheckedChange={(on) => set.mutate(on)}
      />
    </Field>
  )
}

const noExitNode = "none"

function ExitNodeCard({ status, prefs }: { status: Status; prefs: Prefs }) {
  const { t } = useTranslation()
  const options = peers(status).filter((p) => p.ExitNodeOption)
  const current = exitNode(status)
  const set = useAction((ip: string) => api.set({ "exit-node": ip }), { success: t("common.saved") })

  const choose = (id: string) => {
    const peer = options.find((p) => p.ID === id)
    set.mutate(peer?.TailscaleIPs?.[0] ?? "")
  }

  return (
    <SettingsCard title={t("settings.exitNode.title")} description={t("settings.exitNode.desc")}>
      <Field>
        <FieldLabel htmlFor="exit-node">{t("settings.exitNode.select")}</FieldLabel>
        <Select
          value={current?.ID ?? noExitNode}
          onValueChange={choose}
          disabled={set.isPending}
        >
          <SelectTrigger id="exit-node" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value={noExitNode}>{t("settings.exitNode.none")}</SelectItem>
              {options.map((p) => (
                <SelectItem key={p.ID} value={p.ID} disabled={!p.Online && !p.ExitNode}>
                  {shortName(p)}
                  {!p.Online && ` (${t("settings.exitNode.offline")})`}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <PrefSwitch
        id="allow-lan"
        flag="exit-node-allow-lan-access"
        checked={prefs.ExitNodeAllowLANAccess}
        label={t("settings.exitNode.allowLan")}
        description={t("settings.exitNode.allowLanDesc")}
      />
    </SettingsCard>
  )
}

function AdvertiseCard({ prefs }: { prefs: Prefs }) {
  const { t } = useTranslation()
  const saved = subnetRoutes(prefs).join(", ")
  const [draft, setDraft] = useState<string>()
  const text = draft ?? saved
  const routes = parseRoutes(text)
  const save = useAction((r: string[]) => api.set({ "advertise-routes": r.join(",") }), {
    success: t("common.saved"),
  })

  return (
    <SettingsCard title={t("settings.advertise.title")}>
      <PrefSwitch
        id="advertise-exit-node"
        flag="advertise-exit-node"
        checked={isAdvertisingExitNode(prefs)}
        label={t("settings.advertise.exitNode")}
        description={t("settings.advertise.exitNodeDesc")}
      />
      <FieldSeparator />
      <Field data-invalid={!routes || undefined}>
        <FieldLabel htmlFor="routes">{t("settings.advertise.routes")}</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="routes"
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="192.168.1.0/24"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!routes || undefined}
          />
          <Button
            variant="outline"
            disabled={!routes || text === saved || save.isPending}
            onClick={() => routes && save.mutate(routes, { onSuccess: () => setDraft(undefined) })}
          >
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t("common.save")}
          </Button>
        </div>
        {routes ? (
          <FieldDescription>{t("settings.advertise.routesDesc")}</FieldDescription>
        ) : (
          <FieldError>{t("settings.advertise.routesInvalid")}</FieldError>
        )}
      </Field>
    </SettingsCard>
  )
}

function NetworkCard({ prefs }: { prefs: Prefs }) {
  const { t } = useTranslation()
  return (
    <SettingsCard title={t("settings.network.title")}>
      <PrefSwitch
        id="accept-routes"
        flag="accept-routes"
        checked={prefs.RouteAll}
        label={t("settings.network.acceptRoutes")}
        description={t("settings.network.acceptRoutesDesc")}
      />
      <PrefSwitch
        id="accept-dns"
        flag="accept-dns"
        checked={prefs.CorpDNS}
        label={t("settings.network.acceptDNS")}
        description={t("settings.network.acceptDNSDesc")}
      />
      <PrefSwitch
        id="shields-up"
        flag="shields-up"
        checked={prefs.ShieldsUp}
        label={t("settings.network.shieldsUp")}
        description={t("settings.network.shieldsUpDesc")}
      />
    </SettingsCard>
  )
}

function DeviceNameCard({ status, prefs }: { status: Status; prefs: Prefs }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<string>()
  const name = draft ?? prefs.Hostname
  const save = useAction((h: string) => api.set({ hostname: h }), { success: t("common.saved") })

  return (
    <SettingsCard title={t("settings.device.title")}>
      <Field>
        <FieldLabel htmlFor="hostname">{t("settings.device.hostname")}</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="hostname"
            value={name}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={status.Self?.HostName}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button
            variant="outline"
            disabled={name.trim() === prefs.Hostname || save.isPending}
            onClick={() => save.mutate(name.trim(), { onSuccess: () => setDraft(undefined) })}
          >
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t("common.save")}
          </Button>
        </div>
        <FieldDescription>{t("settings.device.hostnameDesc")}</FieldDescription>
      </Field>
    </SettingsCard>
  )
}

function ServiceCard({ running }: { running: boolean }) {
  const { t } = useTranslation()
  const config = useConfig()
  // Set once a setting changed in this session, until the next restart.
  const [needsRestart, setNeedsRestart] = useState(false)
  const [draftPort, setDraftPort] = useState<string>()
  const savedPort = config.data ? String(config.data.port) : ""
  const port = draftPort ?? savedPort
  const portValid = /^\d{1,5}$/.test(port) && Number(port) <= 65535

  const setMode = useAction((m: TunMode) => api.setTunMode(m), { success: t("common.saved") })
  const savePort = useAction((p: number) => api.setPort(p), { success: t("common.saved") })
  const restart = useAction(api.restart, { success: t("settings.service.restarted") })
  const stop = useAction(api.stop, { success: t("settings.service.stopped") })

  const changed = { onSuccess: () => setNeedsRestart(true) }
  const portChanged = {
    onSuccess: () => {
      setNeedsRestart(true)
      setDraftPort(undefined)
    },
  }

  return (
    <SettingsCard title={t("settings.service.title")}>
      <Field>
        <FieldLabel>{t("settings.service.mode")}</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          className="w-full"
          value={(setMode.isPending ? setMode.variables : config.data?.tunMode) ?? ""}
          disabled={!config.data || setMode.isPending}
          onValueChange={(m) => m && setMode.mutate(m as TunMode, changed)}
        >
          <ToggleGroupItem value="auto" className="flex-1">
            {t("settings.service.modeAuto")}
          </ToggleGroupItem>
          <ToggleGroupItem value="tun" className="flex-1">
            {t("settings.service.modeTun")}
          </ToggleGroupItem>
          <ToggleGroupItem value="userspace" className="flex-1">
            {t("settings.service.modeUserspace")}
          </ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription>{t("settings.service.modeDesc")}</FieldDescription>
      </Field>
      <Field data-invalid={!portValid || undefined}>
        <FieldLabel htmlFor="port">{t("settings.service.port")}</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="port"
            value={port}
            inputMode="numeric"
            onChange={(e) => setDraftPort(e.target.value)}
            aria-invalid={!portValid || undefined}
            disabled={!config.data}
          />
          <Button
            variant="outline"
            disabled={!portValid || port === savedPort || savePort.isPending}
            onClick={() => savePort.mutate(Number(port), portChanged)}
          >
            {savePort.isPending && <Spinner data-icon="inline-start" />}
            {t("common.save")}
          </Button>
        </div>
        {portValid ? (
          <FieldDescription>{t("settings.service.portDesc")}</FieldDescription>
        ) : (
          <FieldError>{t("settings.service.portInvalid")}</FieldError>
        )}
      </Field>
      {needsRestart && running && (
        <Alert>
          <AlertDescription>{t("settings.service.restartNeeded")}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={restart.isPending || stop.isPending}
          onClick={() => restart.mutate(undefined, { onSuccess: () => setNeedsRestart(false) })}
        >
          {restart.isPending ? <Spinner data-icon="inline-start" /> : <RotateCwIcon data-icon="inline-start" />}
          {t("settings.service.restart")}
        </Button>
        {running && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="flex-1" disabled={restart.isPending || stop.isPending}>
                {stop.isPending ? <Spinner data-icon="inline-start" /> : <SquareIcon data-icon="inline-start" />}
                {t("settings.service.stop")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settings.service.stopConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("settings.service.stopConfirmDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => stop.mutate()}>
                  {t("settings.service.stop")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </SettingsCard>
  )
}

const systemValue = "system"

function AppearanceCard() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const [language, setLanguage] = useState<Language | "system">(languagePreference)

  const changeLanguage = (v: string) => {
    const pref = v as Language | "system"
    setLanguage(pref)
    setLanguagePreference(pref)
  }

  return (
    <SettingsCard title={t("settings.ui.title")}>
      <Field>
        <FieldLabel htmlFor="language">{t("settings.ui.language")}</FieldLabel>
        <Select value={language} onValueChange={changeLanguage}>
          <SelectTrigger id="language" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value={systemValue}>{t("settings.ui.system")}</SelectItem>
              {languages.map((l) => (
                <SelectItem key={l} value={l}>
                  {languageNames[l]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>{t("settings.ui.theme")}</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          className="w-full"
          value={theme}
          onValueChange={(v) => v && setTheme(v as Theme)}
        >
          <ToggleGroupItem value={systemValue} className="flex-1">
            {t("settings.ui.system")}
          </ToggleGroupItem>
          <ToggleGroupItem value="light" className="flex-1">
            {t("settings.ui.light")}
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" className="flex-1">
            {t("settings.ui.dark")}
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>
    </SettingsCard>
  )
}

// AccountCard lists the accounts this device is logged in to: the current
// one can log out, the others can be switched to or removed, and more can
// be added.
function AccountCard() {
  const { t } = useTranslation()
  const profiles = useProfiles()
  const current = profiles.data?.find((p) => p.selected)
  const switchTo = useAction(api.switchProfile, { success: t("settings.account.switched") })
  const remove = useAction(api.removeProfile, { success: t("settings.account.removed") })
  const logout = useAction(api.logout, { success: t("settings.account.loggedOut") })
  const busy = switchTo.isPending || remove.isPending || logout.isPending

  return (
    <SettingsCard title={t("settings.account.title")}>
      <ItemGroup className="gap-2">
        {profiles.data?.map((p) => (
          <Item key={p.id} variant={p.selected ? "muted" : "outline"} size="sm">
            <ItemContent className="min-w-0">
              <ItemTitle className="w-full">
                <span className="truncate">{p.account}</span>
                {p.selected && <Badge>{t("settings.account.current")}</Badge>}
              </ItemTitle>
              <ItemDescription className="truncate">{p.tailnet}</ItemDescription>
            </ItemContent>
            <ItemActions>
              {p.selected ? (
                <Confirm
                  title={t("settings.account.logoutConfirmTitle")}
                  description={t("settings.account.logoutConfirmDesc")}
                  action={t("settings.account.logout")}
                  onConfirm={() => logout.mutate()}
                >
                  <Button variant="destructive" size="sm" disabled={busy}>
                    {logout.isPending ? <Spinner data-icon="inline-start" /> : <LogOutIcon data-icon="inline-start" />}
                    {t("settings.account.logout")}
                  </Button>
                </Confirm>
              ) : (
                <>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => switchTo.mutate(p.id)}>
                    {switchTo.isPending && switchTo.variables === p.id ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <ArrowLeftRightIcon data-icon="inline-start" />
                    )}
                    {t("settings.account.switch")}
                  </Button>
                  <Confirm
                    title={t("settings.account.removeConfirmTitle")}
                    description={t("settings.account.removeConfirmDesc", { account: p.account })}
                    action={t("settings.account.remove")}
                    onConfirm={() => remove.mutate(p.id)}
                  >
                    <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={t("settings.account.remove")}>
                      <Trash2Icon />
                    </Button>
                  </Confirm>
                </>
              )}
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      <LoginDrawer restoreProfile={current?.id}>
        <Button variant="outline" disabled={busy || !current}>
          <UserPlusIcon data-icon="inline-start" />
          {t("settings.account.add")}
        </Button>
      </LoginDrawer>
    </SettingsCard>
  )
}

// Confirm asks before a destructive action.
function Confirm({
  title,
  description,
  action,
  onConfirm,
  children,
}: {
  title: string
  description: string
  action: string
  onConfirm: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function AboutCard() {
  const { t } = useTranslation()
  const open = useAction(api.openURL)
  return (
    <SettingsCard title={t("settings.about.title")}>
      <div className="flex flex-col gap-2">
        <Button variant="outline" onClick={() => open.mutate(ADMIN_URL)}>
          <ExternalLinkIcon data-icon="inline-start" />
          {t("settings.about.admin")}
        </Button>
        <Button variant="outline" onClick={() => open.mutate(PROJECT_URL)}>
          <ExternalLinkIcon data-icon="inline-start" />
          {t("settings.about.project")}
        </Button>
      </div>
    </SettingsCard>
  )
}
