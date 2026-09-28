export interface SSEEvent {
  event: string
  data: string
}

/**
 * Parse a Server-Sent Events byte stream into events (spec subset: `event:` and `data:` fields,
 * multi-line data joined with "\n", comment lines starting with ":" ignored).
 */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      // stream: true keeps multi-byte characters (Arabic) intact across chunk boundaries.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const parsed = parseBlock(block)
        if (parsed) yield parsed
      }
    }
    const tail = parseBlock(buffer + decoder.decode())
    if (tail) yield tail
  } finally {
    reader.releaseLock()
  }
}

function parseBlock(block: string): SSEEvent | null {
  let event = 'message'
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }
  return data.length ? { event, data: data.join('\n') } : null
}
