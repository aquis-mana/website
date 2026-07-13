import de from './de'

type Strings = typeof de

// EN is not implemented yet (the middleware redirects /en → /). The site is
// DE-only for now, so everything resolves to German. The `lang` param is kept
// so callers don't need to change when EN is reintroduced.
export function useTranslations(_lang: 'de' | 'en' = 'de') {
  return function t(key: keyof Strings): string {
    return de[key]
  }
}
