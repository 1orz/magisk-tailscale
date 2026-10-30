import { ActivityIcon, PauseIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { REFRESH_MS } from "@/hooks/use-tailscale"
import { api } from "@/lib/api"
import type { PingResult } from "@/lib/types"

const keep = 30

const chartConfig = {
  ms: { label: "ms", color: "var(--success)" },
} satisfies ChartConfig

// PingPanel pings ip once a second while running, charting the latency of
// the last few round trips and the path (direct or a DERP relay) taken.
export function PingPanel({ ip }: { ip: string }) {
  const { t } = useTranslation()
  const [running, setRunning] = useState(true)
  const [results, setResults] = useState<PingResult[]>([])

  useEffect(() => {
    if (!running) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      const started = Date.now()
      const r = await api.ping(ip).catch(() => ({ at: started }))
      if (stopped) return
      setResults((prev) => [...prev.slice(1 - keep), r])
      timer = setTimeout(tick, Math.max(0, REFRESH_MS - (Date.now() - started)))
    }
    void tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [ip, running])

  const replies = results.filter((r) => r.ms !== undefined).map((r) => r.ms!)
  const last = results.at(-1)
  const lastReply = results.findLast((r) => r.ms !== undefined)
  const loss = results.length ? Math.round((100 * (results.length - replies.length)) / results.length) : 0
  const stat = (v: number | undefined) => (v === undefined ? "–" : `${Math.round(v)} ms`)
  const data = results.map((r, i) => ({ i, ms: r.ms ?? null }))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{t("ping.title")}</span>
        {lastReply && (
          <Badge variant={lastReply.direct ? "outline" : "secondary"}>
            {lastReply.direct ? t("peer.direct") : t("peer.relay", { region: lastReply.via })}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setRunning((r) => !r)}
        >
          {running ? <PauseIcon data-icon="inline-start" /> : <ActivityIcon data-icon="inline-start" />}
          {running ? t("ping.pause") : t("ping.resume")}
        </Button>
      </div>

      <ChartContainer config={chartConfig} className="aspect-auto h-36 w-full">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="i" hide domain={[0, keep - 1]} type="number" />
          <YAxis width={52} tickLine={false} axisLine={false} unit=" ms" allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Line
            dataKey="ms"
            type="monotone"
            stroke="var(--color-ms)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ChartContainer>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          [t("ping.latest"), last && last.ms === undefined ? t("ping.timeout") : stat(last?.ms)],
          [t("ping.avg"), stat(replies.length ? replies.reduce((a, b) => a + b, 0) / replies.length : undefined)],
          [t("ping.min"), stat(replies.length ? Math.min(...replies) : undefined)],
          [t("ping.loss"), `${loss}%`],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="font-mono text-sm">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
