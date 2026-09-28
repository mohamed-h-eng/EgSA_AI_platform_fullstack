import { http, httpStream } from '@shared/api/http'
import type { Page } from '@shared/types/api'

import type {
  ChatMessage,
  ChatModels,
  Conversation,
  ConversationFilters,
  SendResult,
} from '../model/types'

export const CONVERSATIONS_PAGE_SIZE = 50

export function listConversations(filters: ConversationFilters): Promise<Page<Conversation>> {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize ?? CONVERSATIONS_PAGE_SIZE),
  })
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.projectId) params.set('project_id', filters.projectId)
  return http(`/conversations?${params}`)
}

export function getConversation(id: string): Promise<Conversation> {
  return http(`/conversations/${id}`)
}

export function createConversation(body: {
  project_id?: string | null
  title?: string
}): Promise<Conversation> {
  return http('/conversations', { method: 'POST', json: body })
}

export function renameConversation(id: string, title: string): Promise<Conversation> {
  return http(`/conversations/${id}`, { method: 'PATCH', json: { title } })
}

export function deleteConversation(id: string): Promise<void> {
  return http(`/conversations/${id}`, { method: 'DELETE' })
}

export function listMessages(conversationId: string): Promise<ChatMessage[]> {
  return http(`/conversations/${conversationId}/messages`)
}

export function listChatModels(): Promise<ChatModels> {
  return http('/ai/models')
}

/** Opens the SSE stream for a new message; the caller reads the body with readSSE(). */
export function openMessageStream(
  conversationId: string,
  content: string,
  model: string | null,
  signal: AbortSignal,
): Promise<Response> {
  return httpStream(`/conversations/${conversationId}/messages/stream`, {
    method: 'POST',
    json: { content, model },
    signal,
  })
}

export function retryLastReply(conversationId: string, model: string | null): Promise<SendResult> {
  return http(`/conversations/${conversationId}/retry`, { method: 'POST', json: { model } })
}

export function sendMessage(
  conversationId: string,
  content: string,
  model: string | null,
): Promise<SendResult> {
  return http(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    json: { content, model },
  })
}

/** Edit your latest message; the reply after it is regenerated in place. */
export function editMessage(
  conversationId: string,
  messageId: string,
  content: string,
  model: string | null,
): Promise<SendResult> {
  return http(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PUT',
    json: { content, model },
  })
}
