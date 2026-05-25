import { getCycles, getCycleWithSessions } from '@/lib/actions'
import { notFound } from 'next/navigation'
import RetrospectiveClient from './RetrospectiveClient'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function RetrospectivePage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }> | { cycle?: string }
}) {
  const params = await Promise.resolve(searchParams)
  const cycles = await getCycles()

  if (cycles.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/today" className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">Retrospective</h1>
        </div>
        <p className="text-slate-400 text-sm text-center py-12">
          No training cycles yet. Start a cycle from the Today page.
        </p>
      </div>
    )
  }

  const targetId = params.cycle ?? cycles[0].id
  const cycle = await getCycleWithSessions(targetId)
  if (!cycle) notFound()

  const idx = cycles.findIndex((c) => c.id === targetId)
  const prevCycleId = cycles[idx + 1]?.id ?? null  // older
  const nextCycleId = cycles[idx - 1]?.id ?? null  // newer

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/today" className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">
            {cycle.name ?? `Cycle — ${cycle.startDate}`}
          </h1>
          {cycles.length > 1 && (
            <div className="flex gap-3 mt-1">
              {prevCycleId && (
                <Link href={`/retrospective?cycle=${prevCycleId}`} className="text-xs text-slate-500 hover:text-slate-300">
                  ← Older
                </Link>
              )}
              {nextCycleId && (
                <Link href={`/retrospective?cycle=${nextCycleId}`} className="text-xs text-slate-500 hover:text-slate-300">
                  Newer →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <RetrospectiveClient cycle={cycle} />
    </div>
  )
}
