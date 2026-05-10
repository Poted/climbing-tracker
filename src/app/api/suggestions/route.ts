import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert climbing and strength coach analyzing a training cycle log.

WHAT IS TRACKED IN THIS APP (the only data you have):
- RPE per session (1–10 scale, how hard the session felt)
- Pre-session body state: fingers, biceps/tendons, shoulders, general fatigue (1–5 scale)
- Climbing logs: grade difficulty order, style per climb (onsight/flash/redpoint/hangdog)
- Strength exercise logs: sets, reps, and weight per set (positive kg = added load; negative kg = machine assistance/counterweight)
- Cardio logs: duration (minutes) and distance (km) per session
- Session dates (used to compute recovery gaps)
- The athlete's current training plan (days, units, targets)

WHAT IS NOT TRACKED AND MUST NEVER BE MENTIONED:
Sleep, nutrition, diet, hydration, bodyweight, stress, work schedule, lifestyle factors.
Do not suggest tracking any of these. Do not speculate about them.

RULES:
1. Comment ONLY on data that is present. If a field says "not logged", skip it — do not suggest the athlete start logging it, do not build recommendations around it.
2. Give SPECIFIC interventions: named protocols (4×4s, ARC, limit bouldering), exact sets/reps/duration/frequency. Never say "try harder" or "push more".
3. Base advice on established sports science. Do NOT cite specific authors or paper years — say "research shows" or "it is well established".
4. Prioritize injury risk above all else.
5. Output exactly 5 items. The LAST item must be a concrete change to the athlete's training plan — add, remove, or modify a specific unit, day, or target based on what the data shows.

Output ONLY a raw JSON array — no markdown, no code fences, no other text:
[
  {
    "type": "warn" | "good" | "info",
    "icon": "single emoji",
    "title": "5-8 word title",
    "text": "2-4 sentences. Specific and actionable."
  }
]`

interface PlanUnit {
  name: string
  type: string
  targetSets: number | null
  targetReps: number | null
  timesPerDay: number | null
}

interface PlanDay {
  dayNumber: number
  name: string | null
  units: PlanUnit[]
}

interface SuggestionRequest {
  cycleNumber: number
  sessionCount: number
  dateRange: { from: string; to: string } | null
  avgRpe: number | null
  rpeFirstHalf: number | null
  rpeSecondHalf: number | null
  rpeVariance: number | null
  bodyState: {
    fingers: number | null
    biceps: number | null
    shoulders: number | null
    fatigue: number | null
  } | null
  sessionDensity: {
    totalSessions: number
    shortGaps: number
    avgGapDays: number | null
  }
  climbing: {
    totalClimbs: number
    stylesLogged: number
    hangdog: number
    redpoint: number
    flash: number
    onsight: number
  }
  exercises: Array<{
    name: string
    firstReps: number
    lastReps: number
    changePercent: number
    sessionCount: number
    firstAvgWeightKg: number | null
    lastAvgWeightKg: number | null
  }>
  cardio: Array<{
    name: string
    sessionCount: number
    totalMinutes: number | null
    totalKm: number | null
  }>
  plan: PlanDay[]
}

function buildPrompt(d: SuggestionRequest): string {
  const pct = (n: number, total: number) => `${Math.round(n / total * 100)}%`
  const f = (n: number | null, dec = 1) => n != null ? n.toFixed(dec) : 'not logged'

  const lines: string[] = [
    `TRAINING CYCLE ${d.cycleNumber}${d.dateRange ? ` (${d.dateRange.from} → ${d.dateRange.to})` : ''}`,
    `Sessions completed: ${d.sessionCount}`,
    '',
    '=== INTENSITY ===',
    `Average RPE: ${f(d.avgRpe)}/10`,
  ]

  if (d.rpeFirstHalf != null && d.rpeSecondHalf != null) {
    lines.push(`RPE trend: ${f(d.rpeFirstHalf)} early cycle → ${f(d.rpeSecondHalf)} late cycle`)
  }
  if (d.rpeVariance != null) {
    lines.push(`RPE variance: ${f(d.rpeVariance, 2)} (low = same effort every session, high = wave loading)`)
  }

  lines.push('', '=== PRE-SESSION BODY STATE (1=sore/exhausted, 5=fresh/healthy) ===')
  if (d.bodyState) {
    lines.push(
      `Fingers: ${f(d.bodyState.fingers)}/5`,
      `Biceps / tendons: ${f(d.bodyState.biceps)}/5`,
      `Shoulders: ${f(d.bodyState.shoulders)}/5`,
      `General fatigue: ${f(d.bodyState.fatigue)}/5`,
    )
  } else {
    lines.push('Not logged.')
  }

  lines.push('', '=== SESSION DENSITY ===')
  lines.push(`Sessions with <48h recovery gap: ${d.sessionDensity.shortGaps} of ${d.sessionDensity.totalSessions}`)
  if (d.sessionDensity.avgGapDays != null) {
    lines.push(`Average days between sessions: ${f(d.sessionDensity.avgGapDays)}`)
  }

  lines.push('', '=== CLIMBING ===')
  lines.push(`Total climbs logged: ${d.climbing.totalClimbs}`)
  if (d.climbing.stylesLogged > 0) {
    const s = d.climbing
    lines.push(
      `Style breakdown (${s.stylesLogged} climbs with style logged):`,
      `  Hangdog:  ${s.hangdog} (${pct(s.hangdog, s.stylesLogged)})`,
      `  Redpoint: ${s.redpoint} (${pct(s.redpoint, s.stylesLogged)})`,
      `  Flash:    ${s.flash} (${pct(s.flash, s.stylesLogged)})`,
      `  Onsight:  ${s.onsight} (${pct(s.onsight, s.stylesLogged)})`,
    )
  } else {
    lines.push('Style: not logged.')
  }

  if (d.exercises.length > 0) {
    const fmtW = (w: number | null) => w == null ? 'n/a' : w > 0 ? `+${w.toFixed(1)}kg` : `${w.toFixed(1)}kg`
    lines.push('', '=== STRENGTH EXERCISES (reps and avg weight per set: first → last session) ===')
    for (const e of d.exercises) {
      const sign = e.changePercent >= 0 ? '+' : ''
      const weightPart = (e.firstAvgWeightKg != null || e.lastAvgWeightKg != null)
        ? ` | weight: ${fmtW(e.firstAvgWeightKg)} → ${fmtW(e.lastAvgWeightKg)}`
        : ''
      lines.push(`  ${e.name}: ${e.firstReps} → ${e.lastReps} reps (${sign}${e.changePercent.toFixed(0)}% over ${e.sessionCount} sessions)${weightPart}`)
    }
  } else {
    lines.push('', '=== STRENGTH EXERCISES ===', 'None logged.')
  }

  if (d.cardio.length > 0) {
    lines.push('', '=== CARDIO ===')
    for (const c of d.cardio) {
      const parts: string[] = []
      if (c.totalMinutes != null) parts.push(`${c.totalMinutes} min total`)
      if (c.totalKm != null) parts.push(`${c.totalKm} km total`)
      lines.push(`  ${c.name}: ${c.sessionCount} sessions, ${parts.join(', ')}`)
    }
  }

  if (d.plan.length > 0) {
    lines.push('', '=== CURRENT TRAINING PLAN ===')
    for (const day of d.plan) {
      lines.push(`Day ${day.dayNumber}${day.name ? ` — "${day.name}"` : ''}:`)
      for (const u of day.units) {
        const targets = [
          u.targetSets != null && u.targetReps != null ? `${u.targetSets}×${u.targetReps} reps` : null,
          u.timesPerDay != null && u.timesPerDay > 1 ? `${u.timesPerDay}×/day` : null,
        ].filter(Boolean).join(', ')
        lines.push(`  - ${u.name} (${u.type})${targets ? ` — target: ${targets}` : ''}`)
      }
    }
    lines.push('', 'The last of your 5 suggestions must be a specific change to this plan.')
  } else {
    lines.push('', '=== TRAINING PLAN ===', 'No plan configured.')
  }

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  const data: SuggestionRequest = await req.json()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(data) }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) {
    return NextResponse.json({ error: 'Malformed model response' }, { status: 500 })
  }

  const suggestions = JSON.parse(match[0])
  return NextResponse.json({ suggestions })
}
