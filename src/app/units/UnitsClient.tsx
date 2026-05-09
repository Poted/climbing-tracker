'use client'

import { useState, useTransition } from 'react'
import {
  createTrainingUnit,
  updateTrainingUnit,
  deleteTrainingUnit,
} from '@/lib/actions'
import type { TrainingUnit } from '@/generated/prisma/client'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'

const UNIT_TYPES = [
  { value: 'climbing', label: 'Climbing' },
  { value: 'hangboard', label: 'Hangboard / No-hangs' },
  { value: 'exercise', label: 'Exercise (reps + weight)' },
  { value: 'cardio', label: 'Cardio (time + distance)' },
  { value: 'stretching', label: 'Stretching / Warmup' },
]

function typeLabel(type: string) {
  return UNIT_TYPES.find((t) => t.value === type)?.label ?? type
}

function typeBadgeClass(type: string) {
  const map: Record<string, string> = {
    climbing: 'bg-emerald-900 text-emerald-300',
    hangboard: 'bg-blue-900 text-blue-300',
    exercise: 'bg-orange-900 text-orange-300',
    cardio: 'bg-yellow-900 text-yellow-300',
    stretching: 'bg-purple-900 text-purple-300',
    custom: 'bg-slate-700 text-slate-300',
  }
  return map[type] ?? 'bg-slate-700 text-slate-300'
}

export default function UnitsClient({ initialUnits }: { initialUnits: TrainingUnit[] }) {
  const [units, setUnits] = useState<TrainingUnit[]>(initialUnits)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState('exercise')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditId(null)
    setName('')
    setType('exercise')
    setDescription('')
    setShowForm(true)
  }

  function openEdit(unit: TrainingUnit) {
    setEditId(unit.id)
    setName(unit.name)
    setType(unit.type)
    setDescription(unit.description ?? '')
    setShowForm(true)
  }

  function handleCancel() {
    setShowForm(false)
    setEditId(null)
  }

  function handleSave() {
    if (!name.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        if (editId) {
          const updated = await updateTrainingUnit(editId, {
            name: name.trim(),
            type,
            description: description.trim() || undefined,
          })
          setUnits((prev) => prev.map((u) => (u.id === editId ? updated : u)))
        } else {
          const created = await createTrainingUnit({
            name: name.trim(),
            type,
            description: description.trim() || undefined,
          })
          setUnits((prev) => [...prev, created])
        }
        setShowForm(false)
        setEditId(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this unit?')) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteTrainingUnit(id)
        setUnits((prev) => prev.filter((u) => u.id !== id))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
          Error: {error}
        </div>
      )}
      {showForm && (
        <div className="bg-slate-800 rounded-xl p-4 space-y-3">
          <input
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            placeholder="Unit name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <select
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {UNIT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"
            placeholder="Description (optional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || !name.trim()}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <Check size={16} /> Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <X size={16} /> Cancel
            </button>
          </div>
        </div>
      )}

      {units.length === 0 && !showForm && (
        <p className="text-slate-400 text-sm text-center py-8">
          No units yet. Add your first one below.
        </p>
      )}

      {units.map((unit) => (
        <div key={unit.id} className="bg-slate-800 rounded-xl p-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{unit.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadgeClass(unit.type)}`}>
                {typeLabel(unit.type)}
              </span>
            </div>
            {unit.description && (
              <p className="text-slate-400 text-sm mt-1">{unit.description}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => openEdit(unit)}
              className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => handleDelete(unit.id)}
              disabled={isPending}
              className="p-2 rounded-lg hover:bg-red-900 text-slate-400 hover:text-red-300 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}

      {!showForm && (
        <button
          onClick={openCreate}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl py-4 text-slate-400 hover:text-emerald-400 transition-colors text-sm"
        >
          <Plus size={18} /> Add unit
        </button>
      )}
    </div>
  )
}
