'use client'

import { useState, useTransition } from 'react'
import {
  addActivityToDate, deleteActivity,
  updateSessionPreState, completeSession, updateSessionRPE,
  ensureSessionForDate, deleteTrainingSession, startCycle,
} from '@/lib/actions'
import {
  X, Plus, Mountain, ChevronLeft, ChevronRight,
  CheckCircle2, Trash2, Timer, Ruler, Dumbbell,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format, addDays, parseISO } from 'date-fns'
import { enUS } from 'date-fns/locale'

// ── Types ────────────────────────────────────────────────────────────

type GradeMapping = { id: string; localGrade: string; order: number }
type Gym = { id: string; name: string; type: string; grades: GradeMapping[] }

type Activity = {
  id: string
  type: string
  climbingType: string | null
  grade: string | null
  gymGradeOrder: number | null
  attempts: number | null
  success: boolean | null
  style: string | null
  distanceKm: number | null
  pace: number | null
  durationMin: number | null
  gymId: string | null
  name: string | null
  data: string | null
  notes: string | null
  gym: Gym | null
}

type Session = {
  id: string
  date: string
  completedAt: Date | null
  rpe: number | null
  fingersBefore: number | null
  bicepsBefore: number | null
  shouldersBefore: number | null
  fatigueBefore: number | null
  activities: Activity[]
}

type Cycle = { id: string; name: string | null; startDate: string; status: string }

export type Props = {
  date: string
  today: string
  initialSession: Session | null
  gyms: Gym[]
  currentCycle: Cycle | null
}

// ── Constants ─────────────────────────────────────────────────────────

const CLIMB_STYLES = ['redpoint', 'flash', 'onsight', 'topRope', 'attempt'] as const

const ACTIVITY_CHIPS: { name: string; category: 'climbing' | 'running' | 'other' }[] = [
  { name: 'Wspinaczka', category: 'climbing' },
  { name: 'Bouldering', category: 'climbing' },
  { name: 'Bieganie', category: 'running' },
  { name: 'Chwytotablica', category: 'other' },
  { name: 'Siła', category: 'other' },
  { name: 'Rozgrzewka', category: 'other' },
  { name: 'Sauna', category: 'other' },
  { name: 'Pływanie', category: 'other' },
  { name: 'No-hangs', category: 'other' },
  { name: 'Stretching', category: 'other' },
]

const EMPTY_PRE_STATE = {
  fingersBefore: null, bicepsBefore: null, shouldersBefore: null, fatigueBefore: null,
} as const

// ── Helpers ───────────────────────────────────────────────────────────

function getCategory(name: string): 'climbing' | 'running' | 'other' {
  const lower = name.toLowerCase()
  if (['wspinaczka', 'bouldering', 'roped', 'sport', 'climbing'].some((c) => lower.includes(c))) return 'climbing'
  if (['bieganie', 'running'].some((c) => lower.includes(c))) return 'running'
  return 'other'
}

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60); const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function parseData(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

// ── Activity card ─────────────────────────────────────────────────────

function ActivityCard({ activity, onRemove }: {
  activity: Activity
  onRemove: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteActivity(activity.id)
      onRemove(activity.id)
    })
  }

  const data = parseData(activity.data)
  let icon = <Dumbbell size={14} className="text-slate-400" />
  let headline = ''
  let subtitle = ''

  if (activity.type === 'climbing') {
    icon = <Mountain size={14} className="text-emerald-400" />
    headline = activity.grade ?? '—'
    const parts: string[] = []
    if (activity.style) parts.push(activity.style)
    if ((activity.attempts ?? 1) > 1) parts.push(`${activity.attempts}×`)
    if (activity.climbingType) parts.push(activity.climbingType)
    if (activity.gym) parts.push(activity.gym.name)
    subtitle = parts.join(' · ')
  } else if (activity.type === 'running') {
    icon = <Ruler size={14} className="text-blue-400" />
    headline = activity.distanceKm ? `${activity.distanceKm} km` : 'Run'
    const parts: string[] = []
    if (activity.durationMin) parts.push(fmtDuration(activity.durationMin))
    if (activity.pace) parts.push(`${activity.pace.toFixed(1)} min/km`)
    if (activity.notes) parts.push(activity.notes)
    subtitle = parts.join(' · ')
  } else {
    headline = activity.name ?? 'Other'
    const parts: string[] = []
    if (activity.durationMin) parts.push(fmtDuration(activity.durationMin))
    if (data.weight_kg) parts.push(`${data.weight_kg} kg`)
    if (data.edge_mm) parts.push(`${data.edge_mm}mm`)
    if (activity.notes) parts.push(activity.notes as string)
    subtitle = parts.join(' · ')
  }

  return (
    <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{headline}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
      </div>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="p-1.5 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── Unified Add Activity Sheet ────────────────────────────────────────

function AddActivitySheet({ date, gyms, onAdded, onClose }: {
  date: string
  gyms: Gym[]
  onAdded: (sessionId: string, activity: Activity) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [gymId, setGymId] = useState(gyms[0]?.id ?? '')
  const [climbingType, setClimbingType] = useState<'bouldering' | 'roped'>('bouldering')
  const [showManual, setShowManual] = useState(false)
  const [grade, setGrade] = useState('')
  const [style, setStyle] = useState('redpoint')
  const [attempts, setAttempts] = useState('1')
  const [success, setSuccess] = useState(true)
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [edgeMm, setEdgeMm] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const category = name.trim() ? getCategory(name.trim()) : null
  const activeGym = gyms.find((g) => g.id === gymId) ?? null
  const isHangboard = ['chwytotablica', 'hangboard'].includes(name.toLowerCase().trim())

  function selectChip(chipName: string) {
    setName(chipName)
    setShowManual(false)
    setGrade('')
    setNotes('')
  }

  function quickClimbAdd(g: GradeMapping) {
    startTransition(async () => {
      const result = await addActivityToDate({
        date, type: 'climbing', climbingType,
        grade: g.localGrade, gymGradeOrder: g.order,
        gymId: gymId || undefined, attempts: 1, style: 'redpoint',
      })
      onAdded(result.sessionId, result.activity as Activity)
      // keep sheet open for rapid climb logging
    })
  }

  function manualClimbAdd() {
    if (!grade.trim()) return
    startTransition(async () => {
      const result = await addActivityToDate({
        date, type: 'climbing', climbingType,
        grade: grade.trim(), gymId: gymId || undefined,
        style, attempts: Number(attempts) || 1,
        success, notes: notes || undefined,
      })
      onAdded(result.sessionId, result.activity as Activity)
      setGrade('')
      setNotes('')
    })
  }

  function addRunning() {
    if (!distance && !duration) return
    startTransition(async () => {
      const distanceKm = distance ? parseFloat(distance) : undefined
      const durationMin = duration ? parseInt(duration) : undefined
      const pace = distanceKm && durationMin ? durationMin / distanceKm : undefined
      const result = await addActivityToDate({
        date, type: 'running',
        distanceKm, durationMin, pace,
        notes: notes || undefined,
      })
      onAdded(result.sessionId, result.activity as Activity)
      onClose()
    })
  }

  function addOther() {
    if (!name.trim()) return
    const dataObj: Record<string, unknown> = {}
    if (weightKg) dataObj.weight_kg = parseFloat(weightKg)
    if (edgeMm) dataObj.edge_mm = parseInt(edgeMm)
    startTransition(async () => {
      const result = await addActivityToDate({
        date, type: 'other',
        name: name.trim(),
        durationMin: duration ? parseInt(duration) : undefined,
        data: Object.keys(dataObj).length > 0 ? JSON.stringify(dataObj) : undefined,
        notes: notes || undefined,
      })
      onAdded(result.sessionId, result.activity as Activity)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-60 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-slate-900 border-t border-slate-700 rounded-t-2xl p-4 pb-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-sm">Add activity</p>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Name chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {ACTIVITY_CHIPS.map(({ name: chipName, category: chipCat }) => (
            <button
              key={chipName}
              onClick={() => selectChip(chipName)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                name === chipName
                  ? chipCat === 'climbing'
                    ? 'bg-emerald-700 border-emerald-600 text-white'
                    : chipCat === 'running'
                    ? 'bg-blue-700 border-blue-600 text-white'
                    : 'bg-slate-600 border-slate-500 text-white'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {chipName}
            </button>
          ))}
        </div>

        {/* Free text name input */}
        <input
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 mb-4"
          placeholder="Or type activity name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Climbing form */}
        {category === 'climbing' && (
          <>
            <div className="flex gap-2 mb-4">
              {(['bouldering', 'roped'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setClimbingType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    climbingType === t
                      ? 'bg-emerald-700 border-emerald-600 text-white'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {t === 'bouldering' ? 'Bouldering' : 'Roped'}
                </button>
              ))}
            </div>

            {gyms.length > 0 && (
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-emerald-500"
                value={gymId}
                onChange={(e) => setGymId(e.target.value)}
              >
                <option value="">— no gym / outdoor —</option>
                {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}

            {activeGym && activeGym.grades.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs text-slate-500">Tap to log (redpoint, 1 attempt)</p>
                <div className="flex flex-wrap gap-2">
                  {activeGym.grades.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => quickClimbAdd(g)}
                      disabled={isPending}
                      className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 hover:border-emerald-500 hover:text-emerald-300 bg-slate-800 transition-all disabled:opacity-50"
                    >
                      {g.localGrade}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!showManual ? (
              <button
                onClick={() => setShowManual(true)}
                className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
              >
                <Plus size={13} className="inline mr-1" />Enter details manually
              </button>
            ) : (
              <div className="space-y-3 border-t border-slate-700 pt-3">
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="Grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    autoFocus
                  />
                  <input
                    className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    type="number" min="1"
                    placeholder="tries"
                    value={attempts}
                    onChange={(e) => setAttempts(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                  >
                    {CLIMB_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    onClick={() => setSuccess((v) => !v)}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                      success ? 'bg-emerald-700 border-emerald-600 text-white' : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    {success ? '✓ Done' : '✗ Fail'}
                  </button>
                </div>
                <textarea
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"
                  placeholder="Notes (optional)"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <button
                  onClick={manualClimbAdd}
                  disabled={isPending || !grade.trim()}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Add climb
                </button>
              </div>
            )}
          </>
        )}

        {/* Running form */}
        {category === 'running' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  <Ruler size={11} className="inline mr-1" />Distance (km)
                </label>
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  type="number" step="0.1" min="0"
                  placeholder="0.0"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  <Timer size={11} className="inline mr-1" />Duration (min)
                </label>
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  type="number" step="1" min="0"
                  placeholder="0"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"
              placeholder="Notes (optional)"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button
              onClick={addRunning}
              disabled={isPending || (!distance && !duration)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Add run
            </button>
          </div>
        )}

        {/* Other form */}
        {category === 'other' && (
          <div className="space-y-3">
            {isHangboard && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Weight (kg)</label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    type="number" step="0.5"
                    placeholder="e.g. 5"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Edge (mm)</label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    type="number" step="1"
                    placeholder="e.g. 20"
                    value={edgeMm}
                    onChange={(e) => setEdgeMm(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-slate-500 block mb-1">
                <Timer size={11} className="inline mr-1" />Duration (min, optional)
              </label>
              <input
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                type="number" step="1" min="0"
                placeholder="—"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"
              placeholder="Notes (optional)"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button
              onClick={addOther}
              disabled={isPending}
              className="w-full py-2.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Add activity
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pre-session state ─────────────────────────────────────────────────

type PreStateKey = 'fingersBefore' | 'bicepsBefore' | 'shouldersBefore' | 'fatigueBefore'

const PRE_STATE_ROWS: { key: PreStateKey; label: string }[] = [
  { key: 'fingersBefore', label: 'Fingers' },
  { key: 'bicepsBefore', label: 'Biceps / tendons' },
  { key: 'shouldersBefore', label: 'Shoulders' },
  { key: 'fatigueBefore', label: 'General fatigue' },
]

function PreSessionForm({ values, onUpdate, isToday }: {
  values: Pick<Session, 'fingersBefore' | 'bicepsBefore' | 'shouldersBefore' | 'fatigueBefore'>
  onUpdate: (key: PreStateKey, value: number) => void
  isToday: boolean
}) {
  const filledCount = PRE_STATE_ROWS.filter((r) => values[r.key] != null).length
  const [expanded, setExpanded] = useState(filledCount === 0)

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5"
      >
        <span className="text-xs font-medium text-slate-300">
          {isToday ? 'How do you feel today?' : 'How did you feel that day?'}
        </span>
        <span className="text-xs text-slate-500">
          {filledCount > 0 ? `${filledCount}/4` : 'optional'}
          <span className="ml-2 text-slate-600">{expanded ? '▲' : '▼'}</span>
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-2 border-t border-slate-700/50 space-y-2.5">
          {PRE_STATE_ROWS.map(({ key, label }) => {
            const val = values[key]
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-32 shrink-0">{label}</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => onUpdate(key, n)}
                      className={`w-7 h-7 rounded-full text-xs font-semibold border transition-all ${
                        val === n
                          ? n <= 2
                            ? 'bg-red-500 border-red-400 text-white'
                            : n === 3
                            ? 'bg-yellow-500 border-yellow-400 text-black'
                            : 'bg-emerald-500 border-emerald-400 text-white'
                          : 'border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <p className="text-xs text-slate-600 pt-1">1 = sore / exhausted · 5 = fresh</p>
        </div>
      )}
    </div>
  )
}

// ── RPE selector ──────────────────────────────────────────────────────

function RPESelector({ onSelect }: { onSelect: (rpe: number) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-slate-400">How hard was today? (RPE 1–10)</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              n <= 4
                ? 'border-emerald-800 text-emerald-400 hover:bg-emerald-900/40'
                : n <= 7
                ? 'border-yellow-800 text-yellow-400 hover:bg-yellow-900/40'
                : 'border-red-800 text-red-400 hover:bg-red-900/40'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-600">1 = very easy · 10 = maximum effort</p>
    </div>
  )
}

// ── Page root ─────────────────────────────────────────────────────────

export default function TodayClient({ date, today, initialSession, gyms, currentCycle }: Props) {
  const [session, setSession] = useState<Session | null>(initialSession)
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isToday = date === today
  const isFuture = date > today
  const isCompleted = !!session?.completedAt
  const activities = session?.activities ?? []

  function go(delta: number) {
    const next = format(addDays(parseISO(date), delta), 'yyyy-MM-dd')
    router.push(`/today?date=${next}`)
  }

  const dateLabel = isToday
    ? 'Today'
    : date === format(addDays(parseISO(today), -1), 'yyyy-MM-dd')
    ? 'Yesterday'
    : null

  function handleActivityAdded(sessionId: string, activity: Activity) {
    setSession((prev) => {
      if (prev) return { ...prev, activities: [...prev.activities, activity] }
      return {
        id: sessionId, date, completedAt: null, rpe: null,
        ...EMPTY_PRE_STATE, activities: [activity],
      }
    })
  }

  function handleActivityRemoved(id: string) {
    setSession((prev) => prev
      ? { ...prev, activities: prev.activities.filter((a) => a.id !== id) }
      : prev)
  }

  function handlePreStateUpdate(key: PreStateKey, value: number) {
    startTransition(async () => {
      let sid = session?.id
      if (!sid) {
        sid = await ensureSessionForDate(date)
        setSession((prev) => prev ?? {
          id: sid!, date, completedAt: null, rpe: null,
          ...EMPTY_PRE_STATE, activities: [],
        })
      }
      await updateSessionPreState(sid, { [key]: value })
      setSession((prev) => prev ? { ...prev, [key]: value } : prev)
    })
  }

  function handleComplete() {
    if (!session) return
    startTransition(async () => {
      const s = await completeSession(session.id)
      setSession({ ...session, completedAt: s.completedAt })
    })
  }

  function handleRPE(rpe: number) {
    if (!session) return
    startTransition(async () => {
      await updateSessionRPE(session.id, rpe)
      setSession({ ...session, rpe })
    })
  }

  function handleStartCycle() {
    startTransition(async () => {
      await startCycle()
      router.refresh()
    })
  }

  function handleDeleteSession() {
    if (!session || !confirm('Delete all training for this day?')) return
    startTransition(async () => {
      await deleteTrainingSession(session.id)
      setSession(null)
    })
  }

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center gap-2 -mt-1">
        <button
          onClick={() => go(-1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold">{dateLabel ?? date}</h1>
          <p className="text-xs text-slate-500">
            {format(parseISO(date), 'EEEE, MMMM d, yyyy', { locale: enUS })}
          </p>
        </div>
        <button
          onClick={() => go(1)}
          disabled={isToday}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-20 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Cycle indicator / start prompt */}
      {currentCycle ? (
        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-2.5">
          <div>
            <p className="text-xs text-slate-500">Active cycle</p>
            <p className="text-sm font-medium">
              {currentCycle.name ?? `Started ${currentCycle.startDate}`}
            </p>
          </div>
          <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
      ) : (
        <button
          onClick={handleStartCycle}
          disabled={isPending}
          className="w-full flex items-center justify-between bg-slate-800/40 border border-dashed border-slate-600 hover:border-emerald-700 hover:bg-emerald-900/10 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
        >
          <div className="text-left">
            <p className="text-xs text-slate-500">No active cycle</p>
            <p className="text-sm font-medium text-slate-300">Start new cycle</p>
          </div>
          <span className="text-xs text-slate-500">+</span>
        </button>
      )}

      {/* Pre-session state */}
      {(isToday || session) && !isFuture && (
        <PreSessionForm
          values={session ?? EMPTY_PRE_STATE}
          onUpdate={handlePreStateUpdate}
          isToday={isToday}
        />
      )}

      {/* Session header */}
      {session && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteSession}
              disabled={isPending}
              title="Delete day"
              className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
            {isCompleted ? (
              <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
                <CheckCircle2 size={16} />
                <span>Done!</span>
                {session.rpe != null && (
                  <span className="text-slate-400 text-xs">RPE {session.rpe}/10</span>
                )}
              </div>
            ) : (
              <button
                onClick={handleComplete}
                disabled={isPending || activities.length === 0}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
              >
                <CheckCircle2 size={15} /> Finish day
              </button>
            )}
          </div>
        </div>
      )}

      {/* RPE after completion */}
      {isCompleted && session?.rpe == null && <RPESelector onSelect={handleRPE} />}

      {/* Activity list */}
      {activities.map((a) => (
        <ActivityCard key={a.id} activity={a} onRemove={handleActivityRemoved} />
      ))}

      {/* Empty state for past days */}
      {!session && !isFuture && !isToday && (
        <p className="text-center text-slate-500 text-sm py-4">
          No training recorded for this day.
        </p>
      )}

      {/* Add activity button */}
      {!isFuture && !isCompleted && (
        <button
          onClick={() => setShowAddActivity(true)}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-colors text-sm disabled:opacity-50"
        >
          <Plus size={16} />
          Add activity
        </button>
      )}

      {/* Sheet */}
      {showAddActivity && (
        <AddActivitySheet
          date={date}
          gyms={gyms}
          onAdded={handleActivityAdded}
          onClose={() => setShowAddActivity(false)}
        />
      )}
    </div>
  )
}
