'use server'

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function registerUser(data: {
  email: string
  password: string
}): Promise<{ error?: string }> {
  if (!data.email || !data.password) return { error: 'Email i hasło są wymagane.' }
  if (data.password.length < 8) return { error: 'Hasło musi mieć co najmniej 8 znaków.' }

  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing) return { error: 'Konto z tym emailem już istnieje.' }

  const passwordHash = await bcrypt.hash(data.password, 12)
  await prisma.user.create({ data: { email: data.email, passwordHash } })

  return {}
}
