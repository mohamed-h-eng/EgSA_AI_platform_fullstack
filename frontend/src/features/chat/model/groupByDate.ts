import type { Conversation } from './types'

export interface ConversationGroup {
  label: 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older'
  items: Conversation[]
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const DAY = 24 * 60 * 60 * 1000

/** Plan §23: history grouped Today / Yesterday / Previous 7 days / Older (local time). */
export function groupByDate(
  conversations: Conversation[],
  now: Date = new Date(),
): ConversationGroup[] {
  const today = startOfDay(now)
  const groups: ConversationGroup[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ]
  for (const c of conversations) {
    const at = new Date(c.last_message_at ?? c.created_at).getTime()
    const index = at >= today ? 0 : at >= today - DAY ? 1 : at >= today - 7 * DAY ? 2 : 3
    groups[index].items.push(c)
  }
  return groups.filter((g) => g.items.length > 0)
}
