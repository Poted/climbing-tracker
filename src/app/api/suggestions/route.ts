import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert climbing and strength coach analyzing a training cycle log.

WHAT IS TRACKED IN THIS APP:
- RPE per session (1–10 scale, how hard the session felt)
- Pre-session body state: fingers, biceps/tendons, shoulders, general fatigue (1–5 scale, 1=sore/exhausted, 5=fresh)
- Climbing logs: grade (user's local scale, sorted by difficulty order), style per climb (onsight/flash/redpoint/topRope/attempt), success/fail, attempts count
- Running logs: distance (km), duration (min), pace (min/km)
- Other activities: name and duration (e.g. hangboard, strength training, stretching)
- Session dates (used to compute recovery gaps)

WHAT IS NOT TRACKED AND MUST NEVER BE MENTIONED:
Sleep, nutrition, diet, hydration, bodyweight, stress, work schedule, lifestyle factors.
Do not suggest tracking any of these. Do not speculate about them.

RULES:
1. Comment ONLY on data that is present. If a section says "not logged" or has zero entries, skip it entirely.
2. Give SPECIFIC interventions: named protocols (4×4s, ARC, limit bouldering, max hangs), exact frequency/volume. Never say "try harder" or "push more".
3. Base advice on established sports science. Do NOT cite specific authors or paper years — say "research shows" or "it is well established".
4. Prioritize injury risk above all else. Low body-state scores are the strongest signal.
5. The LAST suggestion must be a concrete structural recommendation for the next cycle — e.g. frequency, volume, focus area, or recovery weeks.

Output ONLY a raw JSON array — no markdown, no code fences, no other text:
[
  {
    "type": "warn" | "good" | "info",
    "icon": "single emoji",
    "title": "5-8 word title",
    "text": "2-4 sentences. Specific and actionable."
  }
]`

interface ClimbingData {
  totalClimbs: number
  gradeRange: { lowest: string; highest: string } | null
  styles: {
    redpoint: number
    flash: number
    onsight: number
    attempt: number
    topRope: number
  }
  successRate: number | null
}

interface RunningData {
  sessionCount: number
  totalKm: number | null
  avgPaceMinPerKm: number | null
}

interface SuggestionRequest {
  cycleName: string
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
  climbing: ClimbingData
  running: RunningData | null
  otherActivities: Array<{
    name: string
    sessionCount: number
    totalMinutes: number | null
  }>
}

function buildPrompt(d: SuggestionRequest): string {
  const f = (n: number | null, dec = 1) => n != null ? n.toFixed(dec) : 'not logged'
  const pct = (n: number) => `${Math.round(n * 100)}%`

  const lines: string[] = [
    `TRAINING CYCLE: ${d.cycleName}${d.dateRange ? ` (${d.dateRange.from} → ${d.dateRange.to})` : ''}`,
    `Sessions completed: ${d.sessionCount}`,
    '',
    '=== INTENSITY ===',
    `Average RPE: ${f(d.avgRpe)}/10`,
  ]

  if (d.rpeFirstHalf != null && d.rpeSecondHalf != null) {
    lines.push(`RPE trend: ${f(d.rpeFirstHalf)} early → ${f(d.rpeSecondHalf)} late cycle`)
  }
  if (d.rpeVariance != null) {
    lines.push(`RPE variance: ${f(d.rpeVariance, 2)} (low = uniform effort, high = wave loading)`)
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
  lines.push(
    `Total sessions: ${d.sessionDensity.totalSessions}`,
    `Sessions with <48h recovery: ${d.sessionDensity.shortGaps}`,
  )
  if (d.sessionDensity.avgGapDays != null) {
    lines.push(`Average days between sessions: ${f(d.sessionDensity.avgGapDays)}`)
  }

  lines.push('', '=== CLIMBING ===')
  if (d.climbing.totalClimbs === 0) {
    lines.push('No climbs logged.')
  } else {
    lines.push(`Total climbs: ${d.climbing.totalClimbs}`)
    if (d.climbing.gradeRange) {
      lines.push(`Grade range (lowest → highest difficulty): ${d.climbing.gradeRange.lowest} → ${d.climbing.gradeRange.highest}`)
    }
    if (d.climbing.successRate != null) {
      lines.push(`Success rate: ${pct(d.climbing.successRate)}`)
    }
    const s = d.climbing.styles
    const total = s.redpoint + s.flash + s.onsight + s.attempt + s.topRope
    if (total > 0) {
      lines.push(`Style breakdown (${total} with style logged):`)
      if (s.onsight > 0) lines.push(`  Onsight:  ${s.onsight}`)
      if (s.flash > 0)   lines.push(`  Flash:    ${s.flash}`)
      if (s.redpoint > 0) lines.push(`  Redpoint: ${s.redpoint}`)
      if (s.topRope > 0) lines.push(`  Top rope: ${s.topRope}`)
      if (s.attempt > 0) lines.push(`  Attempt (fail): ${s.attempt}`)
    } else {
      lines.push('Style: not logged.')
    }
  }

  if (d.running) {
    lines.push('', '=== RUNNING ===')
    lines.push(`Sessions: ${d.running.sessionCount}`)
    if (d.running.totalKm != null) lines.push(`Total distance: ${d.running.totalKm.toFixed(1)} km`)
    if (d.running.avgPaceMinPerKm != null) lines.push(`Avg pace: ${d.running.avgPaceMinPerKm.toFixed(1)} min/km`)
  }

  if (d.otherActivities.length > 0) {
    lines.push('', '=== OTHER ACTIVITIES ===')
    for (const a of d.otherActivities) {
      const durPart = a.totalMinutes != null ? ` — ${a.totalMinutes} min total` : ''
      lines.push(`  ${a.name}: ${a.sessionCount} sessions${durPart}`)
    }
  }

  lines.push('', 'The last of your 5 suggestions must be a specific structural recommendation for the next cycle (frequency, volume, focus area, or deload).')

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
