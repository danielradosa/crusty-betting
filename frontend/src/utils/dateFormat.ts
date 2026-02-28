export const getLocaleDateFormat = () => {
  const locale = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en'
  if (locale.startsWith('da')) return 'DD. MM. YYYY'
  if (locale.startsWith('en-gb')) return 'DD/MM/YYYY'
  return 'MM/DD/YYYY'
}
