/**
 * Sidebar brand block.
 * TODO(brand): replace the placeholder mark with the official EgSA logo file
 * (shared/assets/egsa-logo.svg) — never redraw or distort the real logo (design.md §6).
 */
export function BrandMark() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white"
      >
        EgSA
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-navy">Egyptian Space</p>
        <p className="text-sm font-semibold text-navy">Agency</p>
      </div>
    </div>
  )
}
