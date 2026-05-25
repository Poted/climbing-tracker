'use client'

import { format, parseISO } from 'date-fns'
import { enUS } from 'date-fns/locale'
import {
  TrendingUp, TrendingDown, Minus, Mountain, Ruler,
  AlertCircle, CheckCircle2, Loader2, Dumbbell,
} from 'lucide-react'
import { useState, useEffect, useTransition } from 'react'
import { updateCycleStatus } from '@/lib/actions'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────

type GradeMapping = { localGrade: string; order: number }
type Gym = { id: string; name: string; grades: GradeMapping[] }

type Activity = {
  id: string
  type: string
  climbingType: string | null
  grade: string | null
  gymGradeOrder: number | null
  attempts: number | null
  success: boolean | null
  style: string | null
  distanceKm: number | null
  pace: number | null
  durationMin: number | null
  name: string | null
  data: string | null
  notes: string | null
  gym: Gym | null
}

type Session = {
  id: string
  date: string
  completedAt: Date | null
  rpe: number | null
  fingersBefore: number | null
  bicepsBefore: number | null
  shouldersBefore: number | null
  fatigueBefore: number | null
  activities: Activity[]
}

type Cycle = {
  id: string
  name: string | null
  startDate: string
  endDate: string | null
  status: string
  sessions: Session[]
}

type Suggestion = { icon: string; title: string; text: string; type: 'good' | 'warn' | 'info' }

type Props = { cycle: Cycle }

// ── Helpers ───────────────────────────────────────────────────────────

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function fmtDuration(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60); const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function Bar({ value, max = 5, color }: { value: number; max?: number; color: string }) {
  const w = Math.round((value / max) * 100)
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-slate-400 w-6 text-right">{value.toFixed(1)}</span>
    </div>
  )
}

function rpeLabel(rpe: number) {
  if (rpe <= 2) return 'Very easy'
  if (rpe <= 4) return 'Light'
  if (rpe <= 6) return 'Moderate'
  if (rpe <= 7) return 'Hard'
  if (rpe <= 8) return 'Very hard'
  if (rpe === 9) return 'Near max'
  return 'Maximum'
}

function stateColor(v: number) {
  if (v <= 2) return '#ef4444'
  if (v === 3) return '#eab308'
  return '#10b981'
}

// ── Summary builder ───────────────────────────────────────────────────

function buildSummary(cycle: Cycle) {
  const done = cycle.sessions.filter((s) => s.completedAt)
  const allActivities = done.flatMap((s) => s.activities)
  const climbing = allActivities.filter((a) => a.type === 'climbing')
  const running = allActivities.filter((a) => a.type === 'running')
  const other = allActivities.filter((a) => a.type === 'other')

  const rpes = done.filter((s) => s.rpe != null).map((s) => s.rpe!)
  const avgRpe = avg(rpes)
  const mid = Math.floor(rpes.length / 2)
  const rpeVariance = rpes.length >= 2
    ? avg(rpes.map((r) => Math.pow(r - avgRpe!, 2)))
    : null

  const withState = done.filter((s) => s.fingersBefore != null)

  const dates = done.map((s) => new Date(s.date).getTime()).sort((a, b) => a - b)
  const gaps = dates.slice(1).map((d, i) => (d - dates[i]) / 86_400_000)

  const stylesLogged = climbing.filter((c) => c.style)
  const withOrder = climbing.filter((c) => c.gymGradeOrder != null && c.grade)
  const sorted = [...withOrder].sort((a, b) => a.gymGradeOrder! - b.gymGradeOrder!)

  const totalKm = running.reduce((a, r) => a + (r.distanceKm ?? 0), 0) || null
  const runPaces = running.filter((r) => r.pace != null).map((r) => r.pace!)
  const avgPace = avg(runPaces)

  const otherByName = new Map<string, { count: number; totalMin: number }>()
  for (const a of other) {
    const n = a.name ?? 'Other'
    const ex = otherByName.get(n) ?? { count: 0, totalMin: 0 }
    otherByName.set(n, { count: ex.count + 1, totalMin: ex.totalMin + (a.durationMin ?? 0) })
  }

  return {
    cycleName: cycle.name ?? `Cycle started ${cycle.startDate}`,
    sessionCount: done.length,
    dateRange: cycle.sessions.length > 0
      ? { from: cycle.sessions[0].date, to: cycle.sessions[cycle.sessions.length - 1].date }
      : null,
    avgRpe,
    rpeFirstHalf: rpes.length >= 4 ? avg(rpes.slice(0, mid)) : null,
    rpeSecondHalf: rpes.length >= 4 ? avg(rpes.slice(mid)) : null,
    rpeVariance,
    bodyState: withState.length > 0 ? {
      fingers: avg(withState.map((s) => s.fingersBefore!)),
      biceps: avg(withState.map((s) => s.bicepsBefore ?? 5)),
      shoulders: avg(withState.map((s) => s.shouldersBefore ?? 5)),
      fatigue: avg(withState.map((s) => s.fatigueBefore ?? 5)),
    } : null,
    sessionDensity: {
      totalSessions: done.length,
      shortGaps: gaps.filter((g) => g < 2).length,
      avgGapDays: gaps.length > 0 ? avg(gaps) : null,
    },
    climbing: {
      totalClimbs: climbing.length,
      gradeRange: sorted.length > 0
        ? { lowest: sorted[0].grade!, highest: sorted[sorted.length - 1].grade! }
        : null,
      styles: {
        redpoint: stylesLogged.filter((c) => c.style === 'redpoint').length,
        flash: stylesLogged.filter((c) => c.style === 'flash').length,
        onsight: stylesLogged.filter((c) => c.style === 'onsight').length,
        attempt: stylesLogged.filter((c) => c.style === 'attempt').length,
        topRope: stylesLogged.filter((c) => c.style === 'topRope').length,
      },
      successRate: climbing.filter((c) => c.success != null).length > 0
        ? climbing.filter((c) => c.success === true).length /
          climbing.filter((c) => c.success != null).length
        : null,
    },
    running: running.length > 0 ? {
      sessionCount: done.filter((s) => s.activities.some((a) => a.type === 'running')).length,
      totalKm,
      avgPaceMinPerKm: avgPace,
    } : null,
    otherActivities: Array.from(otherByName.entries()).map(([name, { count, totalMin }]) => ({
      name,
      sessionCount: count,
      totalMinutes: totalMin > 0 ? totalMin : null,
    })),
  }
}

// ── Grade distribution ────────────────────────────────────────────────

function GradeChart({ climbing }: { climbing: Activity[] }) {
  type GradeEntry = { grade: string; order: number | null; count: number }

  const byGrade = new Map<string, GradeEntry>()
  for (const c of climbing) {
    const key = c.grade ?? '?'
    const ex = byGrade.get(key) ?? { grade: key, order: c.gymGradeOrder, count: 0 }
    byGrade.set(key, { ...ex, count: ex.count + 1 })
  }

  const entries = Array.from(byGrade.values()).sort((a, b) => {
    if (a.order != null && b.order != null) return a.order - b.order
    return a.grade.localeCompare(b.grade)
  })

  if (entries.length === 0) return null
  const max = Math.max(...entries.map((e) => e.count))

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <p className="text-sm font-medium text-slate-300 mb-3">Grade distribution</p>
      <div className="space-y-1.5">
        {entries.map((e) => (
          <div key={e.grade} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-12 text-right shrink-0">{e.grade}</span>
            <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${Math.round((e.count / max) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 w-5 text-right shrink-0">{e.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────

export default function RetrospectiveClient({ cycle }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const done = cycle.sessions.filter((s) => s.completedAt)
  const allActivities = done.flatMap((s) => s.activities)
  const climbing = allActivities.filter((a) => a.type === 'climbing')
  const running = allActivities.filter((a) => a.type === 'running')

  const rpes = done.filter((s) => s.rpe != null).map((s) => s.rpe!)
  const avgRpe = avg(rpes)

  const withState = done.filter((s) => s.fingersBefore != null)
  const avgFingers   = withState.length ? avg(withState.map((s) => s.fingersBefore!))! : null
  const avgBiceps    = withState.length ? avg(withState.map((s) => s.bicepsBefore ?? 5))! : null
  const avgShoulders = withState.length ? avg(withState.map((s) => s.shouldersBefore ?? 5))! : null
  const avgFatigue   = withState.length ? avg(withState.map((s) => s.fatigueBefore ?? 5))! : null

  const totalKm = running.reduce((a, r) => a + (r.distanceKm ?? 0), 0) || null
  const runPaces = running.filter((r) => r.pace != null).map((r) => r.pace!)
  const avgPace = avg(runPaces)

  useEffect(() => {
    if (done.length < 2) return
    const cacheKey = `retro-suggestions-v2-${cycle.id}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) { setSuggestions(JSON.parse(cached)); return }
    } catch { /* ignore */ }

    const summary = buildSummary(cycle)
    fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setSuggestionsError(data.error); return }
        setSuggestions(data.suggestions)
        try { localStorage.setItem(cacheKey, JSON.stringify(data.suggestions)) } catch { /* ignore */ }
      })
      .catch(() => setSuggestionsError('Failed to load suggestions.'))
  }, [cycle, done.length])

  function handleCloseCycle() {
    if (!confirm('Close this cycle? You can still view it afterwards.')) return
    const today = new Date().toISOString().slice(0, 10)
    startTransition(async () => {
      await updateCycleStatus(cycle.id, 'finalized', today)
      router.refresh()
    })
  }

  if (cycle.sessions.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-12">No sessions recorded in this cycle.</p>
  }

  const firstDate = cycle.sessions[0].date
  const lastDate = cycle.sessions[cycle.sessions.length - 1].date

  return (
    <div className="space-y-5">
      {/* Overview */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {format(parseISO(firstDate), 'MMM d', { locale: enUS })}
            {' — '}
            {format(parseISO(lastDate), 'MMM d, yyyy', { locale: enUS })}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            cycle.status === 'open'
              ? 'text-emerald-400 bg-emerald-900/30'
              : 'text-slate-400 bg-slate-700'
          }`}>
            {cycle.status === 'open' ? 'Active' : 'Closed'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold">{done.length}</p>
            <p className="text-xs text-slate-400">Sessions</p>
          </div>
          <div>
            <p className="text-xl font-bold">{avgRpe != null ? avgRpe.toFixed(1) : '—'}</p>
            <p className="text-xs text-slate-400">Avg RPE</p>
          </div>
          <div>
            <p className="text-xl font-bold">{climbing.length}</p>
            <p className="text-xs text-slate-400">Climbs</p>
          </div>
        </div>
      </div>

      {/* RPE chart */}
      {rpes.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm font-medium text-slate-300">RPE per session</p>
            <span className="text-xs text-slate-500">1–10</span>
          </div>
          <div className="flex items-end gap-1" style={{ height: '60px' }}>
            {done.filter((s) => s.rpe != null).map((s) => {
              const hPx = Math.round((s.rpe! / 10) * 40)
              const col = s.rpe! >= 8 ? '#ef4444' : s.rpe! >= 5 ? '#eab308' : '#10b981'
              return (
                <div
                  key={s.id}
                  className="group relative flex-1"
                  style={{ height: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}
                >
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div className="bg-slate-700 border border-slate-600 text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                      <p className="font-medium text-slate-200">{format(parseISO(s.date), 'MMM d', { locale: enUS })}</p>
                      <p className="text-slate-400">RPE {s.rpe} — {rpeLabel(s.rpe!)}</p>
                    </div>
                    <div className="w-2 h-2 bg-slate-700 border-r border-b border-slate-600 rotate-45 -mt-1" />
                  </div>
                  <div style={{ height: `${hPx}px`, width: '100%', backgroundColor: col, borderRadius: '2px' }} />
                  <span style={{ fontSize: '9px', color: '#475569', lineHeight: '1.6' }}>{s.rpe}</span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 mt-3 text-xs text-slate-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />1–4 easy</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500 inline-block" />5–7 moderate</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />8–10 hard</span>
          </div>
        </div>
      )}

      {/* Body readiness */}
      {withState.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-300 mb-3">Body readiness (avg)</p>
          <div className="space-y-2.5">
            {([
              ['Fingers', avgFingers],
              ['Biceps / tendons', avgBiceps],
              ['Shoulders', avgShoulders],
              ['General fatigue', avgFatigue],
            ] as [string, number | null][]).map(([label, val]) => val != null && (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-32 shrink-0">{label}</span>
                <Bar value={val} color={stateColor(val)} />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-2">1 = sore / exhausted · 5 = fresh</p>
        </div>
      )}

      {/* Climbing */}
      {climbing.length > 0 && (
        <>
          <GradeChart climbing={climbing} />

          {climbing.some((c) => c.style) && (
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-300 mb-3">Style breakdown</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Redpoint', climbing.filter((c) => c.style === 'redpoint').length],
                  ['Flash', climbing.filter((c) => c.style === 'flash').length],
                  ['Onsight', climbing.filter((c) => c.style === 'onsight').length],
                  ['Top Rope', climbing.filter((c) => c.style === 'topRope').length],
                  ['Attempt', climbing.filter((c) => c.style === 'attempt').length],
                ].filter(([, n]) => (n as number) > 0).map(([label, count]) => (
                  <div key={label as string} className="flex items-center justify-between text-sm px-3 py-2 bg-slate-700/50 rounded-lg">
                    <span className="text-slate-300">{label}</span>
                    <span className="text-slate-400 text-xs">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Running */}
      {running.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Ruler size={14} className="text-blue-400" />
            <p className="text-sm font-medium text-slate-300">Running</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold">{running.length}</p>
              <p className="text-xs text-slate-400">Sessions</p>
            </div>
            <div>
              <p className="text-lg font-bold">{totalKm != null ? totalKm.toFixed(1) : '—'}</p>
              <p className="text-xs text-slate-400">km total</p>
            </div>
            <div>
              <p className="text-lg font-bold">{avgPace != null ? avgPace.toFixed(1) : '—'}</p>
              <p className="text-xs text-slate-400">min/km avg</p>
            </div>
          </div>
        </div>
      )}

      {/* Other activities */}
      {(() => {
        const other = allActivities.filter((a) => a.type === 'other')
        if (other.length === 0) return null
        const byName = new Map<string, { count: number; totalMin: number }>()
        for (const a of other) {
          const n = a.name ?? 'Other'
          const ex = byName.get(n) ?? { count: 0, totalMin: 0 }
          byName.set(n, { count: ex.count + 1, totalMin: ex.totalMin + (a.durationMin ?? 0) })
        }
        return (
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Dumbbell size={14} className="text-slate-400" />
              <p className="text-sm font-medium text-slate-300">Other activities</p>
            </div>
            <div className="space-y-2">
              {Array.from(byName.entries()).map(([name, { count, totalMin }]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{name}</span>
                  <span className="text-xs text-slate-500">
                    {count}×{totalMin > 0 ? ` · ${fmtDuration(totalMin)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* AI Suggestions */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-300">Suggestions for next cycle</p>

        {done.length < 2 && (
          <p className="text-xs text-slate-500 py-2">Complete at least 2 sessions to get AI suggestions.</p>
        )}

        {done.length >= 2 && suggestions === null && suggestionsError === null && (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-3">
            <Loader2 size={15} className="animate-spin" />
            Analyzing your training data…
          </div>
        )}

        {suggestionsError && (
          <p className="text-xs text-slate-500 py-2">{suggestionsError}</p>
        )}

        {suggestions?.map((s, i) => (
          <div key={i} className={`rounded-xl p-3.5 border ${
            s.type === 'good'  ? 'bg-emerald-900/20 border-emerald-800'
            : s.type === 'warn' ? 'bg-amber-900/20 border-amber-800'
            : 'bg-slate-800 border-slate-700'
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0 mt-0.5">{s.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-200 mb-0.5">{s.title}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{s.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Close cycle */}
      {cycle.status === 'open' && (
        <button
          onClick={handleCloseCycle}
          disabled={isPending}
          className="w-full py-3 rounded-xl border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 text-sm transition-colors disabled:opacity-50"
        >
          {isPending ? 'Closing…' : 'Close this cycle'}
        </button>
      )}

      {/* Session log */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-300">Sessions</p>
        {cycle.sessions.map((s) => {
          const climbCount = s.activities.filter((a) => a.type === 'climbing').length
          const runCount = s.activities.filter((a) => a.type === 'running').length
          const otherCount = s.activities.filter((a) => a.type === 'other').length
          return (
            <div key={s.id} className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{format(parseISO(s.date), 'EEE, MMM d', { locale: enUS })}</p>
                <p className="text-xs text-slate-500">
                  {s.activities.length === 0
                    ? 'No activities logged'
                    : [
                      climbCount > 0 && `${climbCount} climb${climbCount > 1 ? 's' : ''}`,
                      runCount > 0 && `${runCount} run${runCount > 1 ? 's' : ''}`,
                      otherCount > 0 && `${otherCount} other`,
                    ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                {climbCount > 0 && <Mountain size={11} className="text-emerald-400" />}
                {runCount > 0 && <Ruler size={11} className="text-blue-400" />}
                {s.rpe != null && <span className="text-slate-600">RPE {s.rpe}</span>}
                {s.completedAt
                  ? <CheckCircle2 size={14} className="text-emerald-400" />
                  : <AlertCircle size={14} className="text-slate-600" />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
