import { describe, expect, it } from 'vitest'

import { readSSE } from '@shared/lib/sse'

import { groupByDate } from '../model/groupByDate'
import type { Conversation } from '../model/types'

const conv = (id: string, at: Date | null, created = new Date(2026, 0, 1)): Conversation => ({
  id,
  title: id,
  project: null,
  visibility: 'private',
  message_count: 0,
  last_message_at: at?.toISOString() ?? null,
  created_at: created.toISOString(),
  updated_at: created.toISOString(),
})

describe('groupByDate', () => {
  const now = new Date(2026, 8, 28, 15, 0)

  it('buckets by local calendar day and drops empty groups', () => {
    const groups = groupByDate(
      [
        conv('today', new Date(2026, 8, 28, 0, 5)),
        conv('yesterday', new Date(2026, 8, 27, 23, 59)),
        conv('week', new Date(2026, 8, 22, 9, 0)),
        conv('old', new Date(2026, 7, 1)),
        conv('never-used', null, new Date(2026, 8, 28, 8, 0)),
      ],
      now,
    )
    expect(groups.map((g) => [g.label, g.items.map((c) => c.id)])).toEqual([
      ['Today', ['today', 'never-used']],
      ['Yesterday', ['yesterday']],
      ['Previous 7 days', ['week']],
      ['Older', ['old']],
    ])
    expect(groupByDate([conv('x', new Date(2026, 8, 28, 1))], now).map((g) => g.label)).toEqual([
      'Today',
    ])
  })
})

function streamOf(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c)
      controller.close()
    },
  })
}

describe('readSSE', () => {
  it('parses events split across chunks, including multi-byte Arabic characters', async () => {
    const bytes = new TextEncoder().encode(
      ': keep-alive\n\nevent: delta\ndata: {"text":"مرحبا"}\n\r\nevent: done\ndata: a\ndata: b\n\n',
    )
    // Split inside the Arabic text so a character's bytes straddle two chunks.
    const cut = 30
    const events = []
    for await (const e of readSSE(streamOf([bytes.slice(0, cut), bytes.slice(cut)]))) events.push(e)
    expect(events).toEqual([
      { event: 'delta', data: '{"text":"مرحبا"}' },
      { event: 'done', data: 'a\nb' },
    ])
  })

  it('yields a final event without a trailing blank line', async () => {
    const events = []
    for await (const e of readSSE(streamOf([new TextEncoder().encode('data: tail')]))) {
      events.push(e)
    }
    expect(events).toEqual([{ event: 'message', data: 'tail' }])
  })
})
