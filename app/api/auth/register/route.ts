import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8).regex(/[A-Z]/, "Must contain at least one uppercase letter").regex(/[0-9]/, "Must contain at least one number"),
})

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const result = registerSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid input", details: result.error.errors }, { status: 400 })
        }

        const { name, email, password } = result.data
        const normalizedEmail = email.trim().toLowerCase()
        const normalizedName = name.trim()

        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        })

        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 })
        }

        const passwordHash = await bcrypt.hash(password, 10)

        const user = await prisma.user.create({
            data: {
                name: normalizedName,
                email: normalizedEmail,
                passwordHash,
            },
        })

        const { passwordHash: _, ...userWithoutPassword } = user

        return NextResponse.json(userWithoutPassword, { status: 201 })
    } catch (error) {
        console.error("Registration error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
