// Public API of the chat feature. Other code may import ONLY from this file.
export { useConversations } from './api/chat.queries'
export { chatFeature } from './manifest'
export type { ChatMessage, Conversation, SendResult } from './model/types'
