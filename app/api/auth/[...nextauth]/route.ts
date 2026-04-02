import NextAuth from "next-auth"
import { authOptionsWithProviders } from "@/auth"

const handler = NextAuth(authOptionsWithProviders)

export { handler as GET, handler as POST }
