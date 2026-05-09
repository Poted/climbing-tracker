'use server'

import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'

async function getUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session.user.id
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export async function seedDemoData() {
  const userId = await getUserId()

  const gym = await prisma.gym.create({
    data: {
      name: 'Mood Climbing',
      type: 'boulder',
      userId,
      grades: {
        create: [
          { localGrade: 'yellow', order: 0 },
          { localGrade: 'orange', order: 1 },
          { localGrade: 'blue', order: 2 },
          { localGrade: 'green', order: 3 },
          { localGrade: 'red', order: 4 },
          { localGrade: 'black', order: 5 },
        ],
      },
    },
    include: { grades: { orderBy: { order: 'asc' } } },
  })

  const [warmup, bouldering, pullups, pushups] = await Promise.all([
    prisma.trainingUnit.create({ data: { name: 'Warm-up', type: 'stretching', userId } }),
    prisma.trainingUnit.create({ data: { name: 'Bouldering', type: 'climbing', userId } }),
    prisma.trainingUnit.create({ data: { name: 'Pull-ups', type: 'exercise', userId } }),
    prisma.trainingUnit.create({ data: { name: 'Push-ups', type: 'exercise', userId } }),
  ])

  const existing = await prisma.planDay.findMany({ where: { userId }, select: { dayNumber: true } })
  const used = new Set(existing.map((d) => d.dayNumber))
  let nextNum = 1
  while (used.has(nextNum)) nextNum++

  const planDay = await prisma.planDay.create({
    data: {
      dayNumber: nextNum,
      name: 'Boulder + Strength',
      userId,
      units: {
        create: [
          { trainingUnitId: warmup.id, order: 0 },
          { trainingUnitId: bouldering.id, order: 1 },
          { trainingUnitId: pullups.id, order: 2, targetReps: 25, targetSets: 3 },
          { trainingUnitId: pushups.id, order: 3, targetReps: 35, targetSets: 3 },
        ],
      },
    },
    include: { units: { orderBy: { order: 'asc' } } },
  })

  // 7 sessions, each with per-set data for exercises
  const sessions = [
    { ago: 13, pullSets: [8, 7, 6],   pushSets: [12, 10, 9],  climbs: [0, 0, 1, 1, 2],    rpe: 7, fingers: 4, biceps: 4, shoulders: 5, fatigue: 4 },
    { ago: 11, pullSets: [9, 8, 6],   pushSets: [12, 11, 10], climbs: [0, 1, 1, 2, 2],    rpe: 6, fingers: 3, biceps: 4, shoulders: 4, fatigue: 3 },
    { ago: 9,  pullSets: [10, 9],     pushSets: [13, 12, 11], climbs: [1, 1, 2, 2, 3],    rpe: 8, fingers: 4, biceps: 3, shoulders: 4, fatigue: 4 },
    { ago: 7,  pullSets: [10, 9, 7],  pushSets: [14, 12, 10], climbs: [1, 2, 2, 3, 3],    rpe: 7, fingers: 5, biceps: 4, shoulders: 5, fatigue: 5 },
    { ago: 5,  pullSets: [11, 10, 8], pushSets: [14, 13, 12], climbs: [1, 2, 3, 3, 4],    rpe: 8, fingers: 4, biceps: 4, shoulders: 4, fatigue: 4 },
    { ago: 3,  pullSets: [12, 10, 8], pushSets: [15, 14, 12], climbs: [2, 2, 3, 4, 4],    rpe: 9, fingers: 3, biceps: 3, shoulders: 4, fatigue: 3 },
    { ago: 1,  pullSets: [12, 11, 9], pushSets: [16, 14, 13], climbs: [2, 3, 3, 4, 4, 5], rpe: 7, fingers: 4, biceps: 5, shoulders: 5, fatigue: 4 },
  ]

  for (const s of sessions) {
    const session = await prisma.trainingSession.create({
      data: {
        date: daysAgo(s.ago),
        userId,
        planDayId: planDay.id,
        completedAt: new Date(`${daysAgo(s.ago)}T10:00:00`),
        rpe: s.rpe,
        fingersBefore: s.fingers,
        bicepsBefore: s.biceps,
        shouldersBefore: s.shoulders,
        fatigueBefore: s.fatigue,
      },
    })

    const pullTotal = s.pullSets.reduce((a, b) => a + b, 0)
    const pushTotal = s.pushSets.reduce((a, b) => a + b, 0)

    const [warmupLog, boulderLog, pullLog, pushLog] = await Promise.all([
      prisma.sessionUnitLog.create({ data: { sessionId: session.id, trainingUnitId: warmup.id, planDayUnitId: planDay.units[0].id, completed: true } }),
      prisma.sessionUnitLog.create({ data: { sessionId: session.id, trainingUnitId: bouldering.id, planDayUnitId: planDay.units[1].id, completed: true, gymId: gym.id } }),
      prisma.sessionUnitLog.create({ data: { sessionId: session.id, trainingUnitId: pullups.id, planDayUnitId: planDay.units[2].id, completed: true, repsActual: pullTotal, setsActual: s.pullSets.length } }),
      prisma.sessionUnitLog.create({ data: { sessionId: session.id, trainingUnitId: pushups.id, planDayUnitId: planDay.units[3].id, completed: true, repsActual: pushTotal, setsActual: s.pushSets.length } }),
    ])

    // Per-set data for exercises
    await Promise.all([
      ...s.pullSets.map((reps, i) => prisma.setLog.create({ data: { sessionLogId: pullLog.id, setNumber: i + 1, reps } })),
      ...s.pushSets.map((reps, i) => prisma.setLog.create({ data: { sessionLogId: pushLog.id, setNumber: i + 1, reps } })),
    ])

    // Climb logs
    await prisma.climbLog.createMany({
      data: s.climbs.map((order) => ({
        sessionLogId: boulderLog.id,
        grade: gym.grades[order].localGrade,
        gymGradeOrder: order,
        attempts: 1,
        style: 'redpoint',
      })),
    })
  }

  revalidatePath('/')
  revalidatePath('/history')
  revalidatePath('/today')
}

export async function clearDemoData() {
  const userId = await getUserId()
  await prisma.trainingSession.deleteMany({ where: { userId } })
  await prisma.planDay.deleteMany({ where: { userId } })
  await prisma.trainingUnit.deleteMany({ where: { userId } })
  await prisma.gym.deleteMany({ where: { userId } })
  revalidatePath('/')
  revalidatePath('/history')
  revalidatePath('/today')
  revalidatePath('/plan')
  revalidatePath('/units')
  revalidatePath('/gyms')
}
