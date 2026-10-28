// اجزای نموداری داشبورد — بدون وابستگی کلاینت، سازگار با Server Component
import type { ReactNode } from 'react'
import { faNum } from '@/lib/fa-utils'

/* ---------------- کارت آماری (KPI) ---------------- */

export function StatCard({
  icon,
  label,
  value,
  sub,
  tone = 'navy',
}: {
  icon: ReactNode
  label: string
  value: number | string
  sub?: string
  tone?: 'navy' | 'gold' | 'green' | 'red' | 'slate'
}) {
  const tones: Record<string, { ring: string; bg: string; fg: string }> = {
    navy: { ring: 'ring-[#1e2f4d]/15', bg: 'bg-[#1e2f4d]/8', fg: 'text-[#1e2f4d]' },
    gold: { ring: 'ring-amber-600/25', bg: 'bg-amber-500/10', fg: 'text-amber-700' },
    green: { ring: 'ring-emerald-600/25', bg: 'bg-emerald-500/10', fg: 'text-emerald-700' },
    red: { ring: 'ring-rose-600/25', bg: 'bg-rose-500/10', fg: 'text-rose-700' },
    slate: { ring: 'ring-slate-500/25', bg: 'bg-slate-500/10', fg: 'text-slate-600' },
  }
  const t = tones[tone] ?? tones.navy
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg ring-1 ${t.ring} ${t.bg} ${t.fg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xl font-extrabold leading-7 text-[#1e2f4d]">
          {typeof value === 'number' ? faNum(value) : value}
        </div>
        <div className="truncate text-xs font-medium text-slate-600">{label}</div>
        {sub ? <div className="truncate text-[11px] text-slate-400">{sub}</div> : null}
      </div>
    </div>
  )
}

/* ---------------- کارت بخش ---------------- */

export function SectionCard({
  title,
  desc,
  children,
  className = '',
}: {
  title: string
  desc?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#1e2f4d]">
          <span className="inline-block h-4 w-1 rounded-full bg-amber-500" aria-hidden="true" />
          {title}
        </h2>
        {desc ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{desc}</p> : null}
      </div>
      {children}
    </section>
  )
}

/* ---------------- نمودار دونات (SVG) ---------------- */

export interface DonutSegment {
  label: string
  value: number
  color: string
}

export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 150,
  stroke = 24,
}: {
  segments: DonutSegment[]
  centerValue: string
  centerLabel: string
  size?: number
  stroke?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  const hasData = total > 0

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={centerLabel}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f5" strokeWidth={stroke} />
          {hasData &&
            segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const frac = s.value / total
                const dash = frac * c
                const el = (
                  <circle
                    key={s.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={stroke}
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={-offset}
                  />
                )
                offset += dash
                return el
              })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-[#1e2f4d]">{centerValue}</span>
          <span className="text-[10px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="min-w-32 space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </span>
            <span className="font-bold text-[#1e2f4d]">
              {faNum(s.value)}
              {hasData ? <span className="mr-1 text-[10px] font-normal text-slate-400">({faNum(Math.round((s.value / total) * 100))}٪)</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- نوار افقی ---------------- */

export function HBar({
  label,
  value,
  total,
  color = '#1e2f4d',
  valueText,
  height = 10,
}: {
  label: string
  value: number
  total: number
  color?: string
  valueText?: string
  height?: number
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-slate-700">{label}</span>
        <span className="shrink-0 font-bold text-[#1e2f4d]">{valueText ?? faNum(value)}</span>
      </div>
      <div className="w-full overflow-hidden rounded-full bg-slate-100" style={{ height }} role="img" aria-label={`${label}: ${pct}٪`}>
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: color, minWidth: value > 0 ? 6 : 0 }}
        />
      </div>
    </div>
  )
}

/* ---------------- برچسب وضعیت رنگی ---------------- */

const CHIP_TONES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  blue: 'bg-[#1e2f4d]/6 text-[#2c4568] ring-[#1e2f4d]/20',
  gold: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  gray: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

export function Chip({ label, tone = 'gray' }: { label: string; tone?: keyof typeof CHIP_TONES }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${CHIP_TONES[tone] ?? CHIP_TONES.gray}`}>
      {label}
    </span>
  )
}
