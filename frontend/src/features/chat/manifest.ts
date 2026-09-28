import type { FeatureManifest } from '@shared/types/feature'

import { RecentChats } from './components/RecentChats'

const chatPage = async () => ({ Component: (await import('./pages/ChatPage')).ChatPage })

export const chatFeature: FeatureManifest = {
  id: 'chat',
  routes: [
    { path: 'chat', handle: { permission: 'chat:use' }, lazy: chatPage },
    { path: 'chat/:conversationId', handle: { permission: 'chat:use' }, lazy: chatPage },
    {
      path: 'chats',
      handle: { permission: 'chat:use' },
      lazy: async () => ({ Component: (await import('./pages/ChatsPage')).ChatsPage }),
    },
  ],
  slots: {
    // The sidebar's "Recents" block (workflow 11): chat history lives in the app sidebar.
    sidebarSections: [
      { id: 'recent-chats', order: 10, permission: 'chat:use', Component: RecentChats },
    ],
  },
}
