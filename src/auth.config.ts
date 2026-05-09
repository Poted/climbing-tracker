import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

declare module 'next-auth' {
  interface Session {
    user: { id: string } & import('next-auth').DefaultSession['user']
  }
}

export const authConfig: NextAuthConfig = {
  providers: [Credentials({})],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id
      return token
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string
      return session
    },
  },
  pages: { signIn: '/login' },
}
