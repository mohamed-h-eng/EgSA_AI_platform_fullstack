import { useEffect, useRef, useState } from 'react'

import { useMediaQuery } from './useMediaQuery'

/** Tablet width and up, and tall enough for a useful number of rows. Smaller screens scroll. */
export const FIT_MEDIA_QUERY = '(min-width: 768px) and (min-height: 560px)'

interface FitRowsOptions {
  /** Page size when the table doesn't fit the page (phones, short windows, tests). */
  fallback: number
  /** Row height (px) to assume until a real row (`[data-fit-row]`) can be measured. */
  estimate?: number
  /** Extra space (px) inside the body that isn't rows, e.g. group headings. */
  reserve?: number
  min?: number
  /** The API's maximum page size. */
  max?: number
  /** Current page, so the first visible record stays on screen when the page size changes. */
  page: number
  onPageChange: (page: number) => void
}

/**
 * Full-page tables (user decision, 2026-09-28): the table fills the rest of the page and the
 * number of rows per page is whatever fits, so the table never scrolls; resizing recalculates.
 *
 * Pass `attachBody` as the `ref` of the table body (a `flex-1 min-h-0` element) and mark each data
 * row with `data-fit-row`. When `fit` is false, lay the page out normally and use `pageSize`
 * (the fallback) as before.
 */
export function useFitRows({
  fallback,
  estimate = 53,
  reserve = 0,
  min = 3,
  max = 100,
  page,
  onPageChange,
}: FitRowsOptions) {
  const fit = useMediaQuery(FIT_MEDIA_QUERY)
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [measured, setMeasured] = useState<number | null>(null)
  const pageRef = useRef(page)
  const onPageChangeRef = useRef(onPageChange)
  const sizeRef = useRef<number | null>(null)

  useEffect(() => {
    pageRef.current = page
    onPageChangeRef.current = onPageChange
  })

  useEffect(() => {
    if (!fit || !body || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const header = body.querySelector('thead')?.getBoundingClientRect().height ?? 0
      const row =
        body.querySelector<HTMLElement>('[data-fit-row]')?.getBoundingClientRect().height ||
        estimate
      const rows = Math.floor((body.clientHeight - header - reserve) / row)
      const next = Math.min(max, Math.max(min, rows))
      const previous = sizeRef.current
      if (next === previous) return
      sizeRef.current = next
      setMeasured(next)
      if (previous !== null && pageRef.current > 1) {
        // Keep the first record of the current page visible.
        const firstIndex = (pageRef.current - 1) * previous
        onPageChangeRef.current(Math.floor(firstIndex / next) + 1)
      }
    }
    // Both observers call back asynchronously (the resize one also fires once on observe).
    const resize = new ResizeObserver(measure)
    resize.observe(body)
    const rows = new MutationObserver(measure)
    rows.observe(body, { childList: true, subtree: true })
    return () => {
      resize.disconnect()
      rows.disconnect()
    }
  }, [fit, body, estimate, reserve, min, max])

  return {
    fit,
    /** Wait for the first measurement before querying, so the first request uses the real size. */
    ready: !fit || measured !== null,
    pageSize: fit ? (measured ?? fallback) : fallback,
    attachBody: setBody,
  }
}
