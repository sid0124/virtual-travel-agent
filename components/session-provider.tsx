"use client"

import { SessionProvider } from "next-auth/react"
import { TripPlanningProvider } from "@/components/trip-planning-provider"

export function Provider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <TripPlanningProvider>{children}</TripPlanningProvider>
        </SessionProvider>
    )
}
