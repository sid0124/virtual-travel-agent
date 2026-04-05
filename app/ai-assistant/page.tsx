"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CloudSun,
  Compass,
  Copy,
  Download,
  Hotel,
  MapPinned,
  Menu,
  Mic,
  MoreHorizontal,
  Pencil,
  Plane,
  Pin,
  Route,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react"

import { ChatBubble } from "@/components/chat-bubble"
import { Navigation } from "@/components/navigation"
import { useTripPlanning } from "@/components/trip-planning-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency"
import { defaultTripSetupState } from "@/lib/trip-budget"
import { cn } from "@/lib/utils"

type Role = "user" | "assistant"

type TravelArtifacts = {
  nearbyPlaces?: any[]
  destinations?: any[]
  budget?: any
  hotels?: any[]
  flights?: any[]
  weather?: any
  distanceKm?: number | null
}

type TravelMessage = {
  id: string
  role: Role
  content: string
  artifacts?: TravelArtifacts
  followUpQuestions?: string[]
  suggestedActions?: string[]
  actionCtas?: string[]
}

type ChatSession = {
  id: string
  title: string
  preview: string
  createdAt: string
  updatedAt: string
  messages: TravelMessage[]
  memory: any
  pinned?: boolean
}

const CHAT_STORAGE_KEY = "WANDERLY_AI_CHAT_SESSIONS_V2"
const ACTIVE_CHAT_STORAGE_KEY = "WANDERLY_AI_ACTIVE_CHAT_ID_V2"

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function formatMoney(value: number, currency = DEFAULT_CURRENCY) {
  return formatCurrency(value, currency)
}

function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.round(diff / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isContextEmpty(memory: any) {
  return !(
    memory?.startingLocation ||
    memory?.dateRange?.from ||
    memory?.dateRange?.to ||
    memory?.selectedDestinations?.length ||
    (typeof memory?.travelers === "number" && memory.travelers > defaultTripSetupState.travelers) ||
    (memory?.budgetPreference && memory.budgetPreference !== defaultTripSetupState.budgetPreference) ||
    (memory?.travelStyle && memory.travelStyle !== defaultTripSetupState.travelStyle)
  )
}

function buildSmartTitle(prompt: string, memory: any) {
  const normalized = normalizeText(prompt)
  const destinationNames = Array.isArray(memory?.selectedDestinations)
    ? memory.selectedDestinations.map((item: any) => item.name).filter(Boolean)
    : []

  if (destinationNames.length > 0) {
    const first = destinationNames[0]
    if (/budget/.test(normalized)) return `${first} budget trip`
    if (/flight/.test(normalized)) return `${first} flight options`
    if (/hotel/.test(normalized)) return `${first} hotel plan`
    if (/weather|best time/.test(normalized)) return `${first} travel timing`
    return `${first} trip plan`
  }

  const titleWords = prompt.replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ")
  return titleWords || "New travel chat"
}

function createSession(memory: any): ChatSession {
  const now = new Date().toISOString()
  return {
    id: createId(),
    title: "New travel chat",
    preview: "Start planning with Wanderly",
    createdAt: now,
    updatedAt: now,
    messages: [],
    memory,
    pinned: false,
  }
}

function mergeMemory(base: any, next: any) {
  return {
    ...base,
    ...next,
    dateRange: {
      from: next?.dateRange?.from || base?.dateRange?.from,
      to: next?.dateRange?.to || base?.dateRange?.to,
    },
    selectedDestinations:
      Array.isArray(next?.selectedDestinations) && next.selectedDestinations.length > 0
        ? next.selectedDestinations
        : base?.selectedDestinations || [],
  }
}

function buildQuickActions(memory: any) {
  const firstDestination = memory?.selectedDestinations?.[0]?.name
  const origin = memory?.startingLocation

  if (firstDestination) {
    return [
      `Estimate ${firstDestination} budget`,
      `Hotels near ${firstDestination}`,
      origin ? `Flights from ${origin}` : "Find flights",
      `Weather in ${firstDestination}`,
      `Best time to visit ${firstDestination}`,
      "Modify my trip",
    ]
  }

  return [
    "Plan my trip",
    "Suggest destinations",
    "Estimate budget",
    "Find hotels",
    "Check weather",
    "Best time to visit",
  ]
}

function SidebarChatItem({
  session,
  active,
  onSelect,
  onPin,
  onDuplicate,
  onRename,
  onDelete,
}: {
  session: ChatSession
  active: boolean
  onSelect: () => void
  onPin: () => void
  onDuplicate: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        "group rounded-[22px] border transition-all",
        active
          ? "border-sky-200 bg-sky-50/90 shadow-[0_18px_50px_rgba(59,130,246,0.12)]"
          : "border-slate-200/80 bg-white/88 hover:border-slate-300 hover:bg-white"
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {session.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-sky-600" /> : null}
              <p className={cn("truncate text-sm font-semibold", active ? "text-sky-950" : "text-slate-900")}>
                {session.title}
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(session.updatedAt)}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{session.preview}</p>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "rounded-full p-2 text-slate-400 transition hover:bg-white hover:text-slate-700",
                active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              aria-label={`Manage ${session.title}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onPin}>
              <Pin className="h-4 w-4" />
              {session.pinned ? "Unpin chat" : "Pin chat"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
              Duplicate chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-4 w-4" />
              Rename chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4" />
              Delete chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function ContextCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: "default" | "accent"
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border p-4 shadow-[0_16px_40px_rgba(148,163,184,0.08)]",
        tone === "accent"
          ? "border-sky-200 bg-[linear-gradient(135deg,#f8fcff_0%,#eef7ff_100%)]"
          : "border-slate-200/80 bg-white/90"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-sm text-slate-600">{value}</p>
    </div>
  )
}

function BudgetCard({ budget }: { budget: any }) {
  if (!budget) return null

  return (
    <div className="rounded-[24px] border border-emerald-200/70 bg-[linear-gradient(135deg,#fbfffd_0%,#eefcf4_100%)] p-5 shadow-[0_18px_40px_rgba(16,185,129,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Budget estimate</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">{formatMoney(budget.totalBudget, budget.currency)}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {budget.totalDays} days | {budget.destinationsCount} destination{budget.destinationsCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3">
          <p className="text-xs text-slate-500">Per day</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(budget.perDayCost, budget.currency)}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white/80 p-3"><p className="text-xs text-slate-500">Stay</p><p className="mt-1 font-semibold">{formatMoney(budget.breakdown.stay, budget.currency)}</p></div>
        <div className="rounded-2xl bg-white/80 p-3"><p className="text-xs text-slate-500">Food</p><p className="mt-1 font-semibold">{formatMoney(budget.breakdown.food, budget.currency)}</p></div>
        <div className="rounded-2xl bg-white/80 p-3"><p className="text-xs text-slate-500">Travel</p><p className="mt-1 font-semibold">{formatMoney(budget.breakdown.travel, budget.currency)}</p></div>
        <div className="rounded-2xl bg-white/80 p-3"><p className="text-xs text-slate-500">Activities</p><p className="mt-1 font-semibold">{formatMoney(budget.breakdown.activities, budget.currency)}</p></div>
      </div>
    </div>
  )
}

function WeatherCard({ weather }: { weather: any }) {
  if (!weather) return null

  return (
    <div className="rounded-[24px] border border-sky-200/80 bg-[linear-gradient(135deg,#fbfdff_0%,#eef7ff_100%)] p-5 shadow-[0_18px_40px_rgba(59,130,246,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Weather guidance</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">{weather.place}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {weather.temperatureC} C | {weather.condition}
          </p>
        </div>
        {weather.bestTime ? (
          <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3">
            <p className="text-xs text-slate-500">Best season</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{weather.bestTime}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-white/85 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Travel comfort</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{weather.comfort}</p>
        </div>
        <div className="rounded-2xl bg-white/85 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Packing tip</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{weather.packing}</p>
        </div>
        <div className="rounded-2xl bg-white/85 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Best hours</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{weather.bestHours}</p>
        </div>
      </div>
    </div>
  )
}

function NearbyPlacesCard({ placeName, items }: { placeName?: string; items: any[] }) {
  if (!items?.length) return null

  return (
    <div className="rounded-[24px] border border-amber-200/70 bg-[linear-gradient(135deg,#fffdf7_0%,#fff7ed_100%)] p-5 shadow-[0_18px_40px_rgba(245,158,11,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Nearby attractions</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            {placeName ? `Best places around ${placeName}` : "Best nearby places"}
          </h3>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item, index) => (
          <div key={item.id || `${item.name}-${index}`} className="rounded-2xl border border-white/70 bg-white/90 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.subtitle || item.bestFor || "Nearby stop"}</p>
              </div>
              {item.travelTime ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">{item.travelTime}</span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{item.whyVisit}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TravelOptions({
  title,
  items,
  type,
}: {
  title: string
  items: any[]
  type: "hotel" | "flight"
}) {
  if (!items?.length) return null

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.08)]">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">{type === "hotel" ? item.name : `${item.from} to ${item.to}`}</p>
              <p className="text-sm text-slate-500">
                {type === "hotel"
                  ? `${item.destination} | ${item.rating}/5 rating`
                  : `${item.airline} | ${item.departure} - ${item.arrival} | ${item.duration}`}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-950">{formatMoney(item.price, item.currency || DEFAULT_CURRENCY)}</p>
              <p className="text-xs text-slate-500">{type === "hotel" ? "per night" : "from"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DestinationSuggestions({ items }: { items: any[] }) {
  if (!items?.length) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/92 shadow-[0_18px_40px_rgba(148,163,184,0.08)]">
          {item.image ? (
            <div className="relative h-36">
              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-white/80">{[item.city, item.state, item.country].filter(Boolean).join(", ")}</p>
              </div>
            </div>
          ) : null}
          <div className="p-4">
            <p className="line-clamp-2 text-sm text-slate-600">{item.description}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{item.bestTime || "Flexible timing"}</span>
              {item.budget ? <span>{formatMoney(item.budget.min, item.budget.currency)}+</span> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AiAssistantPage() {
  const { tripSetup, hydrated } = useTripPlanning()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState("Thinking through your trip")
  const [renameSessionId, setRenameSessionId] = useState("")
  const [renameValue, setRenameValue] = useState("")
  const [deleteSessionId, setDeleteSessionId] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const appMemory = useMemo(
    () => ({
      ...tripSetup,
      selectedDestinations: Array.isArray(tripSetup?.selectedDestinations) ? tripSetup.selectedDestinations : [],
    }),
    [tripSetup]
  )

  useEffect(() => {
    if (!hydrated) return

    try {
      const storedSessions = window.localStorage.getItem(CHAT_STORAGE_KEY)
      const parsedSessions = storedSessions ? (JSON.parse(storedSessions) as ChatSession[]) : []
      const activeId = window.localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY) || ""

      if (parsedSessions.length > 0) {
        setSessions(parsedSessions)
        setActiveSessionId(
          parsedSessions.some((session) => session.id === activeId) ? activeId : parsedSessions[0].id
        )
      } else {
        const initial = createSession(appMemory)
        setSessions([initial])
        setActiveSessionId(initial.id)
      }
    } catch {
      const initial = createSession(appMemory)
      setSessions([initial])
      setActiveSessionId(initial.id)
    }
  }, [appMemory, hydrated])

  useEffect(() => {
    if (!hydrated || sessions.length === 0) return
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions))
  }, [hydrated, sessions])

  useEffect(() => {
    if (!hydrated || !activeSessionId) return
    window.localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, activeSessionId)
  }, [activeSessionId, hydrated])

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || sessions[0] || null,
    [activeSessionId, sessions]
  )

  const currentMemory = useMemo(
    () => mergeMemory(appMemory, activeSession?.memory || {}),
    [activeSession?.memory, appMemory]
  )

  const filteredSessions = useMemo(() => {
    const query = normalizeText(searchQuery)
    const matched = !query
      ? sessions
      : sessions.filter((session) => normalizeText(`${session.title} ${session.preview}`).includes(query))

    return [...matched].sort((left, right) => {
      if (Boolean(left.pinned) !== Boolean(right.pinned)) return left.pinned ? -1 : 1
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })
  }, [searchQuery, sessions])

  const quickActions = useMemo(() => buildQuickActions(currentMemory), [currentMemory])
  const hasTripContext = !isContextEmpty(currentMemory)
  const showOnboarding = !activeSession?.messages.length

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [activeSession?.messages, isLoading])

  useEffect(() => {
    if (!activeSession) return
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSession.id
          ? { ...session, memory: mergeMemory(session.memory, appMemory) }
          : session
      )
    )
  }, [appMemory, activeSession?.id])

  function patchSession(sessionId: string, updater: (session: ChatSession) => ChatSession) {
    setSessions((prev) => prev.map((session) => (session.id === sessionId ? updater(session) : session)))
  }

  function createNewChat() {
    const next = createSession(appMemory)
    setSessions((prev) => [next, ...prev])
    setActiveSessionId(next.id)
    setInput("")
    setSidebarOpen(false)
  }

  async function sendMessage(prompt?: string) {
    if (!activeSession) return
    const content = String(prompt ?? input).trim()
    if (!content) return

    const userMessage: TravelMessage = { id: createId(), role: "user", content }
    const nextMessages = [...activeSession.messages, userMessage]
    const optimisticTitle =
      activeSession.title === "New travel chat" ? buildSmartTitle(content, currentMemory) : activeSession.title

    patchSession(activeSession.id, (session) => ({
      ...session,
      title: optimisticTitle,
      preview: content,
      updatedAt: new Date().toISOString(),
      memory: currentMemory,
      messages: nextMessages,
    }))

    setInput("")
    setIsLoading(true)
    setLoadingLabel(
      /budget/i.test(content)
        ? "Calculating budget"
        : /hotel|flight/i.test(content)
          ? "Checking travel options"
          : /weather|best time/i.test(content)
            ? "Reviewing travel conditions"
            : /destination|suggest/i.test(content)
              ? "Finding best destinations"
              : "Planning your trip"
    )

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
          tripContext: currentMemory,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Failed to get assistant response")

      const assistantMessage: TravelMessage = {
        id: createId(),
        role: "assistant",
        content: data.reply,
        artifacts: data.artifacts,
        followUpQuestions: data.followUpQuestions,
        suggestedActions: data.suggestedActions,
        actionCtas: data.actionCtas,
      }

      patchSession(activeSession.id, (session) => ({
        ...session,
        title: data.conversationTitle || session.title || optimisticTitle,
        preview: data.reply,
        updatedAt: new Date().toISOString(),
        memory: mergeMemory(currentMemory, data.memory || {}),
        messages: [...nextMessages, assistantMessage],
      }))

      setLoadingLabel(data.loadingLabel || loadingLabel)
    } catch (error: any) {
      patchSession(activeSession.id, (session) => ({
        ...session,
        preview: error?.message || "Something went wrong",
        updatedAt: new Date().toISOString(),
        messages: [
          ...nextMessages,
          {
            id: createId(),
            role: "assistant",
            content: error?.message || "I hit a snag while planning your trip. Please try again.",
          },
        ],
      }))
    } finally {
      setIsLoading(false)
    }
  }

  function startRename(session: ChatSession) {
    setRenameSessionId(session.id)
    setRenameValue(session.title)
  }

  function saveRename() {
    const title = renameValue.trim()
    if (!title || !renameSessionId) return
    patchSession(renameSessionId, (session) => ({
      ...session,
      title,
      updatedAt: new Date().toISOString(),
    }))
    setRenameSessionId("")
    setRenameValue("")
  }

  function togglePinSession(sessionId: string) {
    patchSession(sessionId, (session) => ({
      ...session,
      pinned: !session.pinned,
      updatedAt: new Date().toISOString(),
    }))
  }

  function duplicateSession(sessionId: string) {
    const source = sessions.find((session) => session.id === sessionId)
    if (!source) return

    const duplicate: ChatSession = {
      ...source,
      id: createId(),
      title: `${source.title} copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      messages: source.messages.map((message) => ({ ...message, id: createId() })),
    }

    setSessions((prev) => [duplicate, ...prev])
    setActiveSessionId(duplicate.id)
    setSidebarOpen(false)
  }

  function exportSession(session: ChatSession) {
    if (typeof window === "undefined") return

    const summary = [
      `Title: ${session.title}`,
      `Updated: ${new Date(session.updatedAt).toLocaleString()}`,
      session.memory?.startingLocation ? `Origin: ${session.memory.startingLocation}` : "",
      session.memory?.selectedDestinations?.length
        ? `Destinations: ${session.memory.selectedDestinations.map((item: any) => item.name).join(", ")}`
        : "",
      session.memory?.dateRange?.from && session.memory?.dateRange?.to
        ? `Dates: ${session.memory.dateRange.from} to ${session.memory.dateRange.to}`
        : "",
      session.memory?.budgetPreference ? `Budget: ${session.memory.budgetPreference}` : "",
      "",
      ...session.messages.map((message) => `${message.role === "user" ? "Traveler" : "Wanderly AI"}: ${message.content}`),
    ]
      .filter(Boolean)
      .join("\n")

    const blob = new Blob([summary], { type: "text/plain;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${session.title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || "wanderly-trip"}.txt`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  function continueFromContext() {
    const destinationNames = currentMemory.selectedDestinations?.map((item: any) => item.name).filter(Boolean) || []
    const prompt = destinationNames.length
      ? `Plan my trip from ${currentMemory.startingLocation || "my city"} to ${destinationNames.join(", ")}`
      : "Plan my trip using my selected Wanderly context"
    sendMessage(prompt)
  }

  function deleteSession() {
    if (!deleteSessionId) return
    const remaining = sessions.filter((session) => session.id !== deleteSessionId)
    if (remaining.length === 0) {
      const next = createSession(appMemory)
      setSessions([next])
      setActiveSessionId(next.id)
    } else {
      setSessions(remaining)
      if (activeSessionId === deleteSessionId) {
        setActiveSessionId(remaining[0].id)
      }
    }
    setDeleteSessionId("")
  }

  if (!hydrated || !activeSession) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#f5f7fb_100%)]">
        <Navigation />
        <main className="container mx-auto px-4 py-10">
          <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-10 shadow-[0_20px_60px_rgba(148,163,184,0.08)]">
            <p className="text-sm text-slate-500">Loading Wanderly AI Assistant...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.10),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(148,163,184,0.10),_transparent_28%),linear-gradient(180deg,#f8fbfd_0%,#f5f7fb_100%)]">
      <Navigation />

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Wanderly AI Assistant</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Your premium travel copilot</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
              Plan trips, compare budgets, find travel options, and get destination-aware help without leaving Wanderly.
            </p>
          </div>
          <Button variant="outline" className="rounded-full border-slate-200 bg-white/90 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="mr-2 h-4 w-4" />
            Chats
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside
            className={cn(
              "rounded-[28px] border border-slate-200/80 bg-white/82 p-4 shadow-[0_18px_50px_rgba(148,163,184,0.10)] backdrop-blur-xl lg:sticky lg:top-24 lg:block lg:h-[calc(100vh-7.5rem)]",
              "fixed inset-y-0 left-0 z-40 w-[300px] max-w-[85vw] transition-transform duration-300 lg:static lg:w-auto",
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">AI Travel Assistant</p>
                    <p className="text-xs text-slate-500">Travel-native planning workspace</p>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <Button onClick={createNewChat} className="mt-5 rounded-full bg-sky-600 text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] hover:bg-sky-700">
                <Sparkles className="mr-2 h-4 w-4" />
                New chat
              </Button>

              <div className="mt-4 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Search className="h-4 w-4" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search trip chats"
                    className="w-full bg-transparent outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200/70 bg-[linear-gradient(135deg,#fbfdff_0%,#f4f8ff_100%)] p-4">
                <p className="text-sm font-semibold text-slate-900">Saved trip memory</p>
                <p className="mt-2 text-sm text-slate-600">
                  {hasTripContext
                    ? "Wanderly will use your selected trip details to personalize this assistant."
                    : "No trip context yet. Start with a fresh travel question or select places from other pages."}
                </p>
              </div>

              <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Recent chats</p>
                <div className="space-y-2">
                  {filteredSessions.map((session) => (
                    <SidebarChatItem
                      key={session.id}
                      session={session}
                      active={session.id === activeSessionId}
                      onSelect={() => {
                        setActiveSessionId(session.id)
                        setSidebarOpen(false)
                      }}
                      onPin={() => togglePinSession(session.id)}
                      onDuplicate={() => duplicateSession(session.id)}
                      onRename={() => startRename(session)}
                      onDelete={() => setDeleteSessionId(session.id)}
                    />
                  ))}
                  {filteredSessions.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                      No chats match your search.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="rounded-[30px] border border-slate-200/80 bg-white/78 shadow-[0_22px_70px_rgba(148,163,184,0.10)] backdrop-blur-xl">
              <div className="border-b border-slate-200/70 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Active conversation</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">{activeSession.title}</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Travel planning, destination suggestions, budget guidance, hotel and flight help, and smarter next steps.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Connected to Wanderly trip context
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-full border-slate-200 bg-white/90"
                      onClick={() => togglePinSession(activeSession.id)}
                    >
                      <Pin className="mr-2 h-4 w-4" />
                      {activeSession.pinned ? "Unpin" : "Pin"}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-slate-200 bg-white/90"
                      onClick={() => duplicateSession(activeSession.id)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-slate-200 bg-white/90"
                      onClick={() => exportSession(activeSession)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </div>

                {hasTripContext ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {currentMemory.selectedDestinations?.length ? (
                      <ContextCard
                        icon={<MapPinned className="h-4 w-4" />}
                        label="Destinations"
                        value={currentMemory.selectedDestinations.map((item: any) => item.name).join(", ")}
                        tone="accent"
                      />
                    ) : null}
                    {currentMemory.dateRange?.from && currentMemory.dateRange?.to ? (
                      <ContextCard
                        icon={<CalendarDays className="h-4 w-4" />}
                        label="Travel dates"
                        value={`${currentMemory.dateRange.from} to ${currentMemory.dateRange.to}`}
                      />
                    ) : null}
                    {currentMemory.startingLocation ||
                    currentMemory.budgetPreference !== defaultTripSetupState.budgetPreference ||
                    currentMemory.travelStyle !== defaultTripSetupState.travelStyle ? (
                      <ContextCard
                        icon={<Wallet className="h-4 w-4" />}
                        label="Trip settings"
                        value={[
                          currentMemory.budgetPreference !== defaultTripSetupState.budgetPreference
                            ? `Budget: ${currentMemory.budgetPreference}`
                            : "",
                          currentMemory.startingLocation ? `Origin: ${currentMemory.startingLocation}` : "",
                          currentMemory.travelStyle !== defaultTripSetupState.travelStyle
                            ? `Style: ${currentMemory.travelStyle}`
                            : "",
                        ].filter(Boolean).join(" | ")}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div ref={scrollRef} className="max-h-[calc(100vh-21rem)] overflow-y-auto px-5 py-6 sm:px-6">
                {showOnboarding ? (
                  <div className="py-10">
                    <div className="mx-auto max-w-3xl text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#0f172a_0%,#0ea5e9_100%)] text-white shadow-[0_18px_45px_rgba(14,165,233,0.18)]">
                        <Compass className="h-7 w-7" />
                      </div>
                      <h3 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">Your AI Travel Copilot</h3>
                      <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
                        Plan trips, compare budgets, discover destinations, and get travel help instantly.
                      </p>
                    </div>

                    <div className="mx-auto mt-8 max-w-4xl">
                      {hasTripContext ? (
                        <div className="mb-4 flex justify-center">
                          <button
                            onClick={continueFromContext}
                            className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition hover:bg-sky-700"
                          >
                            Continue with selected trip
                          </button>
                        </div>
                      ) : null}
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {quickActions.map((action) => (
                          <button
                            key={action}
                            onClick={() => setInput(action)}
                            className="rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-4 text-left shadow-[0_12px_30px_rgba(148,163,184,0.06)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/70"
                          >
                            <p className="font-medium text-slate-900">{action}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {activeSession.messages.map((message) => (
                      <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                        <div className={cn("w-full max-w-[920px]", message.role === "user" ? "max-w-[720px]" : "")}>
                          <div
                            className={cn(
                              "rounded-[28px] px-5 py-4 shadow-[0_16px_40px_rgba(148,163,184,0.08)]",
                              message.role === "user"
                                ? "ml-auto border border-sky-200 bg-[linear-gradient(135deg,#eff6ff_0%,#e0f2fe_100%)] text-slate-900"
                                : "border border-slate-200/80 bg-white/92"
                            )}
                          >
                            {message.role === "assistant" ? (
                              <div className="mb-3 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#0f172a_0%,#0ea5e9_100%)] text-white">
                                  <Sparkles className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">Wanderly AI Travel Expert</p>
                                  <p className="text-xs text-slate-500">Context-aware travel planning and trip guidance</p>
                                </div>
                              </div>
                            ) : null}
                            <div className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{message.content}</div>
                          </div>

                          {message.artifacts?.distanceKm ? (
                            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                              <Route className="h-4 w-4" />
                              Total travel distance: ~{message.artifacts.distanceKm} km
                            </div>
                          ) : null}

                          {message.artifacts?.nearbyPlaces?.length ? (
                            <div className="mt-4">
                              <NearbyPlacesCard
                                placeName={message.artifacts?.weather?.place || currentMemory?.selectedDestinations?.[0]?.name}
                                items={message.artifacts.nearbyPlaces}
                              />
                            </div>
                          ) : null}
                          {message.artifacts?.weather ? <div className="mt-4"><WeatherCard weather={message.artifacts.weather} /></div> : null}
                          {message.artifacts?.budget ? <div className="mt-4"><BudgetCard budget={message.artifacts.budget} /></div> : null}
                          {message.artifacts?.destinations?.length ? <div className="mt-4"><DestinationSuggestions items={message.artifacts.destinations} /></div> : null}
                          {message.artifacts?.hotels?.length ? <div className="mt-4"><TravelOptions title="Best hotel matches" items={message.artifacts.hotels} type="hotel" /></div> : null}
                          {message.artifacts?.flights?.length ? <div className="mt-4"><TravelOptions title="Flight options" items={message.artifacts.flights} type="flight" /></div> : null}

                          {message.suggestedActions?.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {message.suggestedActions.map((action) => (
                                <button
                                  key={action}
                                  onClick={() => sendMessage(action)}
                                  className="rounded-full border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm font-medium text-sky-900 transition hover:bg-sky-100"
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {message.followUpQuestions?.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {message.followUpQuestions.map((question) => (
                                <button key={question} onClick={() => setInput(question)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">
                                  {question}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {message.actionCtas?.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {message.actionCtas.map((action) => (
                                <button key={action} onClick={() => sendMessage(action)} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
                                  {action}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}

                    {isLoading ? (
                      <div className="flex justify-start">
                        <div className="rounded-[28px] border border-slate-200/80 bg-white/92 px-5 py-4 shadow-[0_16px_40px_rgba(148,163,184,0.08)]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#0f172a_0%,#0ea5e9_100%)] text-white">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-950">{loadingLabel}</p>
                              <div className="mt-2 flex items-center gap-1">
                                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.24s]" />
                                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.12s]" />
                                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.92)_24%,rgba(255,255,255,0.98)_100%)] px-5 pb-5 pt-5 backdrop-blur-xl sm:px-6">
                <div className="mb-4 flex flex-wrap gap-2">
                  {quickActions.map((action) => (
                    <button
                      key={action}
                      onClick={() => setInput(action)}
                      className="rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70"
                    >
                      {action}
                    </button>
                  ))}
                </div>

                <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/96 shadow-[0_18px_45px_rgba(148,163,184,0.10)]">
                  <div className="flex flex-col gap-3 p-3">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5"><Compass className="h-3.5 w-3.5" /> Travel-specific guidance</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5"><Wallet className="h-3.5 w-3.5" /> Budget aware</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5"><CloudSun className="h-3.5 w-3.5" /> Weather-aware help</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5"><Clock3 className="h-3.5 w-3.5" /> Memory connected</span>
                    </div>

                    <div className="flex items-end gap-3">
                      <textarea
                        rows={1}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault()
                            sendMessage()
                          }
                        }}
                        placeholder={hasTripContext ? "Ask anything about your trip..." : "Plan my travel from Mumbai to Kerala"}
                        className="min-h-[58px] flex-1 resize-none bg-transparent px-3 py-3 text-[15px] leading-7 text-slate-800 outline-none placeholder:text-slate-400"
                      />
                      <div className="flex items-center gap-2 pb-1">
                        <button className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100">
                          <Mic className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => sendMessage()}
                          disabled={isLoading || !input.trim()}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <ArrowUp className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Dialog open={Boolean(renameSessionId)} onOpenChange={(open) => !open && setRenameSessionId("")}>
        <DialogContent className="rounded-[28px] border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>Choose a clearer name for this travel conversation.</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            className="h-11 rounded-2xl border border-slate-200 px-4 outline-none focus:border-sky-400"
            placeholder="Kerala budget trip"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-full bg-transparent" onClick={() => setRenameSessionId("")}>
              Cancel
            </Button>
            <Button className="rounded-full bg-sky-600 hover:bg-sky-700" onClick={saveRename}>
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteSessionId)} onOpenChange={(open) => !open && setDeleteSessionId("")}>
        <DialogContent className="rounded-[28px] border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>Are you sure you want to delete this chat? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-full bg-transparent" onClick={() => setDeleteSessionId("")}>
              Cancel
            </Button>
            <Button className="rounded-full bg-red-600 hover:bg-red-700" onClick={deleteSession}>
              Delete chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sidebarOpen ? <button className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close chat sidebar" /> : null}

      <ChatBubble />
    </div>
  )
}
