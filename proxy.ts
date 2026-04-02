import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const protectedPaths = [
    "/ai-assistant",
    "/itinerary",
    "/budget",
    "/booking",
    "/profile",
]

export async function proxy(req: NextRequest) {
    const { pathname, search } = req.nextUrl
    const isOnProtected = protectedPaths.some((p) => pathname.startsWith(p))

    const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
    })

    if (pathname === "/login" && token) {
        return NextResponse.redirect(new URL("/", req.url))
    }

    if (isOnProtected && !token) {
        const loginUrl = new URL("/login", req.url)
        loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: ['/((?!api|_next/static|_next/image|assets|favicon.ico).*)'],
}
