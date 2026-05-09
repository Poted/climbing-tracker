import { getSessionByDate, getPlan, getGyms, getPreviousUnitLogs, getLastSession, getTrainingUnits } from '@/lib/actions'
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

  const [session, plan, allUnits, gyms, lastSession] = await Promise.all([
    getSessionByDate(date),
    getPlan(),
    getTrainingUnits(),
    getGyms(),
    getLastSession(),
  ])

  // Determine next plan day in cycle (cyclic order)
  let suggestedPlanDay = plan[0] ?? null
  if (plan.length > 0 && lastSession?.planDayId) {
    const lastIdx = plan.findIndex((d) => d.id === lastSession.planDayId)
    if (lastIdx !== -1) {
      suggestedPlanDay = plan[(lastIdx + 1) % plan.length]
    }
  }

  // Compute cycle number for new sessions created today
  let currentCycleNumber = lastSession?.cycleNumber ?? 1
  if (plan.length > 0 && lastSession?.planDayId && suggestedPlanDay) {
    const lastIdx = plan.findIndex((d) => d.id === lastSession.planDayId)
    const nextIdx = plan.findIndex((d) => d.id === suggestedPlanDay!.id)
    // Wrapping around → new cycle
    if (lastIdx !== -1 && nextIdx !== -1 && nextIdx <= lastIdx) {
      currentCycleNumber = (lastSession.cycleNumber ?? 1) + 1
    }
  }

  // Detect if the last completed session finished a cycle (was last plan day)
  const lastPlanDay = plan[plan.length - 1] ?? null
  const completedCycleNumber =
    lastSession?.completedAt && lastPlanDay && lastSession.planDayId === lastPlanDay.id
      ? (lastSession.cycleNumber ?? 1)
      : null

  // Load previous unit logs for comparison
  const trainingUnitIds = session?.unitLogs.map((l) => l.trainingUnitId) ?? []
  const prevData = trainingUnitIds.length > 0
    ? await getPreviousUnitLogs(trainingUnitIds, date)
    : {}

  return (
    <TodayClient
      key={date}
      date={date}
      today={today}
      initialSession={session}
      suggestedPlanDay={suggestedPlanDay}
      allUnits={allUnits}
      gyms={gyms}
      prevData={prevData}
      currentCycleNumber={currentCycleNumber}
      completedCycleNumber={completedCycleNumber}
    />
  )
}
