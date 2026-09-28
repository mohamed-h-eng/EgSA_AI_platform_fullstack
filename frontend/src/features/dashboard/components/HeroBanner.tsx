import type { ReactNode } from 'react'

import { EgsaLogo } from '@shared/ui/egsa-logo'

/** Dashboard hero (design.md §23) with the animated EgSA logo on the right (white ink on navy).
 *  Everything is drawn locally: no external images (D1). */
export function HeroBanner({ name, actions }: { name: string; actions?: ReactNode }) {
  return (
    <section
      aria-label="Welcome"
      className="relative flex items-center justify-between gap-8 overflow-hidden rounded-xl bg-gradient-to-br from-navy-deep via-navy to-primary px-8 py-8 text-white shadow-card"
    >
      <div className="relative z-10 max-w-xl min-w-0">
        <p className="text-xs font-semibold tracking-[0.2em] text-white/70">
          EGYPTIAN SPACE AGENCY
        </p>
        <h1 dir="auto" className="mt-3 text-3xl font-bold tracking-tight text-white">
          Welcome, {name}
        </h1>
        <p className="mt-2 text-lg text-white/90">Turn engineering knowledge into real progress.</p>
        <p className="mt-1 text-sm text-white/70">
          Ask. Search. Build. For a stronger space future.
        </p>
        {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
      </div>
      <EgsaLogo
        variant="full"
        animated
        tone="light"
        label=""
        className="hidden h-[clamp(112px,14vw,156px)] md:block"
      />
    </section>
  )
}
