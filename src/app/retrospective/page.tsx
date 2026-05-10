import { getCycleData, getMaxCycleNumber, getPlan } from '@/lib/actions'
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
  const maxCycle = await getMaxCycleNumber()
  const cycleNumber = params.cycle ? parseInt(params.cycle) : maxCycle

  if (isNaN(cycleNumber) || cycleNumber < 1) notFound()

  const [sessions, plan] = await Promise.all([
    getCycleData(cycleNumber),
    getPlan(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/today" className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Cycle {cycleNumber} — Retrospective</h1>
          {maxCycle > 1 && (
            <div className="flex gap-3 mt-1">
              {cycleNumber > 1 && (
                <Link href={`/retrospective?cycle=${cycleNumber - 1}`} className="text-xs text-slate-500 hover:text-slate-300">← Cycle {cycleNumber - 1}</Link>
              )}
              {cycleNumber < maxCycle && (
                <Link href={`/retrospective?cycle=${cycleNumber + 1}`} className="text-xs text-slate-500 hover:text-slate-300">Cycle {cycleNumber + 1} →</Link>
              )}
            </div>
          )}
        </div>
      </div>

      <RetrospectiveClient sessions={sessions} cycleNumber={cycleNumber} plan={plan} />
    </div>
  )
}
