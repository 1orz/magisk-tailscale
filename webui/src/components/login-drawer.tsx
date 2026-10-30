import { CopyIcon, ExternalLinkIcon } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAction, useStatus } from "@/hooks/use-tailscale"
import { api } from "@/lib/api"
import { copyText } from "@/lib/clipboard"

// LoginDrawer starts an interactive login when opened and shows its URL,
// as a link and as a QR code for logging in from another device.
//
// `tailscale login` logs in to a new, empty profile, so the drawer also
// adds accounts. For that, pass the current profile as restoreProfile: a
// login abandoned by closing the drawer switches back to it, and a
// finished one closes the drawer.
export function LoginDrawer({
  authURL = "",
  restoreProfile,
  children,
}: {
  authURL?: string
  restoreProfile?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const login = useAction(api.login)
  const openURL = useAction(api.openURL)
  const restore = useAction(api.cancelLogin)
  const status = useStatus()
  const state = status.data?.BackendState
  const url = status.data?.AuthURL || authURL

  // Seeing NeedsLogin after opening, then Running, means the new account
  // logged in.
  const awaiting = useRef(false)
  useEffect(() => {
    if (!open || !restoreProfile) return
    if (state === "NeedsLogin") {
      awaiting.current = true
    } else if (state === "Running" && awaiting.current) {
      awaiting.current = false
      setOpen(false)
      toast.success(t("login.success"))
    }
  }, [open, restoreProfile, state, t])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && (restoreProfile || !url)) login.mutate()
    // A finished login closes the drawer itself, so closing it here means
    // giving up. Restore even while still Running: the background login
    // may not have switched to the new profile yet.
    if (!next && restoreProfile) {
      awaiting.current = false
      restore.mutate(restoreProfile)
    }
  }

  const copy = async () => {
    try {
      await copyText(url)
      toast.success(t("common.copied"))
    } catch {
      toast.error(t("common.copyFailed"))
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="mx-auto max-w-xl">
        <DrawerHeader>
          <DrawerTitle>{t("login.drawerTitle")}</DrawerTitle>
          <DrawerDescription>{url ? t("login.drawerDesc") : t("login.waiting")}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col items-center gap-3 px-4">
          {url ? (
            <>
              {/* QR codes scan reliably only as dark modules on light. */}
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={url} size={192} bgColor="#ffffff" fgColor="#000000" />
              </div>
              <p className="w-full font-mono text-xs break-all text-muted-foreground">{url}</p>
            </>
          ) : (
            <Skeleton className="size-54 rounded-lg" />
          )}
        </div>
        <DrawerFooter>
          <Button disabled={!url || openURL.isPending} onClick={() => openURL.mutate(url)}>
            {openURL.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ExternalLinkIcon data-icon="inline-start" />
            )}
            {t("login.openBrowser")}
          </Button>
          <Button variant="outline" disabled={!url} onClick={copy}>
            <CopyIcon data-icon="inline-start" />
            {t("login.copyLink")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
