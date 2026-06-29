import sanitizeHtmlLib from 'sanitize-html'

/**
 * Sanitize rich-text HTML coming from the CMS (Directus `pages.content`)
 * before it is rendered with Astro's `set:html`. Editors are semi-trusted,
 * but a compromised CMS account must not be able to inject executable markup
 * into every visitor's browser, so we render through a strict allowlist.
 */
export function sanitizeCmsHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty ?? '', {
    allowedTags: [
      'p', 'br', 'hr',
      'h2', 'h3', 'h4',
      'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'code', 'pre',
      'ul', 'ol', 'li',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
    },
    // Only safe URL schemes; blocks javascript:, data: (except images), etc.
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    // Force external links to be safe.
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
    disallowedTagsMode: 'discard',
  })
}
