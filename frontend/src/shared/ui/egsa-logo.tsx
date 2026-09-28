import { useEffect, useRef } from 'react'

import { cn } from '@shared/lib/utils'

/**
 * EgSA logo drawn on a canvas (supplied by the user, 2026-09-28): tilted orbit with two gaps,
 * thick swoosh with the red crescent inside it, "EgSA", the satellite, and — in the `full`
 * variant — the Arabic/English agency lines.
 *
 * - `animated` (dashboard banner): a one-time ~1.7 s intro (orbit draws, swoosh sweeps,
 *   satellite glides in, text fades in), then a very small idle (satellite drift, antenna
 *   blink). Paused in background tabs (a tab opened in the background skips the intro); under
 *   prefers-reduced-motion the finished logo is drawn.
 * - static (sidebar, chat): the finished logo, drawn once (and again on resize / font load).
 * - `tone="light"` draws white ink for dark backgrounds; the red stays brand red.
 *
 * All geometry is in the artwork's own 1200×880 coordinate space.
 */

type Variant = 'full' | 'mark'

// Crop of the 1200×880 artwork. `mark` drops the agency lines (unreadable at small sizes).
const VIEWS: Record<Variant, { x: number; y: number; w: number; h: number }> = {
  full: { x: 55, y: 60, w: 1100, h: 790 },
  mark: { x: 55, y: 60, w: 1100, h: 620 },
}
const C = { x: 605, y: 370 } // orbit centre
const RX = 590
const RY = 118
const TILT = (-27 * Math.PI) / 180
const RING = 11 // orbit line width
const BRAND_RED = '#e3000f'
const SAT_REST = 65 // satellite's resting position on the orbit (degrees)
const INTRO_MS = 1750
const IDLE_FPS = 30

const COS_T = Math.cos(TILT)
const SIN_T = Math.sin(TILT)
const rad = (deg: number) => (deg * Math.PI) / 180
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3)
const phase = (t: number, start: number, end: number) => clamp01((t - start) / (end - start))

/** Point on the orbit at angle θ (degrees), optionally offset inward/outward from the line. */
function orbitPoint(deg: number, offset = 0): [number, number] {
  const x = (RX + offset) * Math.cos(rad(deg))
  const y = (RY + offset) * Math.sin(rad(deg))
  return [C.x + x * COS_T - y * SIN_T, C.y + x * SIN_T + y * COS_T]
}

// Thick swoosh band on the lower-left, drawn from the orbit line inward (θ 96°–242°).
const BAND = { from: 96, to: 242 }
function bandWidth(deg: number) {
  const u = clamp01((deg - BAND.from) / (BAND.to - BAND.from))
  return Math.max(3, RING + 26 * Math.sin(Math.PI * Math.pow(u, 0.8)) - 8 * Math.pow(u, 8))
}

// Red crescent: its outer edge runs just inside the band (θ 100°–240°, small gap); its inner
// edge is the rounded "bowl" traced from the official artwork, solid at the left end.
const RED = { from: 100, to: 240, gap: 9 }
const redOffset = (deg: number) => RING / 2 - bandWidth(deg) - RED.gap
const RED_INNER: Array<[number, number]> = [
  [270, 445],
  [256, 490],
  [266, 528],
  [300, 549],
  [360, 551],
  [440, 539],
  [520, 525],
]

// Visible orbit line: two arcs, leaving gaps behind "EgSA" and behind the satellite.
const RING_SEGMENTS: Array<[number, number]> = [
  [78, 242],
  [268, 412],
]
const SWEEP = { from: 78, to: 412 } // the intro draws the orbit in this order

interface Palette {
  ink: string
  red: string
}

/** Band between two offsets of the orbit, from θ `from` to `to`. */
function drawCrescent(
  ctx: CanvasRenderingContext2D,
  from: number,
  to: number,
  outer: (deg: number) => number,
  inner: (deg: number) => number,
) {
  const steps = Math.ceil((to - from) / 2)
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const d = from + ((to - from) * i) / steps
    const [x, y] = orbitPoint(d, outer(d))
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  for (let i = steps; i >= 0; i--) {
    const d = from + ((to - from) * i) / steps
    const [x, y] = orbitPoint(d, inner(d))
    ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

/** Red crescent: outer edge along the band (top tip → right tip), inner edge a smooth curve back. */
function drawRed(ctx: CanvasRenderingContext2D) {
  const steps = 70
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const d = RED.to - ((RED.to - RED.from) * i) / steps
    const [x, y] = orbitPoint(d, redOffset(d))
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  // Back from the right tip to the top tip through the traced bowl, smoothed via midpoints.
  const pts = [
    orbitPoint(RED.from, redOffset(RED.from)),
    ...[...RED_INNER].reverse(),
    orbitPoint(RED.to, redOffset(RED.to)),
  ]
  for (let i = 1; i < pts.length - 1; i++) {
    const [cx, cy] = pts[i]
    const [nx, ny] = pts[i + 1]
    ctx.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2)
  }
  ctx.lineTo(...pts[pts.length - 1])
  ctx.closePath()
  ctx.fill()
}

/** Screen angle (radians, unwrapped past `min`) of the orbit point at θ, seen from the centre. */
function screenAngle(deg: number, min = -Infinity) {
  const [x, y] = orbitPoint(deg)
  let a = Math.atan2(y - C.y, x - C.x)
  while (a < min) a += Math.PI * 2
  return a
}
const SWEEP_START = screenAngle(SWEEP.from - 4)

/** Clip to the pie slice the intro has swept so far (from the start of the orbit to θ `deg`). */
function clipSweep(ctx: CanvasRenderingContext2D, deg: number) {
  ctx.beginPath()
  ctx.moveTo(C.x, C.y)
  ctx.arc(C.x, C.y, 2000, SWEEP_START, screenAngle(deg, SWEEP_START), false)
  ctx.closePath()
  ctx.clip()
}

function drawSatellite(
  ctx: CanvasRenderingContext2D,
  deg: number,
  palette: Palette,
  alpha: number,
  light: number,
) {
  const [ox, oy] = orbitPoint(deg)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(ox + 2, oy + 5)
  ctx.rotate(rad(12))
  ctx.strokeStyle = palette.ink
  ctx.fillStyle = palette.ink

  // Solar panels: outlined lattices above and below the body.
  const panel = (x: number, y: number, w: number, h: number, cols: number, rows: number) => {
    ctx.lineWidth = 5
    ctx.strokeRect(x, y, w, h)
    ctx.lineWidth = 2.2
    ctx.beginPath()
    for (let c = 1; c < cols; c++) {
      ctx.moveTo(x + (w * c) / cols, y)
      ctx.lineTo(x + (w * c) / cols, y + h)
    }
    for (let r = 1; r < rows; r++) {
      ctx.moveTo(x, y + (h * r) / rows)
      ctx.lineTo(x + w, y + (h * r) / rows)
    }
    ctx.stroke()
  }
  panel(-28, -148, 62, 116, 4, 8)
  panel(-34, 31, 58, 110, 4, 8)

  // Body.
  ctx.fillRect(-42, -27, 84, 56)

  // Dish (half-disc opening left), stalk, and antenna tip.
  ctx.beginPath()
  ctx.ellipse(-50, -3, 13, 32, 0, Math.PI / 2, (3 * Math.PI) / 2)
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-52, -6)
  ctx.lineTo(-96, -16)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(-99, -17, 6, 0, Math.PI * 2)
  ctx.fill()

  // Antenna light (idle blink).
  if (light > 0) {
    ctx.globalAlpha = alpha * light
    ctx.fillStyle = palette.red
    ctx.beginPath()
    ctx.arc(-99, -17, 9, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Largest font size (up to `max`) whose text fits `width`, for the given font template. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  template: (px: number) => string,
  width: number,
  max: number,
) {
  ctx.font = template(max)
  const measured = ctx.measureText(text).width
  const size = measured > width ? (max * width) / measured : max
  return template(size)
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  t: number,
  idleT: number,
  palette: Palette,
  fonts: { latin: string; arabic: string },
  variant: Variant,
) {
  // Orbit line and swoosh band, revealed by a sweep around the orbit during the intro.
  const ringProgress = easeOut(phase(t, 0, 1000))
  ctx.save()
  if (ringProgress < 1) clipSweep(ctx, SWEEP.from + (SWEEP.to - SWEEP.from) * ringProgress)
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = RING
  ctx.lineCap = 'round'
  for (const [a, b] of RING_SEGMENTS) {
    ctx.beginPath()
    for (let d = a; d <= b; d += 1.5) {
      const [x, y] = orbitPoint(d)
      if (d === a) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.lineTo(...orbitPoint(b))
    ctx.stroke()
  }
  ctx.fillStyle = palette.ink
  drawCrescent(
    ctx,
    BAND.from,
    BAND.to,
    () => RING / 2,
    (d) => RING / 2 - bandWidth(d),
  )
  ctx.restore()

  // Red crescent trails slightly behind the sweep.
  const redProgress = easeOut(phase(t, 200, 1100))
  ctx.save()
  if (redProgress < 1) clipSweep(ctx, SWEEP.from + (SWEEP.to - SWEEP.from) * redProgress)
  ctx.fillStyle = palette.red
  drawRed(ctx)
  ctx.restore()

  // Satellite glides along the orbit into place, then drifts very slightly.
  const glide = easeOut(phase(t, 450, 1500))
  const idleDrift = t >= INTRO_MS ? 1.2 * Math.sin((idleT / 9000) * Math.PI * 2) : 0
  const satDeg = SAT_REST - 110 * (1 - glide) + idleDrift
  const blink = t >= INTRO_MS ? Math.max(0, Math.sin((idleT / 2400) * Math.PI * 2)) ** 12 : 0
  drawSatellite(ctx, satDeg, palette, phase(t, 450, 700), blink)

  // Wordmark and agency lines fade in.
  ctx.textBaseline = 'alphabetic'
  const word = easeOut(phase(t, 500, 1100))
  ctx.globalAlpha = word
  ctx.fillStyle = palette.ink
  ctx.textAlign = 'left'
  ctx.font = fitFont(ctx, 'EgSA', (px) => `700 ${px}px ${fonts.latin}`, 340, 150)
  ctx.fillText('EgSA', 270, 368 + 12 * (1 - word))

  if (variant === 'full') {
    ctx.textAlign = 'center'
    ctx.globalAlpha = easeOut(phase(t, 950, 1550))
    ctx.fillStyle = palette.red
    ctx.font = fitFont(ctx, 'وكالة الفضاء المصرية', (px) => `700 ${px}px ${fonts.arabic}`, 530, 80)
    ctx.fillText('وكالة الفضاء المصرية', 665, 722)

    ctx.globalAlpha = easeOut(phase(t, 1100, 1700))
    ctx.fillStyle = palette.ink
    ctx.font = fitFont(ctx, 'Egyptian Space Agency', (px) => `700 ${px}px ${fonts.latin}`, 680, 72)
    ctx.fillText('Egyptian Space Agency', 660, 810)
  }
  ctx.globalAlpha = 1
}

function canvasContext(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  try {
    return canvas?.getContext('2d') ?? null
  } catch {
    return null // no canvas support (e.g. test environments)
  }
}

interface EgsaLogoProps {
  variant?: Variant
  animated?: boolean
  /** 'brand' = navy ink for light surfaces; 'light' = white ink for dark surfaces. */
  tone?: 'brand' | 'light'
  /** Size it with a height class (the width follows the aspect ratio). */
  className?: string
  /** Accessible name; pass '' when the logo is decorative next to visible text. */
  label?: string
}

export function EgsaLogo({
  variant = 'mark',
  animated = false,
  tone = 'brand',
  className,
  label = 'Egyptian Space Agency (EgSA)',
}: EgsaLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const view = VIEWS[variant]

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvasContext(canvas)
    if (!canvas || !ctx) return

    const reducedMotion =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null
    const moving = () => animated && !reducedMotion?.matches
    let palette: Palette = { ink: '#0b1f5b', red: BRAND_RED }
    let fonts = { latin: 'sans-serif', arabic: 'sans-serif' }
    let frame = 0
    let started = performance.now()
    let lastIdle = 0

    const readTheme = () => {
      const css = getComputedStyle(document.documentElement)
      const navy = css.getPropertyValue('--egsa-navy').trim() || '#0b1f5b'
      palette = { ink: tone === 'light' ? '#ffffff' : navy, red: BRAND_RED }
      const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
      fonts = { latin: family, arabic: `"IBM Plex Sans Arabic", ${family}` }
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
    }

    const paint = (now: number) => {
      if (!canvas.width) return
      const scale = canvas.width / view.w
      ctx.setTransform(scale, 0, 0, scale, -view.x * scale, -view.y * scale)
      ctx.clearRect(view.x, view.y, view.w, view.h)
      const t = moving() ? now - started : INTRO_MS
      drawLogo(ctx, t, moving() ? now : 0, palette, fonts, variant)
    }

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      // Full frame rate for the intro; the idle only needs ~30 fps.
      if (now - started > INTRO_MS && now - lastIdle < 1000 / IDLE_FPS) return
      lastIdle = now
      paint(now)
    }

    const start = () => {
      cancelAnimationFrame(frame)
      paint(performance.now())
      if (moving() && !document.hidden) frame = requestAnimationFrame(loop)
    }

    readTheme()
    resize()
    // Opened in a background tab: nobody would see the intro, so show the finished logo and
    // only run the idle once the tab is visible.
    started = document.hidden ? performance.now() - INTRO_MS : performance.now()
    start()

    // Resizing a canvas clears it: repaint right away.
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            resize()
            paint(performance.now())
          })
    resizeObserver?.observe(canvas)

    // Web fonts may arrive after the first paint.
    void document.fonts?.ready.then(() => paint(performance.now()))

    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : start())
    if (animated) document.addEventListener('visibilitychange', onVisibility)
    reducedMotion?.addEventListener('change', start)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      reducedMotion?.removeEventListener('change', start)
    }
  }, [animated, tone, variant, view])

  return (
    <canvas
      ref={canvasRef}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn('block w-auto shrink-0', className)}
      style={{ aspectRatio: `${view.w} / ${view.h}` }}
    />
  )
}
