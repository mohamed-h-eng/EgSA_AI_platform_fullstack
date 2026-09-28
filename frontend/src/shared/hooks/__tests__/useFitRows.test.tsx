import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFitRows } from '../useFitRows'

// jsdom has no layout: fake the media query, the observer, and element sizes.
let matches = true
let bodyHeight = 500
const HEADER = 40
const ROW = 50
let resizeCallbacks: (() => void)[] = []

beforeEach(() => {
  matches = true
  bodyHeight = 500
  resizeCallbacks = []
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      cb: () => void
      constructor(cb: () => void) {
        this.cb = cb
        resizeCallbacks.push(cb)
      }
      observe() {
        queueMicrotask(this.cb)
      }
      disconnect() {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.dataset.testBody ? bodyHeight : 0
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const height = this.tagName === 'THEAD' ? HEADER : this.hasAttribute('data-fit-row') ? ROW : 0
    return { height } as DOMRect
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function Harness({ startPage = 1 }: { startPage?: number }) {
  const [page, setPage] = useState(startPage)
  const { fit, ready, pageSize, attachBody } = useFitRows({
    fallback: 20,
    page,
    onPageChange: setPage,
  })
  return (
    <div>
      <p>
        fit={String(fit)} ready={String(ready)} size={pageSize} page={page}
      </p>
      <div ref={attachBody} data-test-body="1">
        <table>
          <thead>
            <tr>
              <th>h</th>
            </tr>
          </thead>
          <tbody>
            <tr data-fit-row>
              <td>row</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

describe('useFitRows', () => {
  it('fits as many rows as the body can show below the header', async () => {
    render(<Harness />)
    // (500 - 40) / 50 = 9.2 → 9 rows
    expect(await screen.findByText('fit=true ready=true size=9 page=1')).toBeInTheDocument()
  })

  it('recalculates on resize and keeps the first visible record on screen', async () => {
    render(<Harness startPage={3} />)
    await screen.findByText(/size=9 page=3/)
    // Page 3 at 9 rows starts at record 19; at 4 rows that record is on page 5.
    bodyHeight = 240 // (240 - 40) / 50 = 4
    act(() => resizeCallbacks.forEach((cb) => cb()))
    expect(await screen.findByText(/size=4 page=5/)).toBeInTheDocument()
  })

  it('never goes below the minimum', async () => {
    bodyHeight = 60
    render(<Harness />)
    expect(await screen.findByText(/size=3/)).toBeInTheDocument()
  })

  it('falls back to normal paging on small screens', () => {
    matches = false
    render(<Harness />)
    expect(screen.getByText('fit=false ready=true size=20 page=1')).toBeInTheDocument()
  })
})
