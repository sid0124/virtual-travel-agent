import type { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
    pages: {
        signIn: "/login",
    },
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
    providers: [],
}
