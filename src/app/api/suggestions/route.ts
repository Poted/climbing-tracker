import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert climbing and strength coach with deep knowledge of sports science, periodization, and injury prevention for climbing athletes.

Analyze the training data provided and return specific, actionable coaching recommendations for the next training cycle.

RULES:
- Every recommendation must include a concrete intervention: exact sets/reps, duration, frequency, or a named protocol (4x4s, ARC, limit bouldering, antagonist training). Never say "try harder" or "climb more difficult routes".
- Base all advice on well-established sports science and climbing training methodology. Do NOT cite specific papers by author name or year — you may misremember them. Say "research shows" or "it is well established in sports science" instead.
- If a data point is missing or insufficient to draw a conclusion, say so explicitly rather than inventing insights.
- ALWAYS prioritize injury risk warnings. If finger health is low, that takes precedence over performance advice.
- When body state data is not logged, acknowledge that and explain what should be tracked to give better advice.
- Maximum 5 recommendations, ordered by impact.
- Be direct. If the pattern looks bad, say so.

Output ONLY a raw JSON array — no markdown, no code fences, no other text:
[
  {
    "type": "warn" | "good" | "info",
    "icon": "single emoji",
    "title": "5-8 word title",
    "text": "2-4 sentences. Specific protocol or intervention. Grounded in training science."
  }
]`

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
  }>
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

  lines.push('', '=== PRE-SESSION BODY STATE (1 = sore/exhausted, 5 = fresh/healthy) ===')
  if (d.bodyState) {
    lines.push(
      `Fingers: ${f(d.bodyState.fingers)}/5`,
      `Biceps / tendons: ${f(d.bodyState.biceps)}/5`,
      `Shoulders: ${f(d.bodyState.shoulders)}/5`,
      `General fatigue: ${f(d.bodyState.fatigue)}/5`,
    )
  } else {
    lines.push('Not logged — athlete did not track pre-session body state this cycle.')
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
    lines.push('Climbing style: not logged (athlete did not track onsight/redpoint/hangdog per climb).')
  }

  if (d.exercises.length > 0) {
    lines.push('', '=== STRENGTH EXERCISES (total reps: first session → last session) ===')
    for (const e of d.exercises) {
      const sign = e.changePercent >= 0 ? '+' : ''
      lines.push(`  ${e.name}: ${e.firstReps} → ${e.lastReps} reps (${sign}${e.changePercent.toFixed(0)}% over ${e.sessionCount} sessions)`)
    }
  } else {
    lines.push('', '=== STRENGTH EXERCISES ===', 'None logged.')
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
