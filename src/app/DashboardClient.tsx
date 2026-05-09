'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  format, parseISO, eachWeekOfInterval, min, max,
  subWeeks, subMonths, subYears, startOfWeek,
} from 'date-fns'
import { enUS } from 'date-fns/locale'
import { Mountain, Dumbbell, Calendar, Trash2, TrendingUp, TrendingDown, Minus, Flame } from 'lucide-react'
import { useState, useTransition } from 'react'
import { seedDemoData, clearDemoData } from '@/lib/seed'

// ── Time range ────────────────────────────────────────────────────────

type Range = '1w' | '1m' | '3m' | '6m' | '1y' | 'all'

const RANGES: { key: Range; label: string }[] = [
  { key: '1w',  label: '1W' },
  { key: '1m',  label: '1M' },
  { key: '3m',  label: '3M' },
  { key: '6m',  label: '6M' },
  { key: '1y',  label: '1Y' },
  { key: 'all', label: 'All' },
]

function cutoffDate(range: Range): Date {
  const now = new Date()
  if (range === '1w')  return subWeeks(now, 1)
  if (range === '1m')  return subMonths(now, 1)
  if (range === '3m')  return subMonths(now, 3)
  if (range === '6m')  return subMonths(now, 6)
  if (range === '1y')  return subYears(now, 1)
  return new Date(0)
}

// ── Types ─────────────────────────────────────────────────────────────

type SetLog      = { setNumber: number; reps: number }
type ClimbLog    = { grade: string; gymGradeOrder: number | null; style?: string | null }
type GradeMapping = { localGrade: string; order: number }
type Gym         = { id: string; name: string; grades: GradeMapping[] }

type UnitLog = {
  completed: boolean
  repsActual: number | null
  durationSec: number | null
  distanceM: number | null
  trainingUnit: { name: string; type: string }
  climbLogs: ClimbLog[]
  setLogs: SetLog[]
  gym: Gym | null
  gymId: string | null
}

type Session = {
  date: string
  completedAt: Date | null
  unitLogs: UnitLog[]
}

type Props = { stats: { sessions: Session[]; gyms: Gym[] } }

// ── Helpers ───────────────────────────────────────────────────────────

type ChartRow = Record<string, number | string>

function weekKey(dateStr: string) {
  return format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}
function weekLabel(dateStr: string) {
  return format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'MMM d', { locale: enUS })
}

// ── Palette helpers ───────────────────────────────────────────────────

function climbColor(idx: number, total: number): string {
  const ratio = total <= 1 ? 0 : idx / (total - 1)
  const stops: [number, [number, number, number]][] = [
    [0,    [16, 185, 129]],
    [0.25, [132, 204, 22]],
    [0.5,  [234, 179, 8]],
    [0.75, [249, 115, 22]],
    [1,    [239, 68, 68]],
  ]
  let lo = stops[0], hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio >= stops[i][0] && ratio <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break }
  }
  const t = lo[0] === hi[0] ? 0 : (ratio - lo[0]) / (hi[0] - lo[0])
  const lerp = (a: number, b: number) => Math.round(a + t * (b - a))
  return `rgb(${lerp(lo[1][0], hi[1][0])},${lerp(lo[1][1], hi[1][1])},${lerp(lo[1][2], hi[1][2])})`
}

const SET_COLORS = ['#047857', '#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0']
function setColor(idx: number) { return SET_COLORS[Math.min(idx, SET_COLORS.length - 1)] }

// ── Climb style config ────────────────────────────────────────────────

const STYLE_PRIORITY = ['onsight', 'flash', 'redpoint', 'hangdog']
const STYLE_LABEL: Record<string, string> = {
  onsight: 'OS', flash: 'FL', redpoint: 'RP', hangdog: 'HD',
}
const STYLE_CLS: Record<string, string> = {
  onsight:  'bg-emerald-900/70 text-emerald-300',
  flash:    'bg-blue-900/70 text-blue-300',
  redpoint: 'bg-amber-900/70 text-amber-300',
  hangdog:  'bg-slate-700 text-slate-400',
}

// ── Stat card ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, sub }: {
  label: string; value: string | number; icon: React.ElementType; sub?: string
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-3">
      <div className="bg-slate-700 p-2.5 rounded-lg"><Icon size={20} className="text-emerald-400" /></div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  )
}

// ── Climbing chart (per training unit) ────────────────────────────────

function PerUnitClimbingChart({ sessions, unitName }: { sessions: Session[]; unitName: string }) {
  const sessionData = sessions
    .map((s) => {
      const ul = s.unitLogs.find(
        (l) => l.trainingUnit.name === unitName && l.trainingUnit.type === 'climbing' && l.completed
      )
      return ul ? { date: s.date, climbs: ul.climbLogs } : null
    })
    .filter((s): s is { date: string; climbs: ClimbLog[] } => s !== null)

  if (sessionData.length < 2) return null

  const allClimbs = sessionData.flatMap((s) => s.climbs)
  const hasGrades = allClimbs.length > 0
  const useWeekly = sessionData.length > 20

  // Grade order from current gym grade mappings (authoritative, matches gym settings)
  const gradeOrderMap = new Map<string, number>()
  for (const s of sessions) {
    for (const ul of s.unitLogs) {
      if (ul.trainingUnit.name === unitName && ul.gym?.grades) {
        for (const g of ul.gym.grades) {
          if (!gradeOrderMap.has(g.localGrade)) gradeOrderMap.set(g.localGrade, g.order)
        }
      }
    }
  }

  if (hasGrades) {
    const uniqueGrades = Array.from(new Set(allClimbs.map((c) => c.grade)))
    const sortedGrades = uniqueGrades.sort((a, b) => {
      const oa = gradeOrderMap.get(a) ?? Infinity
      const ob = gradeOrderMap.get(b) ?? Infinity
      if (oa !== ob) return oa - ob
      return a.localeCompare(b)
    })

    function buildGradeRow(label: string, climbs: ClimbLog[]): ChartRow {
      const row: ChartRow = { date: label }
      sortedGrades.forEach((g) => (row[g] = 0))
      climbs.forEach((c) => { if (c.grade in row) (row[c.grade] as number)++ })
      return row
    }

    let chartData: ChartRow[]
    if (useWeekly) {
      const map = new Map<string, ClimbLog[]>()
      for (const s of sessionData) {
        const k = weekKey(s.date)
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(...s.climbs)
      }
      chartData = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, climbs]) => buildGradeRow(weekLabel(k), climbs))
    } else {
      chartData = sessionData.map((s) =>
        buildGradeRow(format(parseISO(s.date), 'MMM d', { locale: enUS }), s.climbs)
      )
    }

    const grades = sortedGrades.filter((g) => chartData.some((d) => (d[g] as number) > 0))

    return (
      <div className="bg-slate-800 rounded-xl p-4">
        <p className="text-sm font-medium mb-1 text-slate-300">{unitName} — climbs {useWeekly ? 'per week' : 'per session'}</p>
        <p className="text-xs text-slate-500 mb-2">Stacked by difficulty (bottom = easiest)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#94a3b8' }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            {grades.map((grade, i) => {
              const colorIdx = sortedGrades.indexOf(grade)
              return (
                <Bar key={grade} dataKey={grade} stackId="climbs"
                  fill={climbColor(colorIdx, sortedGrades.length)}
                  radius={i === grades.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              )
            })}
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {grades.map((grade) => {
            const colorIdx = sortedGrades.indexOf(grade)
            return (
              <div key={grade} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: climbColor(colorIdx, sortedGrades.length) }} />
                <span className="text-xs text-slate-400">{grade}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // No individual climb logs — show session count per period
  let chartData: ChartRow[]
  if (useWeekly) {
    const map = new Map<string, number>()
    for (const s of sessionData) { const k = weekKey(s.date); map.set(k, (map.get(k) ?? 0) + 1) }
    chartData = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, count]) => ({ date: weekLabel(k), sessions: count }))
  } else {
    chartData = sessionData.map((s) => ({
      date: format(parseISO(s.date), 'MMM d', { locale: enUS }),
      sessions: 1,
    }))
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <p className="text-sm font-medium mb-1 text-slate-300">{unitName} — sessions {useWeekly ? 'per week' : ''}</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="sessions" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Exercise chart ────────────────────────────────────────────────────

function ExerciseChart({ sessions, unitName }: { sessions: Session[]; unitName: string }) {
  const sessionData = sessions
    .map((s) => {
      const ul = s.unitLogs.find((l) => l.trainingUnit.name === unitName && l.completed)
      return ul ? { date: s.date, sets: ul.setLogs, total: ul.repsActual } : null
    })
    .filter((s): s is { date: string; sets: SetLog[]; total: number | null } =>
      s !== null && (s.sets.length > 0 || (s.total ?? 0) > 0)
    )

  if (sessionData.length < 2) return null

  const useWeekly = sessionData.length > 20

  function sessionReps(s: { sets: SetLog[]; total: number | null }) {
    return s.sets.length > 0 ? s.sets.reduce((a, b) => a + b.reps, 0) : (s.total ?? 0)
  }

  if (useWeekly) {
    const map = new Map<string, number>()
    for (const s of sessionData) {
      const k = weekKey(s.date)
      map.set(k, (map.get(k) ?? 0) + sessionReps(s))
    }
    const chartData = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, total]) => ({ date: weekLabel(k), total }))

    return (
      <div className="bg-slate-800 rounded-xl p-4">
        <p className="text-sm font-medium mb-1 text-slate-300">{unitName} — reps per week</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#94a3b8' }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [`${v} reps`, 'Total']}
            />
            <Bar dataKey="total" fill="#059669" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Per-session stacked by set
  const maxSets = Math.max(...sessionData.map((s) => s.sets.length), 1)
  const chartData = sessionData.map((s) => {
    const entry: ChartRow = { date: format(parseISO(s.date), 'MMM d', { locale: enUS }) }
    if (s.sets.length > 0) {
      for (let i = 0; i < maxSets; i++) entry[`set${i + 1}`] = s.sets[i]?.reps ?? 0
    } else {
      entry['set1'] = s.total ?? 0
      for (let i = 1; i < maxSets; i++) entry[`set${i + 1}`] = 0
    }
    return entry
  })

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <p className="text-sm font-medium mb-1 text-slate-300">{unitName} — reps per session</p>
      <p className="text-xs text-slate-500 mb-3">Stacked by set (bottom = set 1)</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#94a3b8' }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, key: any) => [value > 0 ? `${value} reps` : null, String(key).replace('set', 'Set ')]}
          />
          {Array.from({ length: maxSets }, (_, i) => (
            <Bar key={`set${i + 1}`} dataKey={`set${i + 1}`} stackId="sets"
              fill={setColor(i)}
              radius={i === maxSets - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {Array.from({ length: maxSets }, (_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: setColor(i) }} />
            <span className="text-xs text-slate-400">Set {i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Cardio chart ──────────────────────────────────────────────────────

function CardioChart({ sessions, unitName }: { sessions: Session[]; unitName: string }) {
  const sessionData = sessions
    .map((s) => {
      const ul = s.unitLogs.find((l) => l.trainingUnit.name === unitName && l.completed && l.trainingUnit.type === 'cardio')
      return ul ? { date: s.date, durationMin: ul.durationSec ? Math.round(ul.durationSec / 60) : null, distanceKm: ul.distanceM ? ul.distanceM / 1000 : null } : null
    })
    .filter((s): s is { date: string; durationMin: number | null; distanceKm: number | null } => s !== null && (!!s.durationMin || !!s.distanceKm))

  if (sessionData.length < 2) return null

  const useWeekly = sessionData.length > 20
  const hasDistance = sessionData.some((s) => s.distanceKm)
  const dataKey = hasDistance ? 'distanceKm' : 'durationMin'
  const label = hasDistance ? 'km' : 'min'

  let chartData: ChartRow[]

  if (useWeekly) {
    const map = new Map<string, { dur: number; dist: number }>()
    for (const s of sessionData) {
      const k = weekKey(s.date)
      if (!map.has(k)) map.set(k, { dur: 0, dist: 0 })
      const entry = map.get(k)!
      entry.dur += s.durationMin ?? 0
      entry.dist += s.distanceKm ?? 0
    }
    chartData = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, { dur, dist }]) => ({ date: weekLabel(k), durationMin: dur, distanceKm: dist }))
  } else {
    chartData = sessionData.map((s) => ({ date: format(parseISO(s.date), 'MMM d', { locale: enUS }), durationMin: s.durationMin ?? 0, distanceKm: s.distanceKm ?? 0 }))
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <p className="text-sm font-medium mb-1 text-slate-300">{unitName} — {label} {useWeekly ? 'per week' : 'per session'}</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#94a3b8' }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [`${typeof v === 'number' ? v.toFixed(1) : v} ${label}`, unitName]}
          />
          <Bar dataKey={dataKey} fill="#0ea5e9" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Form trend ────────────────────────────────────────────────────────

function computeTrend(sessions: Session[]): { pct: number; sessions: number } | null {
  const done = sessions.filter((s) => s.completedAt)
  if (done.length < 4) return null

  function effort(s: Session) {
    const reps = s.unitLogs
      .filter((l) => l.completed && (l.trainingUnit.type === 'exercise' || l.trainingUnit.type === 'hangboard'))
      .reduce((sum, l) => sum + (l.repsActual ?? 0), 0)
    const climbs = s.unitLogs.filter((l) => l.completed).flatMap((l) => l.climbLogs).length
    return reps + climbs * 2
  }

  const mid = Math.floor(done.length / 2)
  const firstAvg = done.slice(0, mid).reduce((a, s) => a + effort(s), 0) / mid
  const lastAvg  = done.slice(mid).reduce((a, s) => a + effort(s), 0) / (done.length - mid)

  if (firstAvg === 0) return null
  const pct = ((lastAvg - firstAvg) / firstAvg) * 100
  return { pct, sessions: done.length }
}

// ── Main dashboard ────────────────────────────────────────────────────

const TYPE_PRIORITY = ['climbing', 'hangboard', 'exercise', 'cardio', 'stretching']

export default function DashboardClient({ stats }: Props) {
  const { sessions: allSessions } = stats
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('1w')

  const cutoff = cutoffDate(range)
  const sessions = allSessions.filter((s) => parseISO(s.date) >= cutoff)

  function handleSeed() {
    startTransition(async () => {
      await seedDemoData()
      setMsg('Demo data loaded! Refresh the page.')
    })
  }

  function handleClear() {
    if (!confirm('Delete ALL data (sessions, plan, units, gyms)?')) return
    startTransition(async () => {
      await clearDemoData()
      setMsg('All data cleared. Refresh the page.')
    })
  }

  if (allSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-5">
        <p className="text-slate-400 text-sm">No data yet.</p>
        <div className="border-t border-slate-800 pt-5 w-full space-y-2">
          <p className="text-xs text-slate-600">Load demo data to see how charts look:</p>
          {msg && <p className="text-xs text-emerald-400">{msg}</p>}
          <button onClick={handleSeed} disabled={isPending} className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm px-5 py-2.5 rounded-xl transition-colors border border-slate-700">
            {isPending ? 'Loading…' : 'Load demo data'}
          </button>
        </div>
      </div>
    )
  }

  // ── Summary stats ─────────────────────────────────────────────────
  const completedSessions = sessions.filter((s) => s.completedAt).length
  const totalClimbs = sessions.flatMap((s) =>
    s.unitLogs.filter((l) => l.completed).flatMap((l) => l.climbLogs)
  ).length

  const sessionDates = sessions.map((s) => parseISO(s.date))
  const avgPerWeek = sessionDates.length >= 2
    ? (() => {
        const weeks = eachWeekOfInterval({ start: min(sessionDates), end: max(sessionDates) }, { weekStartsOn: 1 })
        const counts = weeks.map((ws) => {
          const we = new Date(ws); we.setDate(we.getDate() + 7)
          return sessions.filter((s) => { const d = parseISO(s.date); return d >= ws && d < we }).length
        })
        return (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)
      })()
    : sessions.length > 0 ? sessions.length.toString() : '—'

  // ── Warmup / stretching stat ──────────────────────────────────────
  const warmupPlanned = sessions.reduce(
    (n, s) => n + s.unitLogs.filter((ul) => ul.trainingUnit.type === 'stretching').length, 0
  )
  const warmupDone = sessions.reduce(
    (n, s) => n + s.unitLogs.filter((ul) => ul.trainingUnit.type === 'stretching' && ul.completed).length, 0
  )

  // ── Collect all training units that appear in sessions ────────────
  const unitMap = new Map<string, string>() // name → type
  for (const s of sessions) {
    for (const ul of s.unitLogs) {
      if (!unitMap.has(ul.trainingUnit.name)) {
        unitMap.set(ul.trainingUnit.name, ul.trainingUnit.type)
      }
    }
  }

  const allUnits = Array.from(unitMap.entries())
    .map(([name, type]) => ({ name, type }))
    .sort((a, b) => {
      const ai = TYPE_PRIORITY.indexOf(a.type)
      const bi = TYPE_PRIORITY.indexOf(b.type)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

  // ── Trend ─────────────────────────────────────────────────────────
  const trend = computeTrend(sessions)

  const noChartData = completedSessions < 2

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <button onClick={handleClear} disabled={isPending} title="Clear all data" className="p-2 text-slate-700 hover:text-red-400 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
        {/* Range selector */}
        <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                range === key ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {msg && <p className="text-xs text-emerald-400 bg-emerald-900/20 rounded px-3 py-2">{msg}</p>}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Sessions done" value={completedSessions} icon={Calendar} sub={`of ${sessions.length} started`} />
        <StatCard label="Climbs logged" value={totalClimbs} icon={Mountain} />
        <StatCard label="Per week" value={avgPerWeek} icon={Dumbbell} sub="avg sessions" />
        {trend ? (
          <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-slate-700 p-2.5 rounded-lg">
              {trend.pct > 5
                ? <TrendingUp size={20} className="text-emerald-400" />
                : trend.pct < -5
                ? <TrendingDown size={20} className="text-red-400" />
                : <Minus size={20} className="text-slate-400" />}
            </div>
            <div>
              <p className={`text-2xl font-bold ${trend.pct > 5 ? 'text-emerald-400' : trend.pct < -5 ? 'text-red-400' : 'text-slate-300'}`}>
                {trend.pct > 5 ? `+${trend.pct.toFixed(0)}%` : trend.pct < -5 ? `${trend.pct.toFixed(0)}%` : '—'}
              </p>
              <p className="text-xs text-slate-400">Volume trend</p>
              <p className="text-xs text-slate-500">
                {trend.pct > 5 ? 'Improving' : trend.pct < -5 ? 'Declining' : 'Stable'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-3 opacity-40">
            <div className="bg-slate-700 p-2.5 rounded-lg"><Minus size={20} className="text-slate-500" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-500">—</p>
              <p className="text-xs text-slate-500">Volume trend</p>
              <p className="text-xs text-slate-600">Need ≥ 4 sessions</p>
            </div>
          </div>
        )}
        {warmupPlanned > 0 && (
          <div className="col-span-2">
            <StatCard
              label="Warmups done"
              value={`${warmupDone} / ${warmupPlanned}`}
              icon={Flame}
              sub={warmupPlanned - warmupDone > 0 ? `${warmupPlanned - warmupDone} skipped` : 'All completed'}
            />
          </div>
        )}
      </div>

      {noChartData && (
        <p className="text-center text-slate-500 text-sm py-8">
          {sessions.length === 0 ? 'No sessions in this period.' : 'Complete sessions to see progress charts here.'}
        </p>
      )}

      {allUnits.map(({ name, type }) => {
        if (type === 'climbing') return <PerUnitClimbingChart key={name} sessions={sessions} unitName={name} />
        if (type === 'exercise' || type === 'hangboard') return <ExerciseChart key={name} sessions={sessions} unitName={name} />
        if (type === 'cardio') return <CardioChart key={name} sessions={sessions} unitName={name} />
        if (type === 'stretching') return null
        return null
      })}
    </div>
  )
}
