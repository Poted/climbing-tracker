'use client'

import { useState, useTransition } from 'react'
import { authenticate } from '@/lib/actions'
import { registerUser } from './actions'
import Link from 'next/link'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await registerUser({ email, password })
      if (result.error) {
        setError(result.error)
        return
      }
      // Konto stworzone — logujemy od razu
      const err = await authenticate(email, password)
      if (err) setError(err)
      // sukces → authenticate() rzuca NEXT_REDIRECT → automatyczna nawigacja
    })
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Climbing Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Utwórz nowe konto</p>
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
            placeholder="Hasło (min. 8 znaków)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg font-medium transition-colors"
          >
            {isPending ? 'Tworzenie konta…' : 'Zarejestruj się'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400">
          Masz już konto?{' '}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Zaloguj się
          </Link>
        </p>
      </div>
    </div>
  )
}
