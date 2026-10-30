import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { copyText } from "@/lib/clipboard"

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await copyText(value)
      setCopied(true)
      toast.success(t("common.copied"), { description: value })
    } catch {
      toast.error(t("common.copyFailed"))
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={copy} aria-label={label ?? t("common.copy")}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}
