/** Mirrors backend `schemas/chat.py`. The chat UI arrives in phase 08. */
export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageStatus = 'complete' | 'streaming' | 'error'

export interface ProjectRef {
  id: string
  code: string
  name: string
}

export interface Conversation {
  id: string
  title: string
  project: ProjectRef | null
  visibility: 'private' | 'project' | 'shared'
  message_count: number
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  position: number
  role: MessageRole
  content: string
  model: string | null
  status: MessageStatus
  error_code: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  latency_ms: number | null
  created_at: string
}

export interface SendResult {
  conversation: Conversation
  /** null when retrying a failed reply */
  user_message: ChatMessage | null
  assistant_message: ChatMessage
}

export interface ConversationFilters {
  q: string
  projectId: string | null
  page: number
  /** Rows per page; defaults to CONVERSATIONS_PAGE_SIZE. */
  pageSize?: number
}

export interface ChatModels {
  configured: boolean
  default_model: string | null
  models: { id: string; name: string }[]
}

/** SSE payloads from POST /conversations/{id}/messages/stream */
export interface StreamStart {
  conversation: Conversation
  user_message: ChatMessage
  assistant_message: ChatMessage
}
export interface StreamFinal {
  assistant_message: ChatMessage
}
