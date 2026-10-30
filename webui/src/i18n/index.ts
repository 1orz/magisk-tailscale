import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "@/i18n/locales/en.json"
import ja from "@/i18n/locales/ja.json"
import zhCN from "@/i18n/locales/zh-CN.json"

export const languages = ["zh-CN", "en", "ja"] as const
export type Language = (typeof languages)[number]

// The language picker shows each language in its own name.
export const languageNames: Record<Language, string> = {
  "zh-CN": "简体中文",
  en: "English",
  ja: "日本語",
}

export const resources = {
  "zh-CN": { translation: zhCN },
  en: { translation: en },
  ja: { translation: ja },
} as const

const storageKey = "tsnext.language"

// languagePreference is the language the user picked, or "system".
export function languagePreference(): Language | "system" {
  try {
    const v = localStorage.getItem(storageKey)
    if (v && (languages as readonly string[]).includes(v)) return v as Language
  } catch {
    // Storage can be unavailable in a WebView; follow the system.
  }
  return "system"
}

export function systemLanguage(): Language {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const lower = tag.toLowerCase()
    if (lower.startsWith("zh")) return "zh-CN"
    if (lower.startsWith("ja")) return "ja"
    if (lower.startsWith("en")) return "en"
  }
  return "en"
}

export function setLanguagePreference(pref: Language | "system") {
  try {
    if (pref === "system") localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, pref)
  } catch {
    // Not persisted; still applied for this session.
  }
  void i18n.changeLanguage(pref === "system" ? systemLanguage() : pref)
}

const initial = languagePreference()

void i18n.use(initReactI18next).init({
  resources,
  lng: initial === "system" ? systemLanguage() : initial,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng
})
document.documentElement.lang = i18n.language

export default i18n
