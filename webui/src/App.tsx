import { HouseIcon, MonitorSmartphoneIcon, ScrollTextIcon, SettingsIcon, type LucideIcon } from "lucide-react"
import { lazy, Suspense, useState } from "react"
import { useTranslation } from "react-i18next"

import { ErrorBoundary } from "@/components/error-boundary"
import { StatusDot } from "@/components/status-dot"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useService, useStatus } from "@/hooks/use-tailscale"
import { cn } from "@/lib/utils"
import { DevicesPage } from "@/pages/devices"
import { OverviewPage } from "@/pages/overview"
import { SettingsPage } from "@/pages/settings"

// The log viewer brings a syntax highlighter; load it when first shown.
const LogsPage = lazy(() => import("@/pages/logs").then((m) => ({ default: m.LogsPage })))

type Tab = "overview" | "devices" | "settings" | "logs"

const page = "mx-auto w-full max-w-xl px-4 py-4"

const tabs: { value: Tab; icon: LucideIcon }[] = [
  { value: "overview", icon: HouseIcon },
  { value: "devices", icon: MonitorSmartphoneIcon },
  { value: "settings", icon: SettingsIcon },
  { value: "logs", icon: ScrollTextIcon },
]

export default function App() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>("overview")

  return (
    // Only <main> scrolls: the bars stay put, and overscroll (the WebView's
    // stretch at either end) can't drag them along.
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="h-dvh gap-0 overflow-hidden">
      <header className="shrink-0 border-b bg-background px-4 pt-[max(env(safe-area-inset-top),var(--window-inset-top,0px))]">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-3">
          <h1 className="font-heading text-lg font-semibold">{t(`nav.${tab}`)}</h1>
          <StateBadge />
        </div>
      </header>

      <main className="min-h-0 flex-1 overscroll-none overflow-y-auto">
        <TabsContent value="overview" className={page}>
          <ErrorBoundary>
            <OverviewPage onShowSettings={() => setTab("settings")} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="devices" className={page}>
          <ErrorBoundary>
            <DevicesPage />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="settings" className={page}>
          <ErrorBoundary>
            <SettingsPage />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="logs" className={cn(page, "h-full pb-4")}>
          <ErrorBoundary>
            <Suspense>
              <LogsPage />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>
      </main>

      <nav className="shrink-0 border-t bg-background px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom),var(--window-inset-bottom,0px))]">
        <TabsList className="mx-auto flex w-full max-w-xl group-data-horizontal/tabs:h-14">
          {tabs.map(({ value, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex-col gap-0.5 text-xs">
              <Icon />
              {t(`nav.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </nav>
    </Tabs>
  )
}

function StateBadge() {
  const { t } = useTranslation()
  const service = useService()
  const status = useStatus()

  if (!service.data) return null
  const state = service.data.running ? status.data?.BackendState : undefined
  if (service.data.running && !state) return null

  return (
    <Badge variant={state === "Running" ? "outline" : "secondary"} className="ml-auto">
      <StatusDot online={state === "Running"} />
      {state ? t(`state.${state}`) : t("state.serviceStopped")}
    </Badge>
  )
}
