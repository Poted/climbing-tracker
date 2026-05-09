'use client'

import { useState, useTransition } from 'react'
import {
  createGym, updateGym, deleteGym,
  addGradeMapping, deleteGradeMapping, swapGradeOrders,
} from '@/lib/actions'
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react'

const GYM_TYPES = [
  { value: 'boulder', label: 'Bouldering' },
  { value: 'sport', label: 'Sport climbing' },
  { value: 'both', label: 'Both' },
]

type GradeMapping = {
  id: string
  gymId: string
  localGrade: string
  order: number
}

type Gym = {
  id: string
  name: string
  type: string
  grades: GradeMapping[]
}

function GymCard({
  gym,
  onUpdate,
  onDelete,
}: {
  gym: Gym
  onUpdate: (g: Gym) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(gym.name)
  const [typeVal, setTypeVal] = useState(gym.type)
  const [localGrade, setLocalGrade] = useState('')
  const [isPending, startTransition] = useTransition()

  function saveName() {
    startTransition(async () => {
      await updateGym(gym.id, { name: nameVal.trim(), type: typeVal })
      onUpdate({ ...gym, name: nameVal.trim(), type: typeVal })
      setEditingName(false)
    })
  }

  function handleDelete() {
    if (!confirm(`Delete "${gym.name}"? This will also remove it from all sessions.`)) return
    startTransition(async () => {
      await deleteGym(gym.id)
      onDelete(gym.id)
    })
  }

  function handleAddGrade() {
    if (!localGrade.trim()) return
    startTransition(async () => {
      const mapping = await addGradeMapping({
        gymId: gym.id,
        localGrade: localGrade.trim(),
        order: gym.grades.length,
      })
      onUpdate({ ...gym, grades: [...gym.grades, mapping] })
      setLocalGrade('')
    })
  }

  function handleDeleteGrade(id: string) {
    startTransition(async () => {
      await deleteGradeMapping(id)
      const updated = gym.grades
        .filter((g) => g.id !== id)
        .map((g, i) => ({ ...g, order: i }))
      onUpdate({ ...gym, grades: updated })
    })
  }

  function handleMoveGrade(idx: number, dir: -1 | 1) {
    const grades = [...gym.grades]
    const other = idx + dir
    if (other < 0 || other >= grades.length) return
    startTransition(async () => {
      await swapGradeOrders(grades[idx].id, grades[idx].order, grades[other].id, grades[other].order)
      const next = [...grades]
      ;[next[idx], next[other]] = [next[other], next[idx]]
      onUpdate({ ...gym, grades: next.map((g, i) => ({ ...g, order: i })) })
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

        {editingName ? (
          <div className="flex-1 flex gap-2">
            <input
              className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
              autoFocus
            />
            <select
              className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
              value={typeVal}
              onChange={(e) => setTypeVal(e.target.value)}
            >
              {GYM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm">{gym.name}</span>
            <span className="text-xs text-slate-500 ml-2">
              {GYM_TYPES.find((t) => t.value === gym.type)?.label}
            </span>
          </div>
        )}

        {editingName ? (
          <div className="flex gap-1 shrink-0">
            <button onClick={saveName} disabled={isPending} className="p-1.5 rounded hover:bg-slate-700 text-emerald-400"><Check size={15} /></button>
            <button onClick={() => setEditingName(false)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400"><X size={15} /></button>
          </div>
        ) : (
          <div className="flex gap-1 shrink-0">
            <span className="text-xs text-slate-500 mr-1">{gym.grades.length} grades</span>
            <button onClick={() => setEditingName(true)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"><Pencil size={15} /></button>
            <button onClick={handleDelete} disabled={isPending} className="p-1.5 rounded hover:bg-red-900 text-slate-400 hover:text-red-300"><Trash2 size={15} /></button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700 pt-3">
          {/* Grade list */}
          <div className="space-y-1.5">
            {gym.grades.length === 0 && (
              <p className="text-xs text-slate-500 py-1">No grades yet. Add them below (easy → hard order).</p>
            )}
            {gym.grades.map((g, i) => (
              <div key={g.id} className="flex items-center gap-1 bg-slate-900 rounded px-2 py-1.5">
                <span className="text-xs text-slate-500 w-5 shrink-0">{i + 1}.</span>
                <span className="text-sm font-medium flex-1">{g.localGrade}</span>
                <button
                  onClick={() => handleMoveGrade(i, -1)}
                  disabled={isPending || i === 0}
                  className="p-1 text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
                  title="Move easier"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={() => handleMoveGrade(i, 1)}
                  disabled={isPending || i === gym.grades.length - 1}
                  className="p-1 text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
                  title="Move harder"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  onClick={() => handleDeleteGrade(g.id)}
                  disabled={isPending}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Add grade form */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Grade name (easy → hard order)</label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                placeholder="e.g. yellow, blue, red…"
                value={localGrade}
                onChange={(e) => setLocalGrade(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddGrade() }}
              />
            </div>
            <button
              onClick={handleAddGrade}
              disabled={isPending || !localGrade.trim()}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition-colors h-[34px]"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GymClient({ initialGyms }: { initialGyms: Gym[] }) {
  const [gyms, setGyms] = useState<Gym[]>(initialGyms)
  const [name, setName] = useState('')
  const [type, setType] = useState('boulder')
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    if (!name.trim()) return
    startTransition(async () => {
      const gym = await createGym({ name: name.trim(), type })
      setGyms((prev) => [...prev, { ...gym, grades: [] }])
      setName('')
      setType('boulder')
      setShowForm(false)
    })
  }

  function handleUpdate(updated: Gym) {
    setGyms((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
  }

  function handleDelete(id: string) {
    setGyms((prev) => prev.filter((g) => g.id !== id))
  }

  return (
    <div className="space-y-3">
      {gyms.length === 0 && !showForm && (
        <p className="text-slate-400 text-sm text-center py-8">
          No gyms yet. Add your first one below.
        </p>
      )}

      {gyms.map((gym) => (
        <GymCard key={gym.id} gym={gym} onUpdate={handleUpdate} onDelete={handleDelete} />
      ))}

      {showForm ? (
        <div className="bg-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="Gym name (e.g. Mood, Avatar)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              autoFocus
            />
            <select
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {GYM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isPending || !name.trim()}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <Check size={16} /> Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <X size={16} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl py-4 text-slate-400 hover:text-emerald-400 transition-colors text-sm"
        >
          <Plus size={18} /> Add gym
        </button>
      )}
    </div>
  )
}
