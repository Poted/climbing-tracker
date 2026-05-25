import { getSessions, getCycles } from '@/lib/actions'
import { format, parseISO } from 'date-fns'
import { enUS } from 'date-fns/locale'
import {
  CheckCircle2, Circle, Mountain, Ruler, Dumbbell,
  ChevronLeft, ChevronRight, ClipboardList,
} from 'lucide-react'
import Link from 'next/link'

function prevMonth(m: string) {
  const [y, mon] = m.split('-').map(Number)
  return mon === 1 ? `${y - 1}-12` : `${y}-${String(mon - 1).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mon] = m.split('-').map(Number)
  return mon === 12 ? `${y + 1}-01` : `${y}-${String(mon + 1).padStart(2, '0')}`
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }> | { month?: string }
}) {
  const params = await Promise.resolve(searchParams)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const month = params.month ?? currentMonth
  const isCurrentMonth = month === currentMonth

  const [sessions, cycles] = await Promise.all([
    getSessions(100, month),
    getCycles(),
  ])

  const cycleMap = new Map(cycles.map((c) => [c.id, c]))
  const [year, mon] = month.split('-').map(Number)
  const monthLabel = format(new Date(year, mon - 1, 1), 'MMMM yyyy', { locale: enUS })

  const cycleIdsInMonth = Array.from(new Set(
    sessions.filter((s) => (s as { cycleId?: string | null }).cycleId != null)
      .map((s) => (s as { cycleId: string }).cycleId)
  ))

  return (
    <div className="overflow-x-hidden">
      <h1 className="text-xl font-bold mb-4">Training History</h1>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4 bg-slate-800 rounded-xl px-4 py-2.5">
        <Link
          href={`/history?month=${prevMonth(month)}`}
          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronLeft size={18} />
        </Link>
        <span className="text-sm font-medium">{monthLabel}</span>
        <Link
          href={isCurrentMonth ? '/history' : `/history?month=${nextMonth(month)}`}
          className={`p-1 transition-colors ${isCurrentMonth ? 'text-slate-700 pointer-events-none' : 'text-slate-400 hover:text-slate-200'}`}
          aria-disabled={isCurrentMonth}
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* Retrospective links for cycles in this month */}
      {cycleIdsInMonth.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {cycleIdsInMonth.map((id) => {
            const cycle = cycleMap.get(id)
            const label = cycle?.name ?? `Started ${cycle?.startDate ?? '…'}`
            return (
              <Link
                key={id}
                href={`/retrospective?cycle=${id}`}
                className="flex items-center gap-1.5 text-xs bg-slate-800 border border-slate-700 hover:border-emerald-700 text-slate-400 hover:text-emerald-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ClipboardList size={12} />
                {label} — Retrospective
              </Link>
            )
          })}
        </div>
      )}

      {sessions.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-12">
          No sessions in {monthLabel}.
        </p>
      )}

      <div className="space-y-3">
        {sessions.map((s) => {
          const activities = s.activities ?? []
          const climbing = activities.filter((a) => a.type === 'climbing')
          const running = activities.filter((a) => a.type === 'running')
          const other = activities.filter((a) => a.type === 'other')
          const isLegacy = activities.length === 0 && s.unitLogs.length > 0
          const isCompleted = !!s.completedAt
          const sWithCycle = s as typeof s & { cycleId?: string | null }

          return (
            <Link key={s.id} href={`/today?date=${s.date}`} className="block">
              <div className="bg-slate-800 rounded-xl p-4 min-w-0 overflow-hidden active:bg-slate-750 transition-colors">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div>
                    <p className="font-medium text-sm">
                      {format(parseISO(s.date), 'EEEE, MMM d', { locale: enUS })}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activities.length > 0
                        ? `${activities.length} activit${activities.length === 1 ? 'y' : 'ies'}`
                        : isLegacy
                        ? `${s.unitLogs.length} unit${s.unitLogs.length === 1 ? '' : 's'}`
                        : 'No activities'}
                      {sWithCycle.cycleId && cycleMap.has(sWithCycle.cycleId) && (
                        <span className="ml-2 text-slate-600">
                          · {cycleMap.get(sWithCycle.cycleId)?.name ?? 'Cycle'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.rpe != null && (
                      <span className="text-xs text-slate-600">RPE {s.rpe}</span>
                    )}
                    {isCompleted
                      ? <CheckCircle2 size={16} className="text-emerald-400" />
                      : <Circle size={16} className="text-slate-600" />}
                  </div>
                </div>

                {/* New model: activities */}
                {activities.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {climbing.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <Mountain size={12} className="text-emerald-400 shrink-0" />
                        {climbing.slice(0, 10).map((c) => {
                          const abbr: Record<string, string> = {
                            onsight: 'os', flash: 'fl', redpoint: 'rp',
                            topRope: 'tr', attempt: '✗',
                          }
                          const suf = c.style ? ` (${abbr[c.style] ?? c.style})` : ''
                          return (
                            <span
                              key={c.id}
                              className="text-xs bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded shrink-0"
                            >
                              {c.grade ?? '?'}{suf}
                            </span>
                          )
                        })}
                        {climbing.length > 10 && (
                          <span className="text-xs text-slate-600">+{climbing.length - 10}</span>
                        )}
                      </div>
                    )}
                    {running.map((r) => (
                      <div key={r.id} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Ruler size={12} className="text-blue-400 shrink-0" />
                        <span>
                          {r.distanceKm != null ? `${r.distanceKm} km` : 'Run'}
                          {r.durationMin != null && ` · ${r.durationMin} min`}
                          {r.pace != null && ` · ${r.pace.toFixed(1)} min/km`}
                        </span>
                      </div>
                    ))}
                    {other.map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Dumbbell size={12} className="text-slate-500 shrink-0" />
                        <span>
                          {a.name ?? 'Other'}
                          {a.durationMin != null && ` · ${a.durationMin} min`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Legacy: unitLogs fallback */}
                {isLegacy && (
                  <div className="mt-3 flex flex-wrap gap-1.5 min-w-0">
                    {s.unitLogs.slice(0, 6).map((l) => (
                      <span
                        key={l.id}
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          l.completed
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-slate-700 text-slate-500 line-through'
                        }`}
                      >
                        {l.trainingUnit.name}
                      </span>
                    ))}
                    {s.unitLogs.length > 6 && (
                      <span className="text-xs text-slate-600">+{s.unitLogs.length - 6}</span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
