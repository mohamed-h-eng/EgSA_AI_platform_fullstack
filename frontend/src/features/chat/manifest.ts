import { MessageSquareText } from 'lucide-react'

import type { FeatureManifest } from '@shared/types/feature'

const page = async () => ({ Component: (await import('./pages/ChatPage')).ChatPage })

export const chatFeature: FeatureManifest = {
  id: 'chat',
  routes: [
    { path: 'chat', handle: { permission: 'chat:use' }, lazy: page },
    { path: 'chat/:conversationId', handle: { permission: 'chat:use' }, lazy: page },
  ],
  nav: [
    { label: 'AI Chat', path: '/chat', icon: MessageSquareText, order: 10, permission: 'chat:use' },
  ],
}
