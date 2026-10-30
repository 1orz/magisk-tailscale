import type { ReactNode } from "react"

import { CopyButton } from "@/components/copy-button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"

// ValueRow shows a labelled value, with a copy button when copy is set.
export function ValueRow({
  label,
  value,
  copy,
  action,
}: {
  label: string
  value: ReactNode
  copy?: string
  action?: ReactNode
}) {
  return (
    <Item size="sm" className="px-0 py-1.5">
      <ItemContent className="min-w-0">
        <ItemDescription>{label}</ItemDescription>
        <ItemTitle className="w-full font-mono break-all">{value}</ItemTitle>
      </ItemContent>
      {(copy || action) && (
        <ItemActions>
          {action}
          {copy && <CopyButton value={copy} label={label} />}
        </ItemActions>
      )}
    </Item>
  )
}
