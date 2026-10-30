import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react"

export type Theme = "system" | "light" | "dark"

const storageKey = "tsnext.theme"
const media = "(prefers-color-scheme: dark)"

interface ThemeState {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(storageKey)
    if (v === "light" || v === "dark") return v
  } catch {
    // Storage can be unavailable in a WebView; follow the system.
  }
  return "system"
}

function systemDark(): boolean {
  return window.matchMedia(media).matches
}

// ThemeProvider toggles the "dark" class on <html> that the shadcn theme
// keys on, following the system unless the user picked a theme.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(storedTheme)
  const [dark, setDark] = useState(systemDark)

  useEffect(() => {
    const mql = window.matchMedia(media)
    const onChange = () => setDark(mql.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  const resolvedTheme = theme === "system" ? (dark ? "dark" : "light") : theme

  // Before paint, so the page never shows in the wrong theme.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", resolvedTheme === "dark")
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    try {
      if (next === "system") localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, next)
    } catch {
      // Not persisted; still applied for this session.
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext)
  if (!state) throw new Error("useTheme outside ThemeProvider")
  return state
}
