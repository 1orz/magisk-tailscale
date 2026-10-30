import { FileTextIcon, WrapTextIcon } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/require-service"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockLine,
} from "@/components/ui/code-block"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"
import { useLogs } from "@/hooks/use-tailscale"
import type { LogKind } from "@/lib/types"

const wrapKey = "tsnext.logs.wrap"

function storedWrap(): boolean {
  try {
    return localStorage.getItem(wrapKey) !== "0"
  } catch {
    return true
  }
}

// LogsPage fills the tab: the toolbar stays put while the log scrolls on
// its own, and follows new lines while scrolled to the end.
export function LogsPage() {
  const { t } = useTranslation()
  const [kind, setKind] = useState<LogKind>("tailscaled")
  const [wrap, setWrapState] = useState(storedWrap)
  const logs = useLogs(kind)

  const setWrap = (on: boolean) => {
    setWrapState(on)
    try {
      localStorage.setItem(wrapKey, on ? "1" : "0")
    } catch {
      // Not persisted; still applied for this session.
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          value={kind}
          onValueChange={(v) => v && setKind(v as LogKind)}
        >
          <ToggleGroupItem value="tailscaled">{t("logs.tailscaled")}</ToggleGroupItem>
          <ToggleGroupItem value="service">{t("logs.service")}</ToggleGroupItem>
        </ToggleGroup>
        <Toggle
          variant="outline"
          className="ml-auto"
          pressed={wrap}
          onPressedChange={setWrap}
          aria-label={t("logs.wrap")}
        >
          <WrapTextIcon data-icon="inline-start" />
          {t("logs.wrap")}
        </Toggle>
      </div>

      {logs.isPending ? (
        <Skeleton className="min-h-0 w-full flex-1 rounded-lg" />
      ) : logs.isError ? (
        <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
      ) : logs.data.trim() === "" ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>{t("logs.empty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <LogView key={kind} text={logs.data} wrap={wrap} />
      )}
    </div>
  )
}

function LogView({ text, wrap }: { text: string; wrap: boolean }) {
  const { t } = useTranslation()
  const lines = useHighlightedCode(text, "log")
  const scroller = useRef<HTMLPreElement>(null)
  // Whether the view is at the end, so that new lines should scroll in.
  const atEnd = useRef(true)

  useLayoutEffect(() => {
    const el = scroller.current
    if (el && atEnd.current) el.scrollTop = el.scrollHeight
  }, [lines, wrap])

  const onScroll = () => {
    const el = scroller.current
    if (el) atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
  }

  return (
    <CodeBlock size="sm" className="min-h-0 flex-1">
      <CodeBlockActions>
        <CodeBlockCopyButton value={text} aria-label={t("logs.copyAll")} />
      </CodeBlockActions>
      <CodeBlockContent
        ref={scroller}
        onScroll={onScroll}
        wrap={wrap}
        lineNumbers
        className="h-full overscroll-none text-[11px]"
      >
        {lines.map((line, i) => (
          <CodeBlockLine key={i}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}
