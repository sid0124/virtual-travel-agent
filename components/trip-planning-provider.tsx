"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
  defaultTripSetupState,
  dedupeSelectedDestinations,
  normalizeSelectedDestination,
  TRIP_BUDGET_STORAGE_KEY,
  TRIP_SETUP_STORAGE_KEY,
  type SelectedDestination,
  type TripBudgetEstimate,
  type TripSetupState,
} from "@/lib/trip-budget"

type TripPlanningContextValue = {
  tripSetup: TripSetupState
  setTripSetup: (updater: TripSetupState | ((prev: TripSetupState) => TripSetupState)) => void
  addDestination: (destination: SelectedDestination) => void
  removeDestination: (destinationId: string) => void
  clearDestinations: () => void
  budgetEstimate: TripBudgetEstimate | null
  setBudgetEstimate: (estimate: TripBudgetEstimate | null) => void
  hydrated: boolean
}

const TripPlanningContext = createContext<TripPlanningContextValue | null>(null)

export function TripPlanningProvider({ children }: { children: React.ReactNode }) {
  const [tripSetup, setTripSetupState] = useState<TripSetupState>(defaultTripSetupState)
  const [budgetEstimate, setBudgetEstimateState] = useState<TripBudgetEstimate | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const rawSetup = window.localStorage.getItem(TRIP_SETUP_STORAGE_KEY)
      const rawBudget = window.localStorage.getItem(TRIP_BUDGET_STORAGE_KEY)

      if (rawSetup) {
        const parsed = JSON.parse(rawSetup) as TripSetupState
        setTripSetupState({
          ...defaultTripSetupState,
          ...parsed,
          discoveryContext: {
            ...defaultTripSetupState.discoveryContext,
            ...(parsed as Partial<TripSetupState>)?.discoveryContext,
          },
          selectedDestinations: dedupeSelectedDestinations(
            Array.isArray(parsed.selectedDestinations)
              ? parsed.selectedDestinations
                  .map((destination) => normalizeSelectedDestination(destination))
                  .filter(Boolean) as SelectedDestination[]
              : []
          ),
        })
      }

      if (rawBudget) {
        setBudgetEstimateState(JSON.parse(rawBudget) as TripBudgetEstimate)
      }
    } catch {
      // Ignore invalid persisted state.
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(TRIP_SETUP_STORAGE_KEY, JSON.stringify(tripSetup))
  }, [hydrated, tripSetup])

  useEffect(() => {
    if (!hydrated) return
    if (!budgetEstimate) {
      window.localStorage.removeItem(TRIP_BUDGET_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(TRIP_BUDGET_STORAGE_KEY, JSON.stringify(budgetEstimate))
  }, [budgetEstimate, hydrated])

  const setTripSetup = useCallback((updater: TripSetupState | ((prev: TripSetupState) => TripSetupState)) => {
    setTripSetupState((prev) => (typeof updater === "function" ? updater(prev) : updater))
  }, [])

  const addDestination = useCallback((destination: SelectedDestination) => {
    const normalized = normalizeSelectedDestination(destination)
    if (!normalized) return

    setTripSetupState((prev) => ({
      ...prev,
      selectedDestinations: dedupeSelectedDestinations([...prev.selectedDestinations, normalized]),
    }))
  }, [])

  const removeDestination = useCallback((destinationId: string) => {
    setTripSetupState((prev) => ({
      ...prev,
      selectedDestinations: prev.selectedDestinations.filter((destination) => destination.id !== destinationId),
    }))
  }, [])

  const clearDestinations = useCallback(() => {
    setTripSetupState((prev) => ({
      ...prev,
      selectedDestinations: [],
    }))
  }, [])

  const value = useMemo(
    () => ({
      tripSetup,
      setTripSetup,
      addDestination,
      removeDestination,
      clearDestinations,
      budgetEstimate,
      setBudgetEstimate: setBudgetEstimateState,
      hydrated,
    }),
    [budgetEstimate, hydrated, tripSetup]
  )

  return <TripPlanningContext.Provider value={value}>{children}</TripPlanningContext.Provider>
}

export function useTripPlanning() {
  const context = useContext(TripPlanningContext)
  if (!context) {
    throw new Error("useTripPlanning must be used within TripPlanningProvider")
  }
  return context
}
