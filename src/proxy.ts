import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export const proxy = auth((req) => {
  const isAuthed = !!req.auth
  const path = req.nextUrl.pathname
  if (!isAuthed && path !== '/login' && path !== '/register') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
