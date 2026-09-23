/** "Mohamed Hany" → "MH". Works for Arabic names too (first letter of the first two words). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => Array.from(p)[0] ?? '')
  return letters.join('').toUpperCase() || '?'
}
