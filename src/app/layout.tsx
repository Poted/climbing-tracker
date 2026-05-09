import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import Providers from '@/components/Providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Climbing Tracker',
  description: 'Track your climbing and fitness training',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-slate-950 text-slate-100 flex flex-col">
        <Providers>
          <Nav />
          <main className="flex-1 container mx-auto max-w-2xl px-4 pt-6 pb-32">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
