import { getSessions } from '@/lib/actions'
import { format, parseISO } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { CheckCircle2, Circle, Mountain, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
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

  const sessions = await getSessions(100, month)

  const [year, mon] = month.split('-').map(Number)
  const monthLabel = format(new Date(year, mon - 1, 1), 'MMMM yyyy', { locale: enUS })

  const cycleNumbers = Array.from(new Set(
    sessions.filter((s) => s.cycleNumber != null).map((s) => s.cycleNumber!)
  )).sort((a, b) => a - b)

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
      {cycleNumbers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {cycleNumbers.map((n) => (
            <Link
              key={n}
              href={`/retrospective?cycle=${n}`}
              className="flex items-center gap-1.5 text-xs bg-slate-800 border border-slate-700 hover:border-emerald-700 text-slate-400 hover:text-emerald-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ClipboardList size={12} />
              Cycle {n} — Retrospective
            </Link>
          ))}
        </div>
      )}

      {sessions.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-12">
          No sessions in {monthLabel}.
        </p>
      )}

      <div className="space-y-3">
        {sessions.map((s) => {
          const doneCount = s.unitLogs.filter((l) => l.completed).length
          const total = s.unitLogs.length
          const climbCount = s.unitLogs.reduce((sum, l) => sum + l.climbLogs.length, 0)
          const isCompleted = !!s.completedAt

          return (
            <div key={s.id} className="bg-slate-800 rounded-xl p-4 min-w-0 overflow-hidden">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div>
                  <p className="font-medium text-sm">
                    {format(parseISO(s.date), 'EEEE, MMM d', { locale: enUS })}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {s.planDay
                      ? `Day ${s.planDay.dayNumber}${s.planDay.name ? ` — ${s.planDay.name}` : ''}`
                      : 'Free session'}
                    {s.cycleNumber != null && (
                      <span className="ml-2 text-slate-600">· Cycle {s.cycleNumber}</span>
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
                  <span className={`text-xs ${isCompleted ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {doneCount}/{total}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 min-w-0">
                {s.unitLogs.map((l) => (
                  <span
                    key={l.id}
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      l.completed
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : 'bg-slate-700 text-slate-400 line-through'
                    }`}
                  >
                    {l.trainingUnit.name}
                    {l.repsActual ? ` ×${l.repsActual}` : ''}
                  </span>
                ))}
              </div>

              {climbCount > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400 min-w-0">
                  <Mountain size={12} className="text-emerald-400" />
                  {climbCount} {climbCount === 1 ? 'climb' : 'climbs'}
                  {' · '}
                  {s.unitLogs
                    .flatMap((l) => l.climbLogs)
                    .slice(0, 8)
                    .map((c) => {
                      const abbr: Record<string, string> = { onsight: 'os', flash: 'fl', redpoint: 'rp', hangdog: 'hd' }
                      const suf = c.style ? ` (${abbr[c.style] ?? c.style})` : ''
                      return c.grade + suf
                    })
                    .join(', ')}
                  {s.unitLogs.flatMap((l) => l.climbLogs).length > 8 && '…'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
