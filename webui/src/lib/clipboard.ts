// copyText copies text to the clipboard. The async Clipboard API is not
// always granted inside a manager's WebView, so fall back to a selection
// and execCommand.
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Fall through to the legacy path.
  }
  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.opacity = "0"
  document.body.append(area)
  area.select()
  const ok = document.execCommand("copy")
  area.remove()
  if (!ok) {
    throw new Error("copy failed")
  }
}
