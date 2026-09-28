import type { ReactNode } from 'react'

/** Dashboard hero (design.md §23). The artwork is an inline SVG: no external images (D1). */
export function HeroBanner({ name, actions }: { name: string; actions?: ReactNode }) {
  return (
    <section
      aria-label="Welcome"
      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-navy-deep via-navy to-primary px-8 py-8 text-white shadow-card"
    >
      <div className="relative z-10 max-w-xl">
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
      <EarthArt />
    </section>
  )
}

function EarthArt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 220"
      className="pointer-events-none absolute -right-10 -bottom-16 hidden h-72 opacity-90 md:block"
    >
      <defs>
        <radialGradient id="hero-earth" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#5b9bff" />
          <stop offset="60%" stopColor="#1f5fd1" />
          <stop offset="100%" stopColor="#0b1f5b" />
        </radialGradient>
        <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#8fb8ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8fb8ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* stars */}
      {[
        [20, 30],
        [60, 12],
        [110, 40],
        [150, 18],
        [40, 90],
        [95, 110],
        [300, 20],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="white" opacity="0.7" />
      ))}
      <circle cx="220" cy="190" r="128" fill="url(#hero-glow)" />
      <circle cx="220" cy="190" r="110" fill="url(#hero-earth)" />
      {/* continents, stylised */}
      <path
        d="M170 120c18-10 40-8 52 4 8 8 2 20-10 22-14 2-18 14-30 12-14-2-26-26-12-38z"
        fill="#3fae6a"
        opacity="0.55"
      />
      <path
        d="M250 110c14 2 26 12 24 24-2 10-16 8-20 18-4 8-18 6-20-4-3-16 2-40 16-38z"
        fill="#3fae6a"
        opacity="0.45"
      />
      {/* orbit + satellite */}
      <ellipse
        cx="220"
        cy="190"
        rx="150"
        ry="46"
        fill="none"
        stroke="white"
        strokeOpacity="0.35"
        strokeDasharray="3 5"
        transform="rotate(-18 220 190)"
      />
      <g transform="translate(92 88) rotate(-18)">
        <rect
          x="-22"
          y="-5"
          width="16"
          height="10"
          fill="#9cc2ff"
          stroke="white"
          strokeWidth="0.8"
        />
        <rect x="6" y="-5" width="16" height="10" fill="#9cc2ff" stroke="white" strokeWidth="0.8" />
        <rect x="-6" y="-7" width="12" height="14" rx="2" fill="#f4f6fb" />
        <line x1="0" y1="7" x2="0" y2="13" stroke="white" strokeWidth="1" />
        <circle cx="0" cy="14" r="2" fill="white" />
      </g>
    </svg>
  )
}
