'use client'

import { useState, useTransition } from 'react'
import {
  createPlanDay, updatePlanDay, deletePlanDay,
  addUnitToPlanDay, updatePlanDayUnit, removePlanDayUnit,
} from '@/lib/actions'
import type { TrainingUnit } from '@/generated/prisma/client'
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react'

type PlanDayUnit = {
  id: string
  order: number
  targetReps: number | null
  targetSets: number | null
  timesPerDay: number
  notes: string | null
  trainingUnit: TrainingUnit
}

type PlanDay = {
  id: string
  dayNumber: number
  name: string | null
  units: PlanDayUnit[]
}

type Props = {
  initialPlan: PlanDay[]
  units: TrainingUnit[]
}

const UNIT_TYPE_BADGE: Record<string, string> = {
  climbing: 'bg-emerald-900 text-emerald-300',
  hangboard: 'bg-blue-900 text-blue-300',
  exercise: 'bg-orange-900 text-orange-300',
  cardio: 'bg-yellow-900 text-yellow-300',
  stretching: 'bg-purple-900 text-purple-300',
  custom: 'bg-slate-700 text-slate-300',
}

function unitTarget(u: PlanDayUnit) {
  const parts: string[] = []
  if (u.targetSets) parts.push(`${u.targetSets} sets`)
  if (u.targetReps) parts.push(`${u.targetReps} reps`)
  if (u.timesPerDay > 1) parts.push(`×${u.timesPerDay}/day`)
  return parts.join(' · ')
}

function AddUnitForm({
  planDayId,
  nextOrder,
  units,
  onAdded,
  onCancel,
}: {
  planDayId: string
  nextOrder: number
  units: TrainingUnit[]
  onAdded: (unit: PlanDayUnit) => void
  onCancel: () => void
}) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState('')
  const [isPending, startTransition] = useTransition()

  const selectedUnit = units.find((u) => u.id === unitId)
  const isNoReps = !selectedUnit || ['climbing', 'hangboard', 'cardio', 'stretching'].includes(selectedUnit.type)

  function handleAdd() {
    if (!unitId) return
    startTransition(async () => {
      const entry = await addUnitToPlanDay({
        planDayId,
        trainingUnitId: unitId,
        order: nextOrder,
        targetReps: !isNoReps && reps ? Number(reps) : undefined,
        targetSets: !isNoReps && sets ? Number(sets) : undefined,
      })
      const trainingUnit = units.find((u) => u.id === unitId)!
      onAdded({ ...entry, trainingUnit })
    })
  }

  return (
    <div className="bg-slate-900 rounded-lg p-3 space-y-2 border border-slate-700">
      <select
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
        value={unitId}
        onChange={(e) => setUnitId(e.target.value)}
      >
        {units.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      {!isNoReps && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">Target sets</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="e.g. 3"
              type="number" min="1"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">Starting reps</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="e.g. 10"
              type="number" min="1"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </div>
        </div>
      )}
      {!isNoReps && (
        <p className="text-xs text-slate-600">Each set is logged individually during the session.</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={isPending || !unitId}
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          <Check size={14} /> Add
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  )
}

function PlanDayCard({
  day,
  units,
  onUpdate,
  onDelete,
}: {
  day: PlanDay
  units: TrainingUnit[]
  onUpdate: (updated: PlanDay) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(day.name ?? '')
  const [addingUnit, setAddingUnit] = useState(false)
  const [isPending, startTransition] = useTransition()

  function saveName() {
    startTransition(async () => {
      await updatePlanDay(day.id, { name: nameVal.trim() || undefined })
      onUpdate({ ...day, name: nameVal.trim() || null })
      setEditingName(false)
    })
  }

  function removeUnit(unitId: string) {
    startTransition(async () => {
      await removePlanDayUnit(unitId)
      onUpdate({ ...day, units: day.units.filter((u) => u.id !== unitId) })
    })
  }

  function handleUnitAdded(unit: PlanDayUnit) {
    onUpdate({ ...day, units: [...day.units, unit] })
    setAddingUnit(false)
  }

  function handleDelete() {
    if (!confirm(`Delete Day ${day.dayNumber}?`)) return
    startTransition(async () => {
      await deletePlanDay(day.id)
      onDelete(day.id)
    })
  }

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-14 shrink-0">
          Day {day.dayNumber}
        </span>

        {editingName ? (
          <input
            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
            autoFocus
          />
        ) : (
          <span className="flex-1 font-medium text-sm truncate">
            {day.name || <span className="text-slate-500 italic">unnamed</span>}
          </span>
        )}

        {editingName ? (
          <div className="flex gap-1">
            <button onClick={saveName} disabled={isPending} className="p-1.5 rounded hover:bg-slate-700 text-emerald-400"><Check size={15} /></button>
            <button onClick={() => setEditingName(false)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400"><X size={15} /></button>
          </div>
        ) : (
          <div className="flex gap-1">
            <button onClick={() => setEditingName(true)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"><Pencil size={15} /></button>
            <button onClick={handleDelete} disabled={isPending} className="p-1.5 rounded hover:bg-red-900 text-slate-400 hover:text-red-300"><Trash2 size={15} /></button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {day.units.length === 0 && !addingUnit && (
            <p className="text-slate-500 text-xs py-2">No exercises</p>
          )}

          {day.units.map((u) => (
            <div key={u.id} className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{u.trainingUnit.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${UNIT_TYPE_BADGE[u.trainingUnit.type] ?? 'bg-slate-700 text-slate-300'}`}>
                    {u.trainingUnit.type}
                  </span>
                </div>
                {unitTarget(u) && (
                  <p className="text-xs text-slate-400 mt-0.5">{unitTarget(u)}</p>
                )}
              </div>
              <button
                onClick={() => removeUnit(u.id)}
                disabled={isPending}
                className="p-1.5 rounded hover:bg-red-900 text-slate-500 hover:text-red-300 transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {addingUnit ? (
            <AddUnitForm
              planDayId={day.id}
              nextOrder={day.units.length}
              units={units}
              onAdded={handleUnitAdded}
              onCancel={() => setAddingUnit(false)}
            />
          ) : (
            <button
              onClick={() => setAddingUnit(true)}
              className="w-full flex items-center justify-center gap-1 border border-dashed border-slate-700 hover:border-emerald-500 rounded-lg py-2 text-xs text-slate-500 hover:text-emerald-400 transition-colors"
            >
              <Plus size={14} /> Add exercise
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlanClient({ initialPlan, units }: Props) {
  const [plan, setPlan] = useState<PlanDay[]>(initialPlan)
  const [isPending, startTransition] = useTransition()

  function handleUpdate(updated: PlanDay) {
    setPlan((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
  }

  function handleDelete(id: string) {
    setPlan((prev) => prev.filter((d) => d.id !== id))
  }

  function addDay() {
    const nextNum = plan.length > 0 ? Math.max(...plan.map((d) => d.dayNumber)) + 1 : 1
    startTransition(async () => {
      const day = await createPlanDay({ dayNumber: nextNum })
      setPlan((prev) => [...prev, { ...day, units: [] }])
    })
  }

  if (units.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        <p>First add training units in the <strong>Units</strong> tab.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {plan.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-8">
          Plan is empty. Add your first day below.
        </p>
      )}

      {plan.map((day) => (
        <PlanDayCard
          key={day.id}
          day={day}
          units={units}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ))}

      <button
        onClick={addDay}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl py-4 text-slate-400 hover:text-emerald-400 transition-colors text-sm disabled:opacity-50"
      >
        <Plus size={18} /> Add day
      </button>
    </div>
  )
}
