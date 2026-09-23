import type { FeatureManifest } from '@shared/types/feature'

export const authFeature: FeatureManifest = {
  id: 'auth',
  routes: [],
  publicRoutes: [
    {
      path: '/login',
      lazy: async () => ({ Component: (await import('./pages/LoginPage')).LoginPage }),
    },
  ],
  fullscreenRoutes: [
    {
      path: '/change-password',
      lazy: async () => ({
        Component: (await import('./pages/ChangePasswordPage')).ChangePasswordPage,
      }),
    },
  ],
}
