import { getSessionByDate, getGyms, getCurrentCycle } from '@/lib/actions'
import { format } from 'date-fns'
import TodayClient from './TodayClient'

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }> | { date?: string }
}) {
  const params = await Promise.resolve(searchParams)
  const today = format(new Date(), 'yyyy-MM-dd')
  const date = params.date ?? today

  const [session, gyms, cycle] = await Promise.all([
    getSessionByDate(date),
    getGyms(),
    getCurrentCycle(),
  ])

  const currentCycle = cycle
    ? { id: cycle.id, name: cycle.name, startDate: cycle.startDate, status: cycle.status }
    : null

  return (
    <TodayClient
      key={date}
      date={date}
      today={today}
      initialSession={session as Parameters<typeof TodayClient>[0]['initialSession']}
      gyms={gyms}
      currentCycle={currentCycle}
    />
  )
}
