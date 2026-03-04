// Normalize names for diacritic-insensitive search.
// Mirrors backend normalize_name() logic closely.

export function normalizeName(input: string): string {
  if (!input) return ''
  // NFKD splits accented chars into base + combining marks
  const nfkd = input.normalize('NFKD')
  const noMarks = nfkd.replace(/[\u0300-\u036f]/g, '')

  return noMarks
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
