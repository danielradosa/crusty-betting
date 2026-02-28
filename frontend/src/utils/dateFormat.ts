const getResolvedLocale = () => {
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase()
  }
  return typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en'
}

export const getLocaleDateFormat = () => {
  const locale = getResolvedLocale()
  if (locale.startsWith('da')) return 'DD. MM. YYYY'
  if (locale.startsWith('en-gb')) return 'DD/MM/YYYY'
  return 'MM/DD/YYYY'
}
