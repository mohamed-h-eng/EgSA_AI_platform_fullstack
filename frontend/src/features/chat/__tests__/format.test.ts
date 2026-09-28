import { describe, expect, it } from 'vitest'

import { formatDuration, shortModelName } from '../model/format'

describe('chat format helpers', () => {
  it('shortens model ids for display', () => {
    expect(shortModelName('meta-llama/llama-3.3-70b-instruct:free')).toBe('llama-3.3-70b-instruct')
    expect(shortModelName('local-model')).toBe('local-model')
  })

  it('formats response times', () => {
    expect(formatDuration(850)).toBe('0.9s')
    expect(formatDuration(12_300)).toBe('12s')
    expect(formatDuration(75_000)).toBe('1m 15s')
  })
})
