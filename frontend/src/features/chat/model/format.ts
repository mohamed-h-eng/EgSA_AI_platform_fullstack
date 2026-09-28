/** "meta-llama/llama-3.3-70b-instruct:free" → "llama-3.3-70b-instruct" (fallback label). */
export function shortModelName(id: string): string {
  return id
    .split('/')
    .pop()!
    .replace(/:free$/, '')
}

/** 850 → "0.9s", 12_300 → "12s", 75_000 → "1m 15s" */
export function formatDuration(ms: number): string {
  if (ms < 10_000) return `${(Math.round(ms / 100) / 10).toFixed(1)}s`
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}m ${s % 60}s`
}
