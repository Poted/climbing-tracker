'use client'

import { useState, useTransition } from 'react'
import { authenticate } from '@/lib/actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const err = await authenticate(email, password)
      if (err) setError(err)
      // sukces → authenticate() rzuca NEXT_REDIRECT → Next.js automatycznie nawiguje
    })
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Climbing Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Zaloguj się do swojego konta</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 space-y-3">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
          />
          <input
            type="password"
            placeholder="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg font-medium transition-colors"
          >
            {isPending ? 'Logowanie…' : 'Zaloguj się'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400">
          Nie masz konta?{' '}
          <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Zarejestruj się
          </Link>
        </p>
      </div>
    </div>
  )
}
