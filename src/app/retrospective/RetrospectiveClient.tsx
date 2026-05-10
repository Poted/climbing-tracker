'use client'

import { format, parseISO } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Minus, Mountain, Dumbbell, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────

type SetLog = { setNumber: number; reps: number }
type ClimbLog = { grade: string; gymGradeOrder: number | null; style: string | null; attempts: number | null }
type Gym = { id: string; name: string; grades: { localGrade: string; order: number }[] }

type UnitLog = {
  completed: boolean
  repsActual: number | null
  setsActual: number | null
  trainingUnit: { id: string; name: string; type: string }
  setLogs: SetLog[]
  climbLogs: ClimbLog[]
  gym: Gym | null
  gymId: string | null
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
  planDay: { dayNumber: number; name: string | null } | null
  unitLogs: UnitLog[]
}

type Suggestion = { icon: string; title: string; text: string; type: 'good' | 'warn' | 'info' }

type PlanUnit = {
  order: number
  targetSets: number | null
  targetReps: number | null
  timesPerDay: number | null
  trainingUnit: { name: string; type: string }
}

type PlanDay = {
  dayNumber: number
  name: string | null
  units: PlanUnit[]
}

type Props = { sessions: Session[]; cycleNumber: number; plan: PlanDay[] }

// ── Helpers ───────────────────────────────────────────────────────────

function avg(nums: number[]) {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function pct(a: number, b: number) {
  if (b === 0) return 0
  return ((a - b) / b) * 100
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
  if (rpe <= 4) return 'Light effort'
  if (rpe <= 6) return 'Moderate'
  if (rpe <= 7) return 'Hard'
  if (rpe <= 8) return 'Very hard'
  if (rpe === 9) return 'Near maximum'
  return 'Maximum effort'
}

function stateColor(v: number) {
  if (v <= 2) return '#ef4444'
  if (v === 3) return '#eab308'
  return '#10b981'
}

function TrendIcon({ pctChange }: { pctChange: number }) {
  if (pctChange > 5) return <TrendingUp size={14} className="text-emerald-400" />
  if (pctChange < -5) return <TrendingDown size={14} className="text-red-400" />
  return <Minus size={14} className="text-slate-500" />
}

// ── Summary builder (data sent to the AI endpoint) ────────────────────

function buildSummary(sessions: Session[], cycleNumber: number, plan: PlanDay[]) {
  const done = sessions.filter((s) => s.completedAt)

  const rpes = done.filter((s) => s.rpe != null).map((s) => s.rpe!)
  const avgRpe = avg(rpes)
  const mid = Math.floor(rpes.length / 2)
  const rpeVariance = rpes.length >= 2
    ? avg(rpes.map((r) => Math.pow(r - avgRpe!, 2)))
    : null

  const withState = done.filter((s) => s.fingersBefore != null)

  const dates = done.map((s) => new Date(s.date).getTime()).sort((a, b) => a - b)
  const gaps = dates.slice(1).map((d, i) => (d - dates[i]) / 86_400_000)
  const shortGaps = gaps.filter((g) => g < 2).length

  const allClimbs = done.flatMap((s) => s.unitLogs.flatMap((l) => l.climbLogs))
  const stylesLogged = allClimbs.filter((c) => c.style)

  const totalReps = (l: UnitLog) =>
    l.setLogs.length > 0 ? l.setLogs.reduce((a, b) => a + b.reps, 0) : (l.repsActual ?? 0)

  const exerciseUnitIds = Array.from(new Set(
    done.flatMap((s) => s.unitLogs
      .filter((l) => l.completed && (l.trainingUnit.type === 'exercise' || l.trainingUnit.type === 'hangboard'))
      .map((l) => l.trainingUnit.id))
  ))
  const exercises = exerciseUnitIds.flatMap((unitId) => {
    const logs = done
      .map((s) => s.unitLogs.find((l) => l.trainingUnit.id === unitId && l.completed))
      .filter(Boolean) as UnitLog[]
    if (logs.length < 2) return []
    const first = totalReps(logs[0])
    const last = totalReps(logs[logs.length - 1])
    return [{ name: logs[0].trainingUnit.name, firstReps: first, lastReps: last, changePercent: pct(last, first), sessionCount: logs.length }]
  })

  return {
    cycleNumber,
    sessionCount: done.length,
    dateRange: sessions.length > 0
      ? { from: sessions[0].date, to: sessions[sessions.length - 1].date }
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
      shortGaps,
      avgGapDays: gaps.length > 0 ? avg(gaps) : null,
    },
    climbing: {
      totalClimbs: allClimbs.length,
      stylesLogged: stylesLogged.length,
      hangdog: stylesLogged.filter((c) => c.style === 'hangdog').length,
      redpoint: stylesLogged.filter((c) => c.style === 'redpoint').length,
      flash: stylesLogged.filter((c) => c.style === 'flash').length,
      onsight: stylesLogged.filter((c) => c.style === 'onsight').length,
    },
    exercises,
    plan: plan.map((day) => ({
      dayNumber: day.dayNumber,
      name: day.name,
      units: day.units.map((u) => ({
        name: u.trainingUnit.name,
        type: u.trainingUnit.type,
        targetSets: u.targetSets,
        targetReps: u.targetReps,
        timesPerDay: u.timesPerDay,
      })),
    })),
  }
}

// ── Main ──────────────────────────────────────────────────────────────

export default function RetrospectiveClient({ sessions, cycleNumber, plan }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)

  useEffect(() => {
    if (sessions.filter((s) => s.completedAt).length < 2) return
    const cacheKey = `cycle-suggestions-v1-${cycleNumber}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) { setSuggestions(JSON.parse(cached)); return }
    } catch { /* ignore */ }

    const summary = buildSummary(sessions, cycleNumber, plan)
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
  }, [sessions, cycleNumber, plan])

  if (sessions.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-12">No sessions recorded for cycle {cycleNumber}.</p>
  }

  const done = sessions.filter((s) => s.completedAt)
  const firstDate = sessions[0].date
  const lastDate = sessions[sessions.length - 1].date

  const rpes = done.filter((s) => s.rpe != null).map((s) => s.rpe!)
  const avgRpe = avg(rpes)

  const withState = done.filter((s) => s.fingersBefore != null)
  const avgFingers   = withState.length ? avg(withState.map((s) => s.fingersBefore!))! : null
  const avgBiceps    = withState.length ? avg(withState.map((s) => s.bicepsBefore ?? 5))! : null
  const avgShoulders = withState.length ? avg(withState.map((s) => s.shouldersBefore ?? 5))! : null
  const avgFatigue   = withState.length ? avg(withState.map((s) => s.fatigueBefore ?? 5))! : null

  const exerciseUnits = Array.from(new Set(
    done.flatMap((s) => s.unitLogs
      .filter((l) => l.completed && (l.trainingUnit.type === 'exercise' || l.trainingUnit.type === 'hangboard'))
      .map((l) => l.trainingUnit.id))
  ))

  const totalReps = (l: UnitLog) =>
    l.setLogs.length > 0 ? l.setLogs.reduce((a, b) => a + b.reps, 0) : (l.repsActual ?? 0)

  const totalClimbs = done.flatMap((s) => s.unitLogs.flatMap((l) => l.climbLogs)).length

  return (
    <div className="space-y-5">
      {/* Date range & overview */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{format(parseISO(firstDate), 'MMM d', { locale: enUS })} — {format(parseISO(lastDate), 'MMM d, yyyy', { locale: enUS })}</span>
          <span>{done.length}/{sessions.length} sessions completed</span>
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
            <p className="text-xl font-bold">{totalClimbs}</p>
            <p className="text-xs text-slate-400">Climbs</p>
          </div>
        </div>
      </div>

      {/* RPE per session */}
      {rpes.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-sm font-medium text-slate-300">RPE per session</p>
            <span className="text-xs text-slate-500">1–10</span>
          </div>
          <p className="text-xs text-slate-600 mb-3">RPE (Rate of Perceived Exertion) — how hard did the session feel overall.</p>
          <div className="flex items-end gap-1" style={{ height: '60px' }}>
            {done.filter((s) => s.rpe != null).map((s) => {
              const hPx = Math.round((s.rpe! / 10) * 40)
              const col = s.rpe! >= 8 ? '#ef4444' : s.rpe! >= 5 ? '#eab308' : '#10b981'
              const dateLabel = format(parseISO(s.date), 'MMM d', { locale: enUS })
              return (
                <div
                  key={s.id}
                  className="group relative flex-1"
                  style={{ height: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}
                >
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div className="bg-slate-700 border border-slate-600 text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                      <p className="font-medium text-slate-200">{dateLabel}</p>
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

      {/* Exercise progression */}
      {exerciseUnits.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-300 mb-3">Exercise progression</p>
          <div className="space-y-3">
            {exerciseUnits.map((unitId) => {
              const logs = done
                .map((s) => s.unitLogs.find((l) => l.trainingUnit.id === unitId && l.completed))
                .filter(Boolean) as UnitLog[]
              if (logs.length < 2) return null
              const name = logs[0].trainingUnit.name
              const first = totalReps(logs[0])
              const last = totalReps(logs[logs.length - 1])
              const change = pct(last, first)
              return (
                <div key={unitId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300">{name}</span>
                    <div className="flex items-center gap-1.5">
                      <TrendIcon pctChange={change} />
                      <span className={`text-xs ${change > 5 ? 'text-emerald-400' : change < -5 ? 'text-red-400' : 'text-slate-500'}`}>
                        {first} → {last} reps
                        {change !== 0 && ` (${change > 0 ? '+' : ''}${change.toFixed(0)}%)`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end gap-0.5 h-8">
                    {logs.map((l, i) => {
                      const r = totalReps(l)
                      const max = Math.max(...logs.map(totalReps))
                      const h = max > 0 ? Math.round((r / max) * 100) : 0
                      return <div key={i} className="flex-1 bg-emerald-700 rounded-sm" style={{ height: `${h}%` }} />
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-300">Suggestions for next cycle</p>

        {suggestions === null && suggestionsError === null && (
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

      {/* Session log */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-300">Sessions</p>
        {sessions.map((s) => {
          const climbs = s.unitLogs.flatMap((l) => l.climbLogs).length
          const repsTotal = s.unitLogs
            .filter((l) => l.completed && (l.trainingUnit.type === 'exercise' || l.trainingUnit.type === 'hangboard'))
            .map((l) => totalReps(l))
            .reduce((a, b) => a + b, 0)
          return (
            <div key={s.id} className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{format(parseISO(s.date), 'EEE, MMM d', { locale: enUS })}</p>
                <p className="text-xs text-slate-500">
                  {s.planDay ? `Day ${s.planDay.dayNumber}${s.planDay.name ? ` · ${s.planDay.name}` : ''}` : 'Free session'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                {climbs > 0 && <span className="flex items-center gap-1"><Mountain size={11} className="text-emerald-400" />{climbs}</span>}
                {repsTotal > 0 && <span className="flex items-center gap-1"><Dumbbell size={11} className="text-emerald-400" />{repsTotal}</span>}
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
