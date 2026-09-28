# Frontend Architecture: Feature-Scoped (mandatory)

> This **replaces** the page-based structure in `plan.md` §32.
> Each product feature lives in its own folder with everything it needs, so adding a feature means adding a folder rather than editing many shared folders.

## Folder structure

```text
frontend/
├── index.html
├── vite.config.ts
├── tailwind.config.ts            ← maps design tokens (rules/design-system.md)
├── tsconfig.json                 ← path aliases: @app/*, @features/*, @shared/*
├── .env.example                  ← VITE_API_BASE_URL only (NO secrets)
└── src/
    ├── main.tsx
    │
    ├── app/                      ← composition root: wires features together
    │   ├── App.tsx
    │   ├── providers.tsx         ← QueryClient, Router, AuthProvider, Toaster
    │   ├── router.tsx            ← builds routes from the feature registry
    │   ├── feature-registry.ts   ← list of enabled feature manifests
    │   └── guards/
    │       ├── RequireAuth.tsx
    │       └── RequirePermission.tsx
    │
    ├── features/                 ← ONE folder per feature, self-contained
    │   ├── auth/
    │   ├── dashboard/
    │   ├── chat/                 ← conversations, messages, model picker, streaming
    │   ├── documents/
    │   ├── projects/             ← projects + members
    │   ├── users/                ← users & access (admin), roles
    │   ├── settings/             ← user profile + admin settings (AI config, file limits)
    │   ├── notifications/        ← toast/notification center
    │   └── audit/                ← (optional) admin audit table
    │
    ├── shared/                   ← feature-agnostic building blocks ONLY
    │   ├── ui/                   ← shadcn/ui components (generated here via components.json),
    │   │                           restyled with EgSA tokens + composites: StatCard, SearchBar,
    │   │                           FileTypeIcon, EmptyState, ErrorState, PageHeader…
    │   ├── layout/               ← AppShell, Sidebar, Header, PageHeader, HeroBanner, Breadcrumbs
    │   ├── api/                  ← http client (fetch/axios wrapper, auth header, refresh, errors)
    │   ├── hooks/                ← useDebounce, useDisclosure…
    │   ├── lib/                  ← formatters (date, file size), cn(), constants
    │   ├── types/                ← cross-cutting types (Paginated<T>, ApiError, Permission)
    │   └── assets/               ← EgSA logo, hero imagery, self-hosted fonts (no CDN, D1)
    │
    └── styles/
        ├── tokens.css            ← CSS variables from design.md §43
        └── globals.css
```

## Anatomy of a feature

Every feature folder uses the same internal layout. Leave out subfolders the feature doesn't need.

```text
features/<feature>/
├── index.ts            ← PUBLIC API: the only file other code may import
├── manifest.ts         ← routes + nav items + required permissions (see below)
├── api/                ← endpoint functions + TanStack Query hooks
│   ├── <feature>.api.ts        (raw calls: listDocuments(), uploadDocument()…)
│   └── <feature>.queries.ts    (useDocuments(), useUploadDocument()…, query keys)
├── components/         ← UI pieces used only by this feature
├── pages/              ← route-level components (lazy-loaded)
├── hooks/              ← feature-specific hooks
├── model/              ← types.ts, zod schemas, mappers, constants
└── __tests__/          ← unit/component tests for this feature
```

### `manifest.ts` contract

```ts
// shared/types/feature.ts
export interface FeatureManifest {
  id: string;                          // 'documents'
  routes: RouteObject[];               // lazy page routes, mounted inside AppShell
                                       //   add `handle: { permission: 'users:create' }` to a route
                                       //   and the app wraps it in <RequirePermission>
  publicRoutes?: RouteObject[];        // e.g. /login (outside AppShell, no auth)
  fullscreenRoutes?: RouteObject[];    // authenticated but no AppShell, e.g. /change-password
  slots?: Partial<Slots>;              // UI contributed to OTHER features (see "Extension slots")
  nav?: {
    label: string; path: string; icon: LucideIcon;
    order: number; permission?: PermissionCode; section?: 'main' | 'admin';
  }[];
}
```

`app/feature-registry.ts` just lists the manifests:

```ts
export const features = [authFeature, dashboardFeature, chatFeature, documentsFeature,
  projectsFeature, usersFeature, settingsFeature, notificationsFeature];
```

The router and sidebar are generated from this registry. **To add a feature, create the folder and add one line here.**

## Extension slots (cross-feature UI without cycles)

When feature A must show UI owned by feature B, but B already depends on A (e.g. documents uses
`ProjectSelect`, and projects must show a Documents tab), **don't import B from A**. Instead:

1. Add a slot type to `shared/lib/slots.ts` (e.g. `projectTabs: ProjectTabSlot[]`).
2. Feature B declares its contribution in `manifest.slots`.
3. `app/feature-registry.ts` collects all contributions and `App` provides them via `<SlotsProvider>`.
4. Feature A renders them with `useSlot('projectTabs')`, knowing nothing about B.

## Dependency rules (enforce with ESLint `import/no-restricted-paths` or `eslint-plugin-boundaries`)

| From → To                      | Allowed?                                       |
| ------------------------------ | ---------------------------------------------- |
| `app` → `features/*/index.ts`  | ✅                                             |
| `app` → `shared`               | ✅                                             |
| `features/X` → `shared`        | ✅                                             |
| `features/X` → `features/Y/index.ts` | ⚠️ Only for public components/hooks (e.g. dashboard shows `RecentDocuments` from documents). Keep it rare. |
| `features/X` → `features/Y/<internal>` | ❌ never                              |
| `shared` → `features` or `app` | ❌ never                                       |
| any → `app`                    | ❌ (except `main.tsx`)                         |

No circular dependencies between features. If two features need the same thing, move it into `shared/`, and only if it is truly feature-agnostic.

## Conventions

- **Server state lives in TanStack Query.** Query keys are defined per feature (`documentsKeys.list(filters)`). Don't copy server data into global state.
- **Auth session** (`user`, `permissions`, `accessToken`) comes from `features/auth` via `useAuth()` and `usePermission(code)`, both exported from `features/auth/index.ts`.
- **Permission-aware UI:** use `<Can permission="documents:upload">` or `usePermission()` to hide actions. The backend remains the authority.
- **Pages are lazy-loaded** (`lazy: () => import('./pages/DocumentsPage')`).
- **Naming:** components `PascalCase.tsx`; hooks `useX.ts`; api `x.api.ts`; types in `model/types.ts`.
- **Types mirror backend schemas.** Keep them in `model/types.ts`. OpenAPI codegen (`openapi-typescript`) may replace this later.
- **Every data view has** a loading state, an empty state, and an error state (design §§ empty/error states).
- **No hard-coded colors** in components; use Tailwind theme tokens only.
- **shadcn/ui (D6):** add components with `pnpm dlx shadcn@latest add <name>` into `shared/ui`. They're owned code, so restyle them freely, but keep the Radix accessibility behavior.
- **No external runtime URLs (D1):** fonts go through `@fontsource/*` or local files, and images live in `shared/assets`. Never load Google Fonts or CDN scripts.
- **UI copy is English only (D3).** User-generated text (chat messages, titles, document names) can be Arabic, so render it with `dir="auto"` and never assume left-to-right for user content.
- **Package manager:** pnpm (`pnpm-lock.yaml` committed).

## Feature → backend domain → route map

| Feature         | Routes (FE)                                | Backend router(s)                     |
| --------------- | ------------------------------------------ | ------------------------------------- |
| auth            | `/login`                                   | `/auth`                               |
| dashboard       | `/`                                        | `/dashboard/summary`                  |
| chat            | `/chat`, `/chat/:conversationId`           | `/conversations`, `/ai/models`        |
| documents       | `/documents`, `/documents/:id`; + project tab via slot | `/documents` (+ `/categories`, `/upload-config`) |
| projects        | `/projects`, `/projects/:id`               | `/projects`, `/projects/{id}/members` |
| users           | `/admin/users` (gated by `users:create`)   | `/users`, `/roles`                    |
| settings        | `/settings`, `/admin/settings`             | `/me`, `/admin/ai/config`, `/admin/settings` |
| notifications   | (global toaster)                           | none (client-side)                    |
| audit           | `/admin/audit` (optional)                  | `/admin/audit-logs`                   |
