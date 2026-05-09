'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListChecks, History, Dumbbell, Layers, MapPin, MoreHorizontal, X, LogOut } from 'lucide-react'
import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'

const primaryLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/today', label: 'Training', icon: ListChecks },
  { href: '/history', label: 'History', icon: History },
]

const secondaryLinks = [
  { href: '/plan', label: 'Plan', icon: Dumbbell },
  { href: '/units', label: 'Units', icon: Layers },
  { href: '/gyms', label: 'Gyms', icon: MapPin },
]

function isActive(href: string, path: string) {
  return href === '/' ? path === '/' : path.startsWith(href)
}

export default function Nav() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const { data: session } = useSession()

  const secondaryActive = secondaryLinks.some((l) => isActive(l.href, path))

  function close() { setOpen(false) }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800">
      {/* Secondary row — visible when expanded */}
      {open && (
        <div className="border-b border-slate-800/60">
          <div className="flex justify-center gap-1 py-2">
            {secondaryLinks.map(({ href, label, icon: Icon }) => {
              const active = isActive(href, path)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className={`flex flex-col items-center gap-1 px-5 py-1 text-xs rounded-lg transition-colors ${
                    active ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                  {label}
                </Link>
              )
            })}
          </div>
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-xs text-slate-500 truncate max-w-[60%]">
              {session?.user?.name ?? session?.user?.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Primary row — always visible */}
      <div className="flex justify-center gap-1 py-2">
        {primaryLinks.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, path)
          return (
            <Link
              key={href}
              href={href}
              onClick={close}
              className={`flex flex-col items-center gap-1 px-5 py-1 text-xs rounded-lg transition-colors ${
                active ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          )
        })}

        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex flex-col items-center gap-1 px-5 py-1 text-xs rounded-lg transition-colors ${
            open || secondaryActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {open
            ? <X size={22} strokeWidth={1.8} />
            : <MoreHorizontal size={22} strokeWidth={1.8} />}
          {open ? 'Close' : 'More'}
        </button>
      </div>
    </nav>
  )
}
