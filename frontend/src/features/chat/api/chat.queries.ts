import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'

import { ApiError } from '@shared/api/http'
import { readSSE } from '@shared/lib/sse'

import type {
  ChatMessage,
  Conversation,
  SendResult,
  StreamFinal,
  StreamStart,
} from '../model/types'
import * as api from './chat.api'

export const chatKeys = {
  all: ['chat'] as const,
  conversations: (q: string) => [...chatKeys.all, 'conversations', q] as const,
  conversation: (id: string) => [...chatKeys.all, 'conversation', id] as const,
  messages: (id: string) => [...chatKeys.all, 'messages', id] as const,
  models: () => ['ai-models'] as const,
}

export function useConversations(q: string) {
  return useQuery({
    queryKey: chatKeys.conversations(q),
    queryFn: () => api.listConversations({ q, projectId: null, page: 1 }),
    placeholderData: keepPreviousData,
    select: (page) => page.items,
  })
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: chatKeys.conversation(id ?? ''),
    queryFn: () => api.getConversation(id!),
    enabled: !!id,
  })
}

export function useMessages(id: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(id ?? ''),
    queryFn: () => api.listMessages(id!),
    enabled: !!id,
  })
}

export function useChatModels() {
  return useQuery({ queryKey: chatKeys.models(), queryFn: api.listChatModels, staleTime: 60_000 })
}

function useRefreshLists() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: [...chatKeys.all, 'conversations'] })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  const refresh = useRefreshLists()
  return useMutation({
    mutationFn: api.createConversation,
    onSuccess: (conversation) => {
      queryClient.setQueryData(chatKeys.conversation(conversation.id), conversation)
      queryClient.setQueryData(chatKeys.messages(conversation.id), [])
      refresh()
    },
  })
}

export function useRenameConversation() {
  const queryClient = useQueryClient()
  const refresh = useRefreshLists()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.renameConversation(id, title),
    onSuccess: (conversation) => {
      queryClient.setQueryData(chatKeys.conversation(conversation.id), conversation)
      refresh()
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  const refresh = useRefreshLists()
  return useMutation({
    mutationFn: api.deleteConversation,
    onSuccess: (_void, id) => {
      queryClient.removeQueries({ queryKey: chatKeys.conversation(id) })
      queryClient.removeQueries({ queryKey: chatKeys.messages(id) })
      refresh()
    },
  })
}

export type StreamPhase = 'idle' | 'sending' | 'streaming'

/**
 * Sends a message and streams the reply (decision D5). All state lives in the React Query cache:
 * `start` appends the user + empty assistant message, each `delta` grows the assistant text,
 * `done`/`error` replaces it with the saved server copy. Falls back to the non-streaming endpoint
 * if the stream can't be opened at all. `stop()` aborts; the server keeps the partial answer.
 */
export function useChatStream(conversationId: string | null) {
  const queryClient = useQueryClient()
  const refreshLists = useRefreshLists()
  const [phase, setPhase] = useState<StreamPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const setMessages = useCallback(
    (id: string, update: (messages: ChatMessage[]) => ChatMessage[]) =>
      queryClient.setQueryData<ChatMessage[]>(chatKeys.messages(id), (old) => update(old ?? [])),
    [queryClient],
  )

  const upsert = (list: ChatMessage[], message: ChatMessage) =>
    list.some((m) => m.id === message.id)
      ? list.map((m) => (m.id === message.id ? message : m))
      : [...list, message]

  const applyResult = useCallback(
    (id: string, result: SendResult) => {
      setMessages(id, (list) => {
        const withUser = result.user_message ? upsert(list, result.user_message) : list
        return upsert(withUser, result.assistant_message)
      })
      queryClient.setQueryData<Conversation>(chatKeys.conversation(id), result.conversation)
      refreshLists()
    },
    [queryClient, refreshLists, setMessages],
  )

  const send = useCallback(
    async (content: string, model: string | null, targetId: string | null = conversationId) => {
      if (!targetId) return
      const id = targetId
      setError(null)
      setPhase('sending')
      const controller = new AbortController()
      abortRef.current = controller
      let started = false
      let assistantId: string | null = null

      try {
        let response: Response
        try {
          response = await api.openMessageStream(id, content, model, controller.signal)
        } catch (err) {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) throw err
          if (err instanceof DOMException && err.name === 'AbortError') throw err
          // Streaming unavailable (proxy, network): use the non-streaming endpoint instead.
          applyResult(id, await api.sendMessage(id, content, model))
          return
        }
        if (!response.body) throw new ApiError(0, 'NO_STREAM', 'The server returned no stream.')

        for await (const { event, data } of readSSE(response.body)) {
          if (event === 'start') {
            const start = JSON.parse(data) as StreamStart
            started = true
            assistantId = start.assistant_message.id
            setPhase('streaming')
            setMessages(id, (list) => [
              ...upsert(list, start.user_message),
              start.assistant_message,
            ])
            queryClient.setQueryData<Conversation>(chatKeys.conversation(id), start.conversation)
            refreshLists()
          } else if (event === 'delta' && assistantId) {
            const { text } = JSON.parse(data) as { text: string }
            const target = assistantId
            setMessages(id, (list) =>
              list.map((m) => (m.id === target ? { ...m, content: m.content + text } : m)),
            )
          } else if (event === 'done' || event === 'error') {
            const final = JSON.parse(data) as StreamFinal
            setMessages(id, (list) => upsert(list, final.assistant_message))
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Stopped by the user: the server saved the partial answer; show its copy.
          if (assistantId) {
            const target = assistantId
            setMessages(id, (list) =>
              list.map((m) =>
                m.id === target ? { ...m, status: 'error', error_code: 'STREAM_ABORTED' } : m,
              ),
            )
          }
        } else {
          setError(err instanceof ApiError ? err.message : 'The message could not be sent.')
        }
      } finally {
        abortRef.current = null
        setPhase('idle')
        if (started) {
          // Re-sync with the server copy (final status, tokens, partial text after Stop).
          void queryClient.invalidateQueries({ queryKey: chatKeys.messages(id) })
          refreshLists()
        }
      }
    },
    [applyResult, conversationId, queryClient, refreshLists, setMessages],
  )

  const retry = useCallback(
    async (model: string | null) => {
      if (!conversationId) return
      setError(null)
      setPhase('sending')
      try {
        applyResult(conversationId, await api.retryLastReply(conversationId, model))
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Retry failed.')
      } finally {
        setPhase('idle')
      }
    },
    [applyResult, conversationId],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  return {
    phase,
    busy: phase !== 'idle',
    error,
    clearError: () => setError(null),
    send,
    retry,
    stop,
  }
}
