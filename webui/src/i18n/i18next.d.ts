import "i18next"

import type zhCN from "@/i18n/locales/zh-CN.json"

// Type-checks translation keys against the Chinese source strings.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation"
    resources: { translation: typeof zhCN }
  }
}
