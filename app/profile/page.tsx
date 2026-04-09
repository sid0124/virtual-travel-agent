import type { ReactNode } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Compass,
  CreditCard,
  Globe2,
  Heart,
  LifeBuoy,
  Lock,
  Luggage,
  MapPin,
  MessageSquareText,
  PlaneTakeoff,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Timer,
  UserCircle2,
  WalletCards,
} from "lucide-react"

import { authOptionsWithProviders } from "@/auth"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"

function getInitials(name?: string | null, email?: string | null) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("")
  }

  return (email?.[0] || "W").toUpperCase()
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.08)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-sky-50 text-sky-700">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
  accent = "default",
}: {
  title: string
  subtitle: string
  children: ReactNode
  accent?: "default" | "sky" | "emerald" | "amber"
}) {
  const accentStyles =
    accent === "sky"
      ? "border-sky-200/70 bg-[linear-gradient(135deg,#fbfdff_0%,#eef7ff_100%)]"
      : accent === "emerald"
        ? "border-emerald-200/70 bg-[linear-gradient(135deg,#fbfffd_0%,#eefcf4_100%)]"
        : accent === "amber"
          ? "border-amber-200/70 bg-[linear-gradient(135deg,#fffdf7_0%,#fff7ed_100%)]"
          : "border-slate-200/80 bg-white/92"

  return (
    <section className={`rounded-[32px] border p-6 shadow-[0_18px_50px_rgba(148,163,184,0.10)] ${accentStyles}`}>
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function PreferenceChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900">
      {label}
    </span>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/80 p-4">
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="mt-1 text-sm leading-6 text-slate-700">{value}</p>
      </div>
    </div>
  )
}

function ActivityItem({
  title,
  meta,
  status,
  action,
}: {
  title: string
  meta: string
  status: string
  action: string
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-[0_10px_24px_rgba(148,163,184,0.06)] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-slate-950">{title}</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {status}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{meta}</p>
      </div>
      <Button variant="outline" className="rounded-full border-slate-200 bg-white/90 text-slate-700">
        {action}
      </Button>
    </div>
  )
}

function SettingsItem({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <button className="flex w-full items-center justify-between rounded-[22px] border border-white/80 bg-white/88 p-4 text-left transition hover:border-slate-300 hover:bg-white">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-400" />
    </button>
  )
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptionsWithProviders)

  if (!session?.user) {
    redirect("/login")
  }

  const userName = session.user.name || "Wanderly Traveler"
  const userEmail = session.user.email || "traveler@wanderly.ai"
  const initials = getInitials(session.user.name, session.user.email)

  const overviewStats = [
    { label: "Trips planned", value: "08", detail: "From quick weekend breaks to multi-stop itineraries.", icon: <PlaneTakeoff className="h-5 w-5" /> },
    { label: "Destinations saved", value: "24", detail: "Dream spots, shortlist picks, and trip-ready places.", icon: <Heart className="h-5 w-5" /> },
    { label: "Budget plans", value: "11", detail: "Tracked estimates across flights, stays, and daily spends.", icon: <CircleDollarSign className="h-5 w-5" /> },
    { label: "AI travel chats", value: "36", detail: "Context-rich conversations shaping smarter journeys.", icon: <MessageSquareText className="h-5 w-5" /> },
  ]

  const quickActions = [
    { label: "Start new trip", href: "/destinations", icon: <Compass className="h-4 w-4" /> },
    { label: "Open AI assistant", href: "/ai-assistant", icon: <Sparkles className="h-4 w-4" /> },
    { label: "Continue last itinerary", href: "/itinerary", icon: <Route className="h-4 w-4" /> },
    { label: "Manage budget plans", href: "/budget", icon: <WalletCards className="h-4 w-4" /> },
  ]

  const preferenceTags = ["Luxury-light", "Couple trips", "4-7 day escapes", "Coastal stays", "Mild weather", "Direct flights", "Boutique hotels", "Food-forward travel"]

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.08),_transparent_24%),linear-gradient(180deg,#f8fbfd_0%,#f3f7fb_100%)]">
      <Navigation />

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <section className="overflow-hidden rounded-[36px] border border-slate-200/80 bg-[linear-gradient(135deg,#f8fcff_0%,#eef6ff_35%,#ffffff_100%)] shadow-[0_24px_70px_rgba(148,163,184,0.14)]">
            <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.10),_transparent_24%)]" />
              <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full border border-sky-100/70 bg-white/30" />
              <div className="absolute bottom-0 right-24 h-24 w-24 rounded-full border border-sky-100/70 bg-white/25" />
              <div className="absolute inset-y-0 right-10 hidden w-px border-l border-dashed border-sky-200/70 lg:block" />

              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-[30px] border border-white/80 bg-white/85 text-3xl font-semibold text-slate-950 shadow-[0_18px_45px_rgba(59,130,246,0.10)]">
                    {initials}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Explorer Plus
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI travel profile active
                      </span>
                    </div>
                    <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{userName}</h1>
                    <p className="mt-2 text-base text-slate-600">{userEmail}</p>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                      Planning smarter journeys with Wanderly. Your premium travel dashboard for trips, preferences, AI memory, and next-step planning.
                    </p>
                  </div>
                </div>

                <div className="relative grid gap-3 sm:grid-cols-2 lg:w-[320px]">
                  <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_16px_35px_rgba(148,163,184,0.08)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Home base</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">Mumbai</p>
                    <p className="mt-1 text-sm text-slate-600">Preferred airport: BOM</p>
                  </div>
                  <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_16px_35px_rgba(148,163,184,0.08)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Traveler level</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">Wander score 82</p>
                    <p className="mt-1 text-sm text-slate-600">Profile 70% complete</p>
                  </div>
                  <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_16px_35px_rgba(148,163,184,0.08)] sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Next journey</p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">Kerala coastal circuit</p>
                        <p className="mt-1 text-sm text-slate-600">12 days to departure • Budget mode locked</p>
                      </div>
                      <Button className="rounded-full bg-sky-600 text-white hover:bg-sky-700">Edit profile</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-white/70 bg-white/50 px-6 py-6 sm:grid-cols-2 xl:grid-cols-4 sm:px-8">
              {overviewStats.map((item) => (
                <StatCard key={item.label} icon={item.icon} label={item.label} value={item.value} detail={item.detail} />
              ))}
            </div>
          </section>

          <aside className="grid gap-6">
            <SectionCard title="Quick actions" subtitle="Jump straight into the next thing your travel workflow needs." accent="sky">
              <div className="grid gap-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center justify-between rounded-[22px] border border-white/80 bg-white/90 px-4 py-4 text-sm font-medium text-slate-800 transition hover:border-sky-200 hover:bg-sky-50/70"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">{action.icon}</span>
                      {action.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Profile completeness" subtitle="Unlock better personalization and smarter AI travel suggestions." accent="emerald">
              <div className="rounded-[24px] border border-white/80 bg-white/90 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold tracking-tight text-slate-950">70%</p>
                    <p className="mt-1 text-sm text-slate-600">Traveler profile complete</p>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Strong setup
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-[70%] rounded-full bg-[linear-gradient(90deg,#0ea5e9_0%,#10b981_100%)]" />
                </div>
                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  <p>• Add dream destinations</p>
                  <p>• Confirm home airport and home city</p>
                  <p>• Save AI travel interests</p>
                  <p>• Set booking and notification preferences</p>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard title="Travel dashboard" subtitle="A snapshot of how you travel, what you plan, and what Wanderly is learning from your activity." accent="default">
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow icon={<Globe2 className="h-5 w-5" />} label="Countries explored" value="7 countries in your planning history, with Kerala, Dubai, and Bali leading this season." />
              <DetailRow icon={<MapPin className="h-5 w-5" />} label="Cities saved" value="18 city boards saved across beach, city-break, and luxury itineraries." />
              <DetailRow icon={<Star className="h-5 w-5" />} label="Favorite trip style" value="Luxury-light escapes with strong food, scenic stays, and minimal transit friction." />
              <DetailRow icon={<Timer className="h-5 w-5" />} label="Upcoming countdown" value="12 days until your next curated trip window opens for Kerala." />
              <DetailRow icon={<CircleDollarSign className="h-5 w-5" />} label="Planned budget" value="₹4.8L estimated across active drafts, with your most recent trip trending 8% under plan." />
              <DetailRow icon={<Compass className="h-5 w-5" />} label="Most searched destination" value="Bali is currently your most compared destination against your active shortlist." />
            </div>
          </SectionCard>

          <SectionCard title="Travel preferences" subtitle="These preferences shape recommendations, budgets, itinerary pacing, and AI suggestions." accent="sky">
            <div className="grid gap-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">Preferred styles</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {preferenceTags.map((tag) => (
                    <PreferenceChip key={tag} label={tag} />
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <DetailRow icon={<Luggage className="h-5 w-5" />} label="Preferred duration" value="4 to 7 days for short-haul escapes, 8 to 12 days for flagship trips." />
                <DetailRow icon={<WalletCards className="h-5 w-5" />} label="Budget range" value="Mid-to-premium comfort, optimized for strong value rather than lowest cost." />
                <DetailRow icon={<PlaneTakeoff className="h-5 w-5" />} label="Preferred transport" value="Direct flights first, premium train or private transfer when experience matters." />
                <DetailRow icon={<Ticket className="h-5 w-5" />} label="Ideal weather" value="Mild, coastal, or breezy climates with low rain disruption for walking-heavy plans." />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard title="Assistant personalization" subtitle="See how Wanderly AI uses your saved travel profile to make planning faster and more relevant." accent="emerald">
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow icon={<Bot className="h-5 w-5" />} label="AI travel memory" value="Active and connected. The assistant remembers budget tone, preferred pacing, and your current destination priorities." />
              <DetailRow icon={<Sparkles className="h-5 w-5" />} label="Recent trip context" value="Kerala coastal circuit, premium stay preference, and weather-aware itinerary logic are currently in memory." />
              <DetailRow icon={<BriefcaseBusiness className="h-5 w-5" />} label="Planning profile" value="Food-forward, scenic, and low-friction trip planning with a premium service bias." />
              <DetailRow icon={<ShieldCheck className="h-5 w-5" />} label="Memory controls" value="Clear travel memory, refresh preferences, or tighten personalization when you want a fresh planning slate." />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">Manage AI preferences</Button>
              <Button variant="outline" className="rounded-full border-slate-200 bg-white/90">Clear travel memory</Button>
              <Button variant="outline" className="rounded-full border-slate-200 bg-white/90">Update travel interests</Button>
            </div>
          </SectionCard>

          <SectionCard title="Recent travel activity" subtitle="Your latest planning threads, trip ideas, and saved journeys live here." accent="amber">
            <div className="grid gap-4">
              <ActivityItem title="Kerala coastal circuit" meta="Updated 2 hours ago • 6 nights • Premium coastal stay shortlist • Budget aligned" status="Active trip" action="Continue trip" />
              <ActivityItem title="Bali weather in July" meta="Recent AI conversation comparing shoulder-season comfort, crowd level, and resort pricing." status="Fresh chat" action="Open assistant" />
              <ActivityItem title="Dubai Marina dining board" meta="Saved food ideas, luxury waterfront notes, and evening route suggestions from AI." status="Saved idea" action="View notes" />
              <ActivityItem title="No bookings tracked yet" meta="Connect your bookings or let Wanderly start tracking flights, stays, and transfer reminders." status="Empty state" action="Add booking" />
            </div>
          </SectionCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <SectionCard title="Travel operations hub" subtitle="Everything that makes your Wanderly account feel production-ready, secure, and useful." accent="default">
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsItem icon={<UserCircle2 className="h-5 w-5" />} title="Personal info" subtitle="Manage display name, email, traveler identity, and home city." />
              <SettingsItem icon={<Lock className="h-5 w-5" />} title="Security" subtitle="Change password, review sessions, and update account protection settings." />
              <SettingsItem icon={<Bell className="h-5 w-5" />} title="Notifications" subtitle="Tune fare alerts, weather warnings, booking reminders, and AI planning updates." />
              <SettingsItem icon={<CreditCard className="h-5 w-5" />} title="Billing & payments" subtitle="Saved payment methods, billing placeholders, and future subscription controls." />
              <SettingsItem icon={<CalendarDays className="h-5 w-5" />} title="Travel documents" subtitle="Passport reminders, visa notes, and trusted traveler placeholders." />
              <SettingsItem icon={<LifeBuoy className="h-5 w-5" />} title="Help & support" subtitle="Access support, planning help, and emergency travel assistance placeholders." />
            </div>
          </SectionCard>

          <SectionCard title="Wanderly traveler extras" subtitle="Premium travel-account touches that make the profile feel like a real planning hub." accent="sky">
            <div className="grid gap-4">
              <div className="rounded-[24px] border border-white/80 bg-white/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Dream destinations</p>
                <p className="mt-2 text-base font-semibold text-slate-950">Reykjavik, Kyoto, Amalfi Coast</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Build boards, compare with your current trip, or start a fresh AI planning thread from here.</p>
              </div>
              <div className="rounded-[24px] border border-white/80 bg-white/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Saved companions</p>
                <p className="mt-2 text-base font-semibold text-slate-950">No traveler companions added yet</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Add family, partner, or trusted traveler details for faster group planning and bookings.</p>
              </div>
              <div className="rounded-[24px] border border-white/80 bg-white/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Loyalty tier</p>
                <p className="mt-2 text-base font-semibold text-slate-950">Explorer Plus</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Priority AI planning, premium itinerary polish, and saved profile benefits ready for future expansion.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  )
}
