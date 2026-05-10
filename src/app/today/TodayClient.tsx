'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import {
  updateSessionUnitLog, completeSession, addClimbLog, deleteClimbLog,
  deleteTrainingSession, addUnitLogToDate, removeUnitLog, addSetLog, deleteSetLog,
  updateSessionPreState, updateSessionRPE, ensureSessionForDate,
} from '@/lib/actions'
import {
  Check, X, Plus, Mountain, ChevronDown, ChevronUp, CheckCircle2, Trash2,
  Timer, Ruler, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, addDays, parseISO } from 'date-fns'
import { enUS } from 'date-fns/locale'

// ── Types ────────────────────────────────────────────────────────────

type GradeMapping = { id: string; localGrade: string; order: number }
type Gym = { id: string; name: string; type: string; grades: GradeMapping[] }

type ClimbLog = {
  id: string; grade: string; gymGradeOrder: number | null
  wallColor: string | null; attempts: number; style: string; notes: string | null
}

type SetLog = { id: string; setNumber: number; reps: number; weightKg: number | null }

type TrainingUnit = { id: string; name: string; type: string }

type UnitLog = {
  id: string
  completed: boolean
  repsActual: number | null
  setsActual: number | null
  durationSec: number | null
  distanceM: number | null
  gymId: string | null
  trainingUnit: TrainingUnit
  planDayUnit: { targetReps: number | null; targetSets: number | null } | null
  climbLogs: ClimbLog[]
  setLogs: SetLog[]
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
  planDay: { id: string; dayNumber: number; name: string | null } | null
  unitLogs: UnitLog[]
}

type PlanDay = {
  id: string
  dayNumber: number
  name: string | null
  units: { id: string; trainingUnitId: string; trainingUnit: { name: string; type: string } }[]
}

type PrevLog = {
  repsActual: number | null
  setsActual: number | null
  setLogs: { setNumber: number; reps: number; weightKg: number | null }[]
  climbLogs: { grade: string; gymGradeOrder: number | null }[]
}

type Props = {
  date: string
  today: string
  initialSession: Session | null
  suggestedPlanDay: PlanDay | null
  allUnits: TrainingUnit[]
  gyms: Gym[]
  prevData: Record<string, PrevLog>
  currentCycleNumber: number
  completedCycleNumber: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60); const s = sec % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}
function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

const UNIT_TYPE_ORDER = ['climbing', 'exercise', 'hangboard', 'cardio', 'stretching']
const CLIMB_STYLES = ['redpoint', 'flash', 'onsight', 'hangdog', 'project']

// ── Grade buttons ─────────────────────────────────────────────────────

function ClimbButtons({ sessionLogId, gym, onAdded }: {
  sessionLogId: string; gym: Gym; onAdded: (l: ClimbLog) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [lastId, setLastId] = useState<string | null>(null)

  function tap(g: GradeMapping) {
    setLastId(g.id)
    startTransition(async () => {
      const log = await addClimbLog({ sessionLogId, grade: g.localGrade, gymGradeOrder: g.order, attempts: 1, style: 'redpoint' })
      onAdded(log)
      setLastId(null)
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {gym.grades.map((g) => (
        <button
          key={g.id} onClick={() => tap(g)} disabled={isPending}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-50 ${
            lastId === g.id ? 'bg-emerald-600 border-emerald-500 text-white scale-95' : 'bg-slate-900 border-slate-700 hover:border-emerald-500 hover:text-emerald-300'
          }`}
        >
          {g.localGrade}
        </button>
      ))}
    </div>
  )
}

// ── Manual climb form ─────────────────────────────────────────────────

function ClimbLogForm({ sessionLogId, onAdded, onCancel }: {
  sessionLogId: string; onAdded: (l: ClimbLog) => void; onCancel: () => void
}) {
  const [grade, setGrade] = useState('')
  const [attempts, setAttempts] = useState('1')
  const [style, setStyle] = useState('redpoint')
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    if (!grade.trim()) return
    startTransition(async () => {
      const log = await addClimbLog({ sessionLogId, grade: grade.trim(), attempts: Number(attempts) || 1, style })
      onAdded(log)
    })
  }

  return (
    <div className="bg-slate-950 rounded-lg p-3 space-y-2 border border-slate-700">
      <div className="flex gap-2">
        <input className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500" placeholder="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} autoFocus />
        <input className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500" placeholder="tries" type="number" min="1" value={attempts} onChange={(e) => setAttempts(e.target.value)} />
        <select className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500" value={style} onChange={(e) => setStyle(e.target.value)}>
          {CLIMB_STYLES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={isPending || !grade.trim()} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition-colors"><Check size={13} /> Save</button>
        <button onClick={onCancel} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded transition-colors"><X size={13} /> Cancel</button>
      </div>
    </div>
  )
}

// ── Set logging for exercises ─────────────────────────────────────────

function fmtWeight(w: number | null | undefined) {
  if (w == null || w === 0) return ''
  return w > 0 ? ` +${w}kg` : ` ${w}kg`
}

function SetList({ log, prev, onUpdate }: {
  log: UnitLog
  prev: PrevLog | null
  onUpdate: (u: UnitLog) => void
}) {
  const [addingReps, setAddingReps] = useState('')
  const [addingWeight, setAddingWeight] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  function openAdd() {
    const lastSet = log.setLogs.at(-1)
    const prevFirstSet = prev?.setLogs.at(0)
    setAddingReps(String(lastSet?.reps ?? prevFirstSet?.reps ?? ''))
    const w = lastSet?.weightKg ?? prevFirstSet?.weightKg ?? null
    setAddingWeight(w != null ? String(w) : '')
    setShowInput(true)
  }

  function saveSet() {
    const r = parseInt(addingReps)
    if (!r || r <= 0) return
    const w = addingWeight !== '' ? parseFloat(addingWeight) : undefined
    startTransition(async () => {
      const set = await addSetLog({ sessionLogId: log.id, reps: r, weightKg: w })
      const newSetLogs = [...log.setLogs, set]
      const totalReps = newSetLogs.reduce((s, x) => s + x.reps, 0)
      onUpdate({ ...log, setLogs: newSetLogs, repsActual: totalReps, setsActual: newSetLogs.length, completed: true })
      setAddingReps('')
      setShowInput(false)
    })
  }

  function removeSet(id: string) {
    startTransition(async () => {
      await deleteSetLog(id)
      const newSetLogs = log.setLogs.filter((s) => s.id !== id).map((s, i) => ({ ...s, setNumber: i + 1 }))
      const totalReps = newSetLogs.reduce((s, x) => s + x.reps, 0)
      onUpdate({ ...log, setLogs: newSetLogs, repsActual: newSetLogs.length > 0 ? totalReps : null, setsActual: newSetLogs.length > 0 ? newSetLogs.length : null })
    })
  }

  const totalReps = log.setLogs.reduce((s, x) => s + x.reps, 0)
  const prevTotal = prev ? (prev.setLogs.length > 0 ? prev.setLogs.reduce((s, x) => s + x.reps, 0) : prev.repsActual) : null
  const prevSets = prev ? (prev.setLogs.length > 0 ? prev.setLogs.length : prev.setsActual) : null

  // Show weight in "Last time" — per set if mixed, single suffix if all same
  const prevSetLabel = () => {
    if (!prev || prev.setLogs.length === 0) return null
    const weights = prev.setLogs.map((s) => s.weightKg)
    const allSame = weights.every((w) => w === weights[0])
    if (allSame) {
      return prev.setLogs.map((s) => s.reps).join(' · ') + ` = ${prevTotal} reps` + fmtWeight(weights[0])
    }
    return prev.setLogs.map((s) => `${s.reps}${fmtWeight(s.weightKg)}`).join(' · ')
  }

  return (
    <div className="space-y-2">
      {prev && (prevTotal || prevSets) && (
        <p className="text-xs text-slate-500">
          Last time: {prev.setLogs.length > 0
            ? prevSetLabel()
            : `${prevTotal} reps · ${prevSets} sets`}
        </p>
      )}

      {log.setLogs.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-10">Set {s.setNumber}</span>
          <span className="text-sm font-medium">{s.reps} reps</span>
          {s.weightKg != null && s.weightKg !== 0 && (
            <span className={`text-xs font-medium ${s.weightKg > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {fmtWeight(s.weightKg)}
            </span>
          )}
          <button onClick={() => removeSet(s.id)} disabled={isPending} className="ml-auto p-1 text-slate-600 hover:text-red-400">
            <X size={13} />
          </button>
        </div>
      ))}

      {log.setLogs.length > 0 && (
        <p className="text-xs text-slate-400 font-medium">
          Total: {totalReps} reps · {log.setLogs.length} sets
          {prevTotal != null && totalReps > prevTotal && (
            <span className="text-emerald-400 ml-2">↑ {totalReps - prevTotal} vs last time</span>
          )}
          {prevTotal != null && totalReps < prevTotal && (
            <span className="text-yellow-500 ml-2">↓ {prevTotal - totalReps} vs last time</span>
          )}
        </p>
      )}

      {showInput ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 w-10">Set {log.setLogs.length + 1}</span>
          <input
            ref={inputRef}
            type="number" min="1"
            value={addingReps}
            onChange={(e) => setAddingReps(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveSet(); if (e.key === 'Escape') setShowInput(false) }}
            className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
            placeholder="reps"
          />
          <input
            type="number" step="0.5"
            value={addingWeight}
            onChange={(e) => setAddingWeight(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveSet(); if (e.key === 'Escape') setShowInput(false) }}
            className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
            placeholder="kg (opt)"
          />
          <button onClick={saveSet} disabled={isPending || !addingReps} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded">
            <Check size={13} />
          </button>
          <button onClick={() => setShowInput(false)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300">
            <X size={13} />
          </button>
        </div>
      ) : (
        <button onClick={openAdd} disabled={isPending} className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-400 transition-colors">
          <Plus size={13} /> Add set
        </button>
      )}
    </div>
  )
}

// ── Cardio form ───────────────────────────────────────────────────────

function CardioForm({ log, onSaved }: { log: UnitLog; onSaved: (dSec: number | null, dM: number | null) => void }) {
  const [minutes, setMinutes] = useState(log.durationSec ? String(Math.round(log.durationSec / 60)) : '')
  const [km, setKm] = useState(log.distanceM ? String((log.distanceM / 1000).toFixed(1)) : '')
  const [isPending, startTransition] = useTransition()

  function save() {
    const dSec = minutes ? Math.round(parseFloat(minutes) * 60) : null
    const dM = km ? parseFloat(km) * 1000 : null
    startTransition(async () => {
      await updateSessionUnitLog(log.id, { durationSec: dSec ?? undefined, distanceM: dM ?? undefined, completed: true })
      onSaved(dSec, dM)
    })
  }

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="text-xs text-slate-500 block mb-1"><Timer size={11} className="inline mr-1" />Minutes</label>
        <input className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500" type="number" min="0" step="1" placeholder="—" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </div>
      <div className="flex-1">
        <label className="text-xs text-slate-500 block mb-1"><Ruler size={11} className="inline mr-1" />km</label>
        <input className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500" type="number" min="0" step="0.1" placeholder="—" value={km} onChange={(e) => setKm(e.target.value)} />
      </div>
      <button onClick={save} disabled={isPending} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded h-[34px]"><Check size={13} /></button>
    </div>
  )
}

// ── Unit log card ─────────────────────────────────────────────────────

function UnitLogCard({ log, gyms, prev, onUpdate, onRemove }: {
  log: UnitLog; gyms: Gym[]; prev: PrevLog | null
  onUpdate: (u: UnitLog) => void; onRemove: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [addingClimb, setAddingClimb] = useState(false)
  const [isPending, startTransition] = useTransition()

  const unit = log.trainingUnit
  const isClimbing = unit.type === 'climbing'
  const isHangboard = unit.type === 'hangboard'
  const isCardio = unit.type === 'cardio'
  const isStretching = unit.type === 'stretching'
  const isExercise = !isClimbing && !isHangboard && !isCardio && !isStretching
  const activeGym = log.gym ?? gyms.find((g) => g.id === log.gymId) ?? null

  function toggleCompleted() {
    startTransition(async () => {
      const updated = await updateSessionUnitLog(log.id, { completed: !log.completed })
      onUpdate({ ...log, ...updated, climbLogs: log.climbLogs, gym: log.gym, setLogs: log.setLogs, trainingUnit: log.trainingUnit, planDayUnit: log.planDayUnit })
    })
  }

  function selectGym(gymId: string) {
    const gym = gyms.find((g) => g.id === gymId) ?? null
    startTransition(async () => {
      await updateSessionUnitLog(log.id, { gymId: gymId || undefined })
      onUpdate({ ...log, gymId: gymId || null, gym })
    })
  }

  function handleClimbAdded(climb: ClimbLog) {
    onUpdate({ ...log, climbLogs: [...log.climbLogs, climb], completed: true })
    setAddingClimb(false)
  }

  function removeClimb(id: string) {
    startTransition(async () => {
      await deleteClimbLog(id)
      onUpdate({ ...log, climbLogs: log.climbLogs.filter((c) => c.id !== id) })
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await removeUnitLog(log.id)
      onRemove(log.id)
    })
  }

  // subtitle in collapsed view
  let subtitle: string | null = null
  if (isClimbing && log.climbLogs.length > 0) subtitle = `${log.climbLogs.length} climbs`
  else if ((isExercise || isHangboard) && log.repsActual) subtitle = `${log.repsActual} reps · ${log.setsActual ?? '?'} sets`
  else if (isCardio && (log.durationSec || log.distanceM)) {
    const parts: string[] = []
    if (log.durationSec) parts.push(formatDuration(log.durationSec))
    if (log.distanceM) parts.push(formatDistance(log.distanceM))
    subtitle = parts.join(' · ')
  }

  return (
    <div className={`rounded-xl border transition-colors ${log.completed ? 'bg-slate-800 border-emerald-800' : 'bg-slate-800 border-slate-700'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {!isStretching ? (
          <button onClick={toggleCompleted} disabled={isPending} className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${log.completed ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-600 hover:border-emerald-500'}`}>
            {log.completed && <Check size={13} />}
          </button>
        ) : (
          <button onClick={toggleCompleted} disabled={isPending} className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${log.completed ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-600 hover:border-emerald-500'}`}>
            {log.completed && <Check size={13} />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${log.completed ? 'text-slate-300' : 'text-white'}`}>{unit.name}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {!isStretching && (
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
        <button onClick={handleDelete} disabled={isPending} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && !isStretching && (
        <div className="px-4 pb-3 space-y-3 border-t border-slate-700 pt-3">

          {/* Climbing */}
          {isClimbing && (
            <div className="space-y-2">
              {gyms.length > 0 && (
                <select className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500" value={log.gymId ?? ''} onChange={(e) => selectGym(e.target.value)}>
                  <option value="">— select gym (optional) —</option>
                  {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
              {activeGym && activeGym.grades.length > 0 && (
                <ClimbButtons sessionLogId={log.id} gym={activeGym} onAdded={handleClimbAdded} />
              )}
              {prev && prev.climbLogs.length > 0 && (
                <p className="text-xs text-slate-600">Last time: {prev.climbLogs.length} climbs · {prev.climbLogs.slice(0, 6).map((c) => c.grade).join(', ')}{prev.climbLogs.length > 6 ? '…' : ''}</p>
              )}
              {log.climbLogs.map((c) => (
                <div key={c.id} className="flex items-center gap-2 bg-slate-900 rounded px-3 py-1.5">
                  <Mountain size={13} className="text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium">{c.grade}</span>
                  <span className="text-xs text-slate-500">· {c.style}</span>
                  {c.attempts > 1 && <span className="text-xs text-slate-500">· {c.attempts}×</span>}
                  <button onClick={() => removeClimb(c.id)} disabled={isPending} className="ml-auto p-1 text-slate-600 hover:text-red-400"><X size={12} /></button>
                </div>
              ))}
              {addingClimb ? (
                <ClimbLogForm sessionLogId={log.id} onAdded={(c) => { handleClimbAdded(c); setAddingClimb(false) }} onCancel={() => setAddingClimb(false)} />
              ) : (
                <button onClick={() => setAddingClimb(true)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-400 transition-colors">
                  <Plus size={13} /> Enter grade manually
                </button>
              )}
            </div>
          )}

          {/* Exercise / Hangboard */}
          {(isExercise || isHangboard) && (
            <SetList log={log} prev={prev} onUpdate={onUpdate} />
          )}

          {/* Cardio */}
          {isCardio && (
            <CardioForm log={log} onSaved={(dSec, dM) => onUpdate({ ...log, durationSec: dSec, distanceM: dM, completed: true })} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Pre-session state form ────────────────────────────────────────────

type PreStateKey = 'fingersBefore' | 'bicepsBefore' | 'shouldersBefore' | 'fatigueBefore'

const PRE_STATE_ROWS: { key: PreStateKey; label: string }[] = [
  { key: 'fingersBefore', label: 'Fingers' },
  { key: 'bicepsBefore', label: 'Biceps / tendons' },
  { key: 'shouldersBefore', label: 'Shoulders' },
  { key: 'fatigueBefore', label: 'General fatigue' },
]

function PreSessionForm({
  values,
  onUpdate,
  isToday,
}: {
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

// ── Unit picker (bottom sheet) ────────────────────────────────────────

function UnitPicker({ units, onPick, onClose }: {
  units: TrainingUnit[]
  onPick: (unit: TrainingUnit) => void
  onClose: () => void
}) {
  const grouped = UNIT_TYPE_ORDER.map((type) => ({
    type,
    items: units.filter((u) => u.type === type),
  })).filter((g) => g.items.length > 0)

  const typeLabel: Record<string, string> = {
    climbing: 'Climbing', exercise: 'Exercise', hangboard: 'Hangboard',
    cardio: 'Cardio', stretching: 'Stretching / Mobility',
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-slate-900 border-t border-slate-700 rounded-t-2xl p-4 pb-6 max-h-[75vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-sm">Add training unit</p>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        {grouped.map(({ type, items }) => (
          <div key={type} className="mb-4">
            <p className="text-xs text-slate-500 mb-2">{typeLabel[type] ?? type}</p>
            <div className="flex flex-wrap gap-2">
              {items.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { onPick(u); onClose() }}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:text-emerald-300 rounded-xl text-sm transition-colors"
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page root ─────────────────────────────────────────────────────────

const EMPTY_PRE_STATE = {
  fingersBefore: null, bicepsBefore: null, shouldersBefore: null, fatigueBefore: null,
} as const

export default function TodayClient({
  date, today, initialSession, suggestedPlanDay, allUnits, gyms, prevData,
  currentCycleNumber, completedCycleNumber,
}: Props) {
  const [session, setSession] = useState<Session | null>(initialSession)
  const [prevMap] = useState<Record<string, PrevLog>>(prevData)
  const [showPicker, setShowPicker] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isToday = date === today
  const isFuture = date > today
  const isCompleted = !!session?.completedAt

  function go(delta: number) {
    const next = format(addDays(parseISO(date), delta), 'yyyy-MM-dd')
    router.push(`/today?date=${next}`)
  }

  const dateLabel = isToday
    ? 'Today'
    : date === format(addDays(parseISO(today), -1), 'yyyy-MM-dd')
    ? 'Yesterday'
    : null

  function addUnit(unit: TrainingUnit, planDayUnitId?: string, planDayId?: string) {
    startTransition(async () => {
      const { sessionId, log } = await addUnitLogToDate({
        date, trainingUnitId: unit.id, planDayUnitId,
        planDayId: planDayId ?? undefined,
        cycleNumber: currentCycleNumber,
      })
      setSession((prev) => {
        if (prev) return { ...prev, unitLogs: [...prev.unitLogs, log as UnitLog] }
        return {
          id: sessionId, date, completedAt: null, rpe: null, planDay: null,
          ...EMPTY_PRE_STATE, unitLogs: [log as UnitLog],
        }
      })
    })
  }

  function handlePreStateUpdate(key: PreStateKey, value: number) {
    startTransition(async () => {
      let sid = session?.id
      if (!sid) {
        // Create session to persist pre-state even before first unit
        sid = await ensureSessionForDate(date, suggestedPlanDay?.id, currentCycleNumber)
        setSession((prev) => prev ?? {
          id: sid!, date, completedAt: null, rpe: null, planDay: null,
          ...EMPTY_PRE_STATE, unitLogs: [],
        })
      }
      await updateSessionPreState(sid, { [key]: value })
      setSession((prev) => prev ? { ...prev, [key]: value } : prev)
    })
  }

  function handleUnitUpdate(updated: UnitLog) {
    setSession((prev) => prev
      ? { ...prev, unitLogs: prev.unitLogs.map((l) => l.id === updated.id ? updated : l) }
      : prev)
  }

  function handleUnitRemove(id: string) {
    setSession((prev) => prev
      ? { ...prev, unitLogs: prev.unitLogs.filter((l) => l.id !== id) }
      : prev)
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

  function handleDeleteSession() {
    if (!session || !confirm('Delete all training for this day?')) return
    startTransition(async () => {
      await deleteTrainingSession(session.id)
      setSession(null)
    })
  }

  const unitLogs = session?.unitLogs ?? []
  const doneCount = unitLogs.filter((l) => l.completed).length

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center gap-2 -mt-1">
        <button onClick={() => go(-1)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold">{dateLabel ?? date}</h1>
          <p className="text-xs text-slate-500">{format(parseISO(date), 'EEEE, MMMM d, yyyy', { locale: enUS })}</p>
        </div>
        <button onClick={() => go(1)} disabled={isToday} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-20 transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Cycle completion banner — shown on today when last session ended a cycle */}
      {isToday && completedCycleNumber !== null && !session && (
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-300">Cycle {completedCycleNumber} complete!</p>
            <p className="text-xs text-slate-400 mt-0.5">See your stats and suggestions</p>
          </div>
          <Link href={`/retrospective?cycle=${completedCycleNumber}`} className="shrink-0 text-xs px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white transition-colors">
            Retrospective →
          </Link>
        </div>
      )}

      {/* Pre-session state (today + past days with session) */}
      {(isToday || session) && !isFuture && (
        <PreSessionForm
          values={session ?? EMPTY_PRE_STATE}
          onUpdate={handlePreStateUpdate}
          isToday={isToday}
        />
      )}

      {/* Plan suggestion (today only, no session yet) */}
      {isToday && !session && suggestedPlanDay && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-2">
            From your plan — Day {suggestedPlanDay.dayNumber}
            {suggestedPlanDay.name && ` · ${suggestedPlanDay.name}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedPlanDay.units.map((u) => (
              <button
                key={u.id}
                onClick={() => addUnit({ id: u.trainingUnitId, name: u.trainingUnit.name, type: u.trainingUnit.type }, u.id, suggestedPlanDay!.id)}
                disabled={isPending}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-emerald-500 rounded-lg transition-colors disabled:opacity-50"
              >
                <Plus size={11} /> {u.trainingUnit.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Session header */}
      {session && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{doneCount}/{unitLogs.length} completed</p>
            <div className="flex items-center gap-2">
              <button onClick={handleDeleteSession} disabled={isPending} title="Delete day" className="p-1.5 text-slate-600 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
              {isCompleted ? (
                <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
                  <CheckCircle2 size={16} />
                  <span>Done!</span>
                  {session.rpe != null && <span className="text-slate-400 text-xs">RPE {session.rpe}/10</span>}
                </div>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={isPending || unitLogs.length === 0}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
                >
                  <CheckCircle2 size={15} /> Finish
                </button>
              )}
            </div>
          </div>

          {/* RPE prompt after completion */}
          {isCompleted && session.rpe == null && (
            <RPESelector onSelect={handleRPE} />
          )}
        </div>
      )}

      {/* Progress bar */}
      {unitLogs.length > 0 && (
        <div className="w-full bg-slate-800 rounded-full h-1">
          <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${(doneCount / unitLogs.length) * 100}%` }} />
        </div>
      )}

      {/* Unit log cards */}
      {unitLogs.map((log) => (
        <UnitLogCard
          key={log.id} log={log} gyms={gyms}
          prev={prevMap[log.trainingUnit.id] ?? null}
          onUpdate={handleUnitUpdate} onRemove={handleUnitRemove}
        />
      ))}

      {/* Empty state for past days */}
      {!session && !isFuture && !isToday && (
        <p className="text-center text-slate-500 text-sm py-4">No training recorded for this day.</p>
      )}

      {/* Add unit button */}
      {!isFuture && (
        <button
          onClick={() => setShowPicker(true)}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors text-sm disabled:opacity-50"
        >
          <Plus size={16} /> Add training unit
        </button>
      )}

      {showPicker && (
        <UnitPicker units={allUnits} onPick={(unit) => addUnit(unit)} onClose={() => setShowPicker(false)} />
      )}
    </div>
  )
}
