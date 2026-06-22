import de from './de'
import en from './en'

type Strings = typeof de
const strings = { de, en } as const

export function useTranslations(lang: 'de' | 'en' = 'de') {
  return function t(key: keyof Strings): string {
    return strings[lang][key] ?? strings.de[key]
  }
}
