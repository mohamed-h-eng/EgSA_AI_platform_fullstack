import type { ReactNode } from 'react'

import { BrandMark } from '@shared/layout/BrandMark'

/**
 * Split-screen layout for sign-in screens (design.md §2, §8–10).
 * TODO(brand): add the Earth/satellite hero image to the left panel once the asset is provided
 * (shared/assets/hero-earth.jpg). Until then a restrained navy gradient stands in for it.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -bottom-40 size-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgb(23_105_224/0.55),transparent_65%)]"
        />
        <p className="text-sm font-semibold tracking-[0.2em] text-white/70">
          EGYPTIAN SPACE AGENCY
        </p>
        <div className="relative max-w-lg">
          <h1 className="text-4xl leading-tight font-bold text-white">
            EgSA AI Engineering Platform
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Turn engineering knowledge into real progress.
          </p>
          <p className="mt-2 text-sm text-white/60">
            Ask. Search. Build. For a stronger space future.
          </p>
        </div>
        <p className="relative text-xs tracking-wide text-white/60">
          Space for a Brighter Egypt · PEOPLE | KNOWLEDGE | IMPACT
        </p>
      </aside>

      <main className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <BrandMark />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
