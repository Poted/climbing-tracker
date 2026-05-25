'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from './prisma'
import { auth, signIn } from '@/auth'
import { AuthError } from 'next-auth'

// ─── Authentication ───────────────────────────────────────────────────

export async function authenticate(email: string, password: string): Promise<string | null> {
  try {
    await signIn('credentials', { email, password, redirectTo: '/' })
    return null
  } catch (error) {
    if (error instanceof AuthError) {
      return 'Nieprawidłowy email lub hasło.'
    }
    throw error // re-throw NEXT_REDIRECT — musi przelecieć do klienta
  }
}

// ─── Auth helper ──────────────────────────────────────────────────────

async function getUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session.user.id
}

// ─── Shared include for SessionUnitLog ───────────────────────────────

const unitLogInclude = {
  trainingUnit: true,
  planDayUnit: true,
  climbLogs: { orderBy: { createdAt: 'asc' as const } },
  setLogs: { orderBy: { setNumber: 'asc' as const } },
  gym: { include: { grades: { orderBy: { order: 'asc' as const } } } },
}

const sessionInclude = {
  planDay: true,
  unitLogs: {
    include: unitLogInclude,
  },
  activities: {
    include: {
      gym: { include: { grades: { orderBy: { order: 'asc' as const } } } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
}

// ─── Training Units ───────────────────────────────────────────────────

export async function getTrainingUnits() {
  const userId = await getUserId()
  return prisma.trainingUnit.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
}

export async function createTrainingUnit(data: {
  name: string
  type: string
  description?: string
}) {
  const userId = await getUserId()
  const unit = await prisma.trainingUnit.create({ data: { ...data, userId } })
  revalidatePath('/units')
  revalidatePath('/plan')
  return unit
}

export async function updateTrainingUnit(
  id: string,
  data: { name?: string; type?: string; description?: string }
) {
  const userId = await getUserId()
  const unit = await prisma.trainingUnit.update({ where: { id, userId }, data })
  revalidatePath('/units')
  revalidatePath('/plan')
  return unit
}

export async function deleteTrainingUnit(id: string) {
  const userId = await getUserId()
  const count = await prisma.sessionUnitLog.count({
    where: { trainingUnitId: id, session: { userId } },
  })
  if (count > 0) {
    throw new Error(
      `This unit has ${count} session log${count === 1 ? '' : 's'} in history. Rename it instead of deleting — history will update automatically.`
    )
  }
  await prisma.trainingUnit.delete({ where: { id, userId } })
  revalidatePath('/units')
  revalidatePath('/plan')
}

// ─── Plan Days ────────────────────────────────────────────────────────

export async function getPlan() {
  const userId = await getUserId()
  return prisma.planDay.findMany({
    where: { userId },
    orderBy: { dayNumber: 'asc' },
    include: {
      units: {
        orderBy: { order: 'asc' },
        include: { trainingUnit: true },
      },
    },
  })
}

export async function createPlanDay(data: { dayNumber: number; name?: string }) {
  const userId = await getUserId()
  const day = await prisma.planDay.create({ data: { ...data, userId } })
  revalidatePath('/plan')
  return day
}

export async function updatePlanDay(id: string, data: { name?: string }) {
  const userId = await getUserId()
  const day = await prisma.planDay.update({ where: { id, userId }, data })
  revalidatePath('/plan')
  return day
}

export async function deletePlanDay(id: string) {
  const userId = await getUserId()
  await prisma.planDay.delete({ where: { id, userId } })
  revalidatePath('/plan')
}

export async function addUnitToPlanDay(data: {
  planDayId: string
  trainingUnitId: string
  order: number
  targetReps?: number
  targetSets?: number
  timesPerDay?: number
  notes?: string
}) {
  await getUserId()
  const entry = await prisma.planDayUnit.create({ data })
  revalidatePath('/plan')
  return entry
}

export async function updatePlanDayUnit(
  id: string,
  data: {
    order?: number
    targetReps?: number
    targetSets?: number
    timesPerDay?: number
    notes?: string
  }
) {
  await getUserId()
  const entry = await prisma.planDayUnit.update({ where: { id }, data })
  revalidatePath('/plan')
  return entry
}

export async function removePlanDayUnit(id: string) {
  await getUserId()
  await prisma.planDayUnit.delete({ where: { id } })
  revalidatePath('/plan')
}

// ─── Sessions ─────────────────────────────────────────────────────────

export async function getSessions(limit = 100, month?: string) {
  const userId = await getUserId()
  let dateFilter: { gte: string; lt: string } | undefined
  if (month) {
    const [year, mon] = month.split('-').map(Number)
    const nextMon = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`
    dateFilter = { gte: `${month}-01`, lt: `${nextMon}-01` }
  }
  return prisma.trainingSession.findMany({
    where: { userId, ...(dateFilter ? { date: dateFilter } : {}) },
    orderBy: { date: 'desc' },
    take: limit,
    include: sessionInclude,
  })
}

export async function getSessionByDate(date: string) {
  const userId = await getUserId()
  return prisma.trainingSession.findUnique({
    where: { userId_date: { userId, date } },
    include: sessionInclude,
  })
}

export async function getLastSession() {
  const userId = await getUserId()
  return prisma.trainingSession.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
    include: { planDay: true },
  })
}

export async function getOrCreateSession(date: string) {
  const userId = await getUserId()
  const existing = await prisma.trainingSession.findUnique({
    where: { userId_date: { userId, date } },
    include: sessionInclude,
  })
  if (existing) return existing
  return prisma.trainingSession.create({
    data: { date, userId },
    include: sessionInclude,
  })
}

export async function addUnitLogToDate(data: {
  date: string
  trainingUnitId: string
  planDayUnitId?: string
  planDayId?: string
  cycleNumber?: number
}) {
  const userId = await getUserId()
  let session = await prisma.trainingSession.findUnique({
    where: { userId_date: { userId, date: data.date } },
  })
  if (!session) {
    session = await prisma.trainingSession.create({
      data: {
        date: data.date,
        userId,
        planDayId: data.planDayId ?? null,
        cycleNumber: data.cycleNumber ?? 1,
      },
    })
  }
  const log = await prisma.sessionUnitLog.create({
    data: {
      sessionId: session.id,
      trainingUnitId: data.trainingUnitId,
      planDayUnitId: data.planDayUnitId ?? null,
    },
    include: unitLogInclude,
  })
  revalidatePath('/today')
  revalidatePath('/')
  revalidatePath('/history')
  return { sessionId: session.id, log }
}

export async function removeUnitLog(id: string) {
  await getUserId()
  await prisma.sessionUnitLog.delete({ where: { id } })
  revalidatePath('/today')
  revalidatePath('/')
  revalidatePath('/history')
}

export async function updateSessionUnitLog(
  id: string,
  data: {
    completed?: boolean
    notes?: string
    durationSec?: number
    distanceM?: number
    weightKg?: number
    gripType?: string
    gymId?: string
  }
) {
  await getUserId()
  const log = await prisma.sessionUnitLog.update({ where: { id }, data })
  revalidatePath('/')
  return log
}

export async function completeSession(id: string, rpe?: number) {
  await getUserId()
  const session = await prisma.trainingSession.update({
    where: { id },
    data: { completedAt: new Date(), ...(rpe != null ? { rpe } : {}) },
  })
  revalidatePath('/')
  revalidatePath('/history')
  return session
}

export async function updateSessionPreState(id: string, data: {
  fingersBefore?: number
  bicepsBefore?: number
  shouldersBefore?: number
  fatigueBefore?: number
}) {
  await getUserId()
  return prisma.trainingSession.update({ where: { id }, data })
}

export async function updateSessionRPE(id: string, rpe: number) {
  await getUserId()
  return prisma.trainingSession.update({ where: { id }, data: { rpe } })
}

export async function ensureSessionForDate(date: string, planDayId?: string, cycleNumber?: number) {
  const userId = await getUserId()
  const existing = await prisma.trainingSession.findUnique({
    where: { userId_date: { userId, date } },
    select: { id: true },
  })
  if (existing) return existing.id
  const cycle = await prisma.trainingCycle.findFirst({
    where: { userId, status: 'open' },
    orderBy: { startDate: 'desc' },
  })
  const created = await prisma.trainingSession.create({
    data: {
      date, userId,
      planDayId: planDayId ?? null,
      cycleNumber: cycleNumber ?? 1,
      cycleId: cycle?.id ?? null,
    },
    select: { id: true },
  })
  return created.id
}

export async function deleteTrainingSession(id: string) {
  const userId = await getUserId()
  await prisma.trainingSession.deleteMany({ where: { id, userId } })
  revalidatePath('/')
  revalidatePath('/history')
}

export async function getPreviousUnitLogs(
  trainingUnitIds: string[],
  beforeDate: string
): Promise<Record<string, {
  repsActual: number | null
  setsActual: number | null
  setLogs: { setNumber: number; reps: number; weightKg: number | null }[]
  climbLogs: { grade: string; gymGradeOrder: number | null }[]
}>> {
  const userId = await getUserId()
  const result: Record<string, {
    repsActual: number | null
    setsActual: number | null
    setLogs: { setNumber: number; reps: number; weightKg: number | null }[]
    climbLogs: { grade: string; gymGradeOrder: number | null }[]
  }> = {}

  await Promise.all(
    trainingUnitIds.map(async (id) => {
      const log = await prisma.sessionUnitLog.findFirst({
        where: {
          trainingUnitId: id,
          session: { date: { lt: beforeDate }, userId },
        },
        orderBy: { session: { date: 'desc' } },
        include: {
          setLogs: { orderBy: { setNumber: 'asc' } },
          climbLogs: { orderBy: { createdAt: 'asc' }, select: { grade: true, gymGradeOrder: true } },
        },
      })
      if (log) {
        result[id] = {
          repsActual: log.repsActual,
          setsActual: log.setsActual,
          setLogs: log.setLogs,
          climbLogs: log.climbLogs,
        }
      }
    })
  )
  return result
}

// ─── Gyms & Grade Mappings ────────────────────────────────────────────

export async function getGyms() {
  const userId = await getUserId()
  return prisma.gym.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { grades: { orderBy: { order: 'asc' } } },
  })
}

export async function createGym(data: { name: string; type?: string }) {
  const userId = await getUserId()
  const gym = await prisma.gym.create({ data: { ...data, userId } })
  revalidatePath('/gyms')
  return gym
}

export async function updateGym(id: string, data: { name?: string; type?: string }) {
  const userId = await getUserId()
  const gym = await prisma.gym.update({ where: { id, userId }, data })
  revalidatePath('/gyms')
  return gym
}

export async function deleteGym(id: string) {
  const userId = await getUserId()
  await prisma.gym.delete({ where: { id, userId } })
  revalidatePath('/gyms')
  revalidatePath('/today')
}

export async function addGradeMapping(data: {
  gymId: string
  localGrade: string
  order: number
}) {
  await getUserId()
  const mapping = await prisma.gradeMapping.create({ data })
  revalidatePath('/gyms')
  return mapping
}

export async function deleteGradeMapping(id: string) {
  await getUserId()
  await prisma.gradeMapping.delete({ where: { id } })
  revalidatePath('/gyms')
}

export async function swapGradeOrders(id1: string, order1: number, id2: string, order2: number) {
  await getUserId()
  await prisma.gradeMapping.update({ where: { id: id1 }, data: { order: order2 } })
  await prisma.gradeMapping.update({ where: { id: id2 }, data: { order: order1 } })
  revalidatePath('/gyms')
  revalidatePath('/today')
}

// ─── Set Logs ─────────────────────────────────────────────────────────

async function syncUnitLogTotals(sessionLogId: string) {
  const sets = await prisma.setLog.findMany({ where: { sessionLogId } })
  await prisma.sessionUnitLog.update({
    where: { id: sessionLogId },
    data: {
      repsActual: sets.length > 0 ? sets.reduce((s, x) => s + x.reps, 0) : null,
      setsActual: sets.length > 0 ? sets.length : null,
    },
  })
}

export async function addSetLog(data: {
  sessionLogId: string
  reps: number
  weightKg?: number
}) {
  await getUserId()
  const count = await prisma.setLog.count({ where: { sessionLogId: data.sessionLogId } })
  const log = await prisma.setLog.create({
    data: { sessionLogId: data.sessionLogId, reps: data.reps, setNumber: count + 1, weightKg: data.weightKg },
  })
  await syncUnitLogTotals(data.sessionLogId)
  revalidatePath('/')
  return log
}

export async function deleteSetLog(id: string) {
  await getUserId()
  const setLog = await prisma.setLog.findUnique({ where: { id }, select: { sessionLogId: true } })
  await prisma.setLog.delete({ where: { id } })
  if (setLog) {
    const remaining = await prisma.setLog.findMany({
      where: { sessionLogId: setLog.sessionLogId },
      orderBy: { setNumber: 'asc' },
    })
    await Promise.all(remaining.map((s, i) =>
      prisma.setLog.update({ where: { id: s.id }, data: { setNumber: i + 1 } })
    ))
    await syncUnitLogTotals(setLog.sessionLogId)
  }
  revalidatePath('/')
}

// ─── Climb Logs ───────────────────────────────────────────────────────

export async function addClimbLog(data: {
  sessionLogId: string
  grade: string
  gymGradeOrder?: number
  wallColor?: string
  attempts?: number
  style?: string
  notes?: string
}) {
  await getUserId()
  const log = await prisma.climbLog.create({ data })
  revalidatePath('/')
  return log
}

export async function deleteClimbLog(id: string) {
  await getUserId()
  await prisma.climbLog.delete({ where: { id } })
  revalidatePath('/')
}

// ─── Training Cycles ──────────────────────────────────────────────────

export async function getCurrentCycle() {
  const userId = await getUserId()
  return prisma.trainingCycle.findFirst({
    where: { userId, status: 'open' },
    orderBy: { startDate: 'desc' },
    include: { sessions: { orderBy: { date: 'asc' } } },
  })
}

export async function getCycles() {
  const userId = await getUserId()
  return prisma.trainingCycle.findMany({
    where: { userId },
    orderBy: { startDate: 'desc' },
    include: {
      sessions: { orderBy: { date: 'asc' } },
      retrospective: true,
    },
  })
}

export async function startCycle(data?: { name?: string; startDate?: string }) {
  const userId = await getUserId()
  const today = new Date().toISOString().slice(0, 10)
  const cycle = await prisma.trainingCycle.create({
    data: { userId, name: data?.name, startDate: data?.startDate ?? today, status: 'open' },
  })
  revalidatePath('/')
  revalidatePath('/retrospective')
  return cycle
}

export async function updateCycleStatus(
  id: string,
  status: 'open' | 'retrospective' | 'finalized',
  endDate?: string
) {
  const userId = await getUserId()
  const cycle = await prisma.trainingCycle.update({
    where: { id, userId },
    data: { status, ...(endDate ? { endDate } : {}) },
  })
  revalidatePath('/')
  revalidatePath('/retrospective')
  return cycle
}

export async function getCycleWithSessions(id: string) {
  const userId = await getUserId()
  return prisma.trainingCycle.findUnique({
    where: { id, userId },
    include: {
      sessions: {
        orderBy: { date: 'asc' },
        include: {
          activities: {
            include: {
              gym: { include: { grades: { orderBy: { order: 'asc' } } } },
            },
            orderBy: { createdAt: 'asc' as const },
          },
        },
      },
      retrospective: true,
    },
  })
}

// ─── Activities ───────────────────────────────────────────────────────

type ActivityInput = {
  type: string
  climbingType?: string
  grade?: string
  gymGradeOrder?: number
  attempts?: number
  success?: boolean
  style?: string
  distanceKm?: number
  pace?: number
  durationMin?: number
  gymId?: string
  name?: string
  data?: string
  notes?: string
}

export async function addActivityToDate(input: ActivityInput & { date: string }) {
  const userId = await getUserId()
  const { date, ...activityFields } = input

  const cycle = await prisma.trainingCycle.findFirst({
    where: { userId, status: 'open' },
    orderBy: { startDate: 'desc' },
  })

  let session = await prisma.trainingSession.findUnique({
    where: { userId_date: { userId, date } },
  })
  if (!session) {
    session = await prisma.trainingSession.create({
      data: { date, userId, cycleId: cycle?.id ?? null },
    })
  } else if (!session.cycleId && cycle) {
    session = await prisma.trainingSession.update({
      where: { id: session.id },
      data: { cycleId: cycle.id },
    })
  }

  const activity = await prisma.activity.create({
    data: { ...activityFields, sessionId: session.id },
    include: {
      gym: { include: { grades: { orderBy: { order: 'asc' } } } },
    },
  })
  revalidatePath('/today')
  revalidatePath('/')
  revalidatePath('/history')
  return { sessionId: session.id, activity }
}

export async function updateActivity(id: string, input: Partial<ActivityInput>) {
  await getUserId()
  const activity = await prisma.activity.update({ where: { id }, data: input })
  revalidatePath('/today')
  revalidatePath('/')
  return activity
}

export async function deleteActivity(id: string) {
  await getUserId()
  await prisma.activity.delete({ where: { id } })
  revalidatePath('/today')
  revalidatePath('/')
  revalidatePath('/history')
}

// ─── Retrospective ────────────────────────────────────────────────────

export async function saveRetrospective(cycleId: string, summary: string) {
  const userId = await getUserId()
  const retro = await prisma.retrospective.upsert({
    where: { cycleId },
    create: { cycleId, userId, summary, status: 'draft' },
    update: { summary },
  })
  revalidatePath('/retrospective')
  return retro
}

export async function finalizeRetrospective(cycleId: string) {
  const userId = await getUserId()
  const today = new Date().toISOString().slice(0, 10)
  await prisma.$transaction([
    prisma.retrospective.update({ where: { cycleId }, data: { status: 'finalized' } }),
    prisma.trainingCycle.update({ where: { id: cycleId, userId }, data: { status: 'finalized', endDate: today } }),
  ])
  revalidatePath('/')
  revalidatePath('/retrospective')
}

// ─── Legacy Cycle / Retrospective ─────────────────────────────────────

export async function getMaxCycleNumber() {
  const userId = await getUserId()
  const result = await prisma.trainingSession.aggregate({
    where: { userId },
    _max: { cycleNumber: true },
  })
  return result._max.cycleNumber ?? 1
}

export async function getCycleData(cycleNumber: number) {
  const userId = await getUserId()
  return prisma.trainingSession.findMany({
    where: { cycleNumber, userId },
    orderBy: { date: 'asc' },
    include: {
      planDay: true,
      unitLogs: {
        include: {
          trainingUnit: true,
          setLogs: { orderBy: { setNumber: 'asc' } },
          climbLogs: { orderBy: { createdAt: 'asc' } },
          gym: { include: { grades: { orderBy: { order: 'asc' } } } },
        },
      },
    },
  })
}

// ─── Dashboard data ───────────────────────────────────────────────────

export async function getDashboardStats() {
  const userId = await getUserId()
  const [sessions, gyms] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      include: {
        unitLogs: {
          include: {
            trainingUnit: true,
            climbLogs: { orderBy: { createdAt: 'asc' } },
            setLogs: { orderBy: { setNumber: 'asc' } },
            gym: { include: { grades: { orderBy: { order: 'asc' } } } },
          },
        },
      },
    }),
    prisma.gym.findMany({
      where: { userId },
      include: { grades: { orderBy: { order: 'asc' } } },
    }),
  ])
  return { sessions, gyms }
}
