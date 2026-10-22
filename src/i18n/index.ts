import { en } from './en'
import type { I18nKey } from './en'
import { pt } from './pt'

export type Lang = 'en' | 'pt'
export type { I18nKey }

const dicts: Record<Lang, Record<I18nKey, string>> = { en, pt }

export type T = (key: I18nKey, vars?: Record<string, string | number>) => string

export function translator(lang: Lang): T {
  return (key, vars) => {
    let s = dicts[lang][key] ?? en[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
    return s
  }
}
