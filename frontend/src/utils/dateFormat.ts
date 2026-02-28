const getResolvedLocale = () => {
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase()
  }
  return typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en'
}

const buildLocaleFormat = (locale: string) => {
  try {
    const dtf = new Intl.DateTimeFormat(locale)
    const parts = dtf.formatToParts(new Date(2000, 11, 31))
    const order = parts.filter(p => p.type === 'day' || p.type === 'month' || p.type === 'year').map(p => p.type)
    const sepPart = parts.find(p => p.type === 'literal')
    const sep = sepPart?.value?.trim() || '/'

    const map: Record<string, string> = { day: 'DD', month: 'MM', year: 'YYYY' }
    return order.map(o => map[o]).join(`${sep} `).replace(`${sep} `, `${sep} `).replace(/\s+/g, ' ').trim().replace(`${sep} `, `${sep} `)
      .replace(`${sep} `, `${sep} `) // no-op for clarity
      .replace(/\s+/, ' ')
      .replace(` ${sep}`, `${sep}`)
  } catch {
    return ''
  }
}

export const getLocaleDateFormat = () => {
  const locale = getResolvedLocale()
  const fmt = buildLocaleFormat(locale)
  if (fmt) return fmt

  // Fallbacks
  if (locale.startsWith('da') || locale.startsWith('sk') || locale.startsWith('cs') || locale.startsWith('de')) return 'DD. MM. YYYY'
  if (locale.startsWith('en-gb') || locale.startsWith('en-au') || locale.startsWith('en-nz')) return 'DD/MM/YYYY'
  return 'MM/DD/YYYY'
}
