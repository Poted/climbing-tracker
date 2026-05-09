import { getSessions } from '@/lib/actions'
import { format, parseISO } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { CheckCircle2, Circle, Mountain } from 'lucide-react'

export default async function HistoryPage() {
  const sessions = await getSessions(60)

  return (
    <div className="overflow-x-hidden">
      <h1 className="text-xl font-bold mb-6">Training History</h1>

      {sessions.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-12">
          No sessions yet. Start from the <strong>Training</strong> tab.
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
                    {format(parseISO(s.date), 'EEEE, MMM d yyyy', { locale: enUS })}
                  </p>
                  {s.planDay && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Day {s.planDay.dayNumber}
                      {s.planDay.name && ` — ${s.planDay.name}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
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
