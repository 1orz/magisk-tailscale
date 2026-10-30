import { cn } from "@/lib/utils"

// StatusDot marks a device or connection as online (success) or not.
export function StatusDot({ online, className }: { online: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        online ? "bg-success" : "bg-muted-foreground/40",
        className,
      )}
    />
  )
}
