import NextAuth from "next-auth"
import { authOptions } from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptionsWithProviders = {
    ...authOptions,
    providers: [
        Credentials({
            async authorize(credentials) {
                try {
                    const parsedCredentials = z
                        .object({ email: z.string().email(), password: z.string().min(8) })
                        .safeParse(credentials)

                    if (!parsedCredentials.success) {
                        return null
                    }

                    const { email, password } = parsedCredentials.data
                    const normalizedEmail = email.trim().toLowerCase()

                    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
                    if (!user?.passwordHash) {
                        return null
                    }

                    const passwordsMatch = await bcrypt.compare(password, user.passwordHash)
                    if (passwordsMatch) return user

                    return null
                } catch (error) {
                    console.error("Credentials authorize failed:", error)
                    return null
                }
            },
        }),
    ],
}

export default NextAuth(authOptionsWithProviders)
