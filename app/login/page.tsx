"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import {
    ArrowRight,
    CheckCircle2,
    Eye,
    EyeOff,
    Globe2,
    LoaderCircle,
    LockKeyhole,
    Mail,
    MapPinned,
    Plane,
    ShieldCheck,
    Sparkles,
    UserRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordRule = /^(?=.*[A-Z])(?=.*\d).{8,}$/
const displayFont = "Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif"

type FeedbackState = {
    tone: "error" | "success"
    message: string
} | null

const heroHighlights = [
    {
        icon: Sparkles,
        eyebrow: "Plan smarter",
        title: "Your AI travel copilot",
        description: "Keep itineraries, bookings, and destination ideas in one calm, guided workspace.",
    },
    {
        icon: Globe2,
        eyebrow: "Travel with context",
        title: "Trips that stay organized",
        description: "Move from inspiration to confirmed plans without losing details across tabs and tools.",
    },
    {
        icon: ShieldCheck,
        eyebrow: "Protected access",
        title: "Designed for trusted sign-in",
        description: "Clear account states, secure access, and a focused interface built for real trip management.",
    },
]

function getInputStateClass(state: boolean | null) {
    if (state === true) {
        return "border-emerald-300/90 bg-emerald-50/70 text-slate-950 focus-visible:ring-emerald-200/80"
    }

    if (state === false) {
        return "border-rose-300/90 bg-rose-50/70 text-slate-950 focus-visible:ring-rose-200/90"
    }

    return "border-slate-200/90 bg-white/92 text-slate-950 hover:border-slate-300 focus-visible:ring-sky-200/80"
}

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true)
    const [loading, setLoading] = useState(false)
    const [rememberMe, setRememberMe] = useState(true)
    const [feedback, setFeedback] = useState<FeedbackState>(null)
    const [showLoginPassword, setShowLoginPassword] = useState(false)
    const [showRegisterPassword, setShowRegisterPassword] = useState(false)
    const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()

    const callbackUrl = searchParams.get("callbackUrl") || "/"

    const [loginData, setLoginData] = useState({ email: "", password: "" })
    const [registerData, setRegisterData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    })

    const registerEmailState =
        registerData.email.length === 0 ? null : emailRule.test(registerData.email.trim().toLowerCase())
    const registerPasswordState = registerData.password.length === 0 ? null : passwordRule.test(registerData.password)
    const registerConfirmState =
        registerData.confirmPassword.length === 0
            ? null
            : registerData.password.length > 0 && registerData.password === registerData.confirmPassword

    const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setFeedback(null)

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email: loginData.email.trim().toLowerCase(),
                password: loginData.password,
                callbackUrl,
            })

            if (result?.error) {
                setFeedback({ tone: "error", message: "Invalid email or password. Please try again." })
                return
            }

            router.push(result?.url || callbackUrl)
            router.refresh()
        } catch {
            setFeedback({ tone: "error", message: "We could not sign you in right now. Please try again." })
        } finally {
            setLoading(false)
        }
    }

    const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setFeedback(null)

        if (registerData.password !== registerData.confirmPassword) {
            setFeedback({ tone: "error", message: "Passwords do not match yet. Please review them and try again." })
            setLoading(false)
            return
        }

        if (!passwordRule.test(registerData.password)) {
            setFeedback({
                tone: "error",
                message: "Password must be at least 8 characters and include 1 uppercase letter and 1 number.",
            })
            setLoading(false)
            return
        }

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: registerData.name.trim(),
                    email: registerData.email.trim().toLowerCase(),
                    password: registerData.password,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                const detailMessage = Array.isArray(data?.details) ? data.details[0]?.message : undefined
                setFeedback({
                    tone: "error",
                    message: detailMessage || data.error || "Registration failed. Please try again.",
                })
                return
            }

            setIsLogin(true)
            setLoginData({
                email: registerData.email.trim().toLowerCase(),
                password: registerData.password,
            })
            setFeedback({
                tone: "success",
                message: "Account created. Sign in to continue planning, booking, and exploring with Wanderly.",
            })
        } catch {
            setFeedback({ tone: "error", message: "We could not create your account right now. Please try again." })
        } finally {
            setLoading(false)
        }
    }

    const activeTitle = isLogin ? "Welcome back" : "Create your Wanderly account"
    const activeDescription = isLogin
        ? "Access your trips, bookings, itinerary, and AI travel assistant from one secure dashboard."
        : "Start planning, booking, and organizing travel with a polished workspace designed for every journey."

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
            <Image
                src="/assets/img/desktop-wallpaper-travel-mobile-global.jpg"
                alt="Travel background"
                fill
                priority
                className="object-cover object-center brightness-[0.42] saturate-[0.78]"
            />

            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(2,12,27,0.82)_8%,rgba(7,20,43,0.72)_42%,rgba(15,23,42,0.92)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_82%_80%,rgba(245,158,11,0.14),transparent_24%),radial-gradient(circle_at_64%_28%,rgba(255,255,255,0.08),transparent_22%)]" />
            <div className="absolute right-[12%] top-1/2 hidden h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-sky-300/10 blur-3xl lg:block" />
            <div className="absolute left-[10%] top-[16%] hidden h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl lg:block" />

            <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
                <div className="grid w-full overflow-hidden rounded-[32px] border border-white/12 bg-white/6 shadow-[0_32px_120px_rgba(2,8,23,0.52)] backdrop-blur-sm lg:grid-cols-[1.08fr_0.92fr]">
                    <section className="relative hidden min-h-[760px] overflow-hidden border-r border-white/10 px-10 py-10 lg:flex lg:flex-col lg:justify-between">
                        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.06),transparent_36%,rgba(148,163,184,0.08)_100%)]" />

                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-3 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm text-white/88 backdrop-blur-md">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/14 text-sky-100 ring-1 ring-white/15">
                                    <Plane className="h-4 w-4 -rotate-12" />
                                </span>
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">Wanderly</p>
                                    <p className="text-sm font-medium text-white">Plan, book, and explore smarter</p>
                                </div>
                            </div>

                            <div className="mt-12 max-w-xl">
                                <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-100/70">
                                    Premium travel workspace
                                </p>
                                <h1
                                    className="mt-6 text-5xl leading-[1.05] tracking-[-0.04em] text-white"
                                    style={{ fontFamily: displayFont }}
                                >
                                    Sign in to a calmer, more trusted way to manage every trip.
                                </h1>
                                <p className="mt-6 max-w-lg text-base leading-7 text-white/76">
                                    Wanderly brings together bookings, itineraries, destination research, and AI travel
                                    guidance in a focused product experience built for real travelers.
                                </p>
                            </div>

                            <div className="mt-12 grid gap-4">
                                {heroHighlights.map(({ icon: Icon, eyebrow, title, description }) => (
                                    <div
                                        key={title}
                                        className="flex items-start gap-4 rounded-[24px] border border-white/10 bg-white/[0.075] p-5 backdrop-blur-md transition duration-300 hover:bg-white/[0.11]"
                                    >
                                        <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-sky-400/14 text-sky-100">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/60">
                                                {eyebrow}
                                            </p>
                                            <p className="mt-2 text-lg font-semibold text-white">{title}</p>
                                            <p className="mt-1.5 text-sm leading-6 text-white/68">{description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative z-10 flex items-center justify-between gap-6 rounded-[28px] border border-white/10 bg-slate-950/28 px-6 py-5 backdrop-blur-md">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
                                    Secure sign-in
                                </p>
                                <p className="mt-2 text-base font-medium text-white/88">
                                    Protected access for your trips, saved places, and booking flow.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/22 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100">
                                <ShieldCheck className="h-4 w-4" />
                                Private and protected
                            </div>
                        </div>
                    </section>

                    <section className="relative min-h-screen px-4 py-5 sm:px-6 sm:py-8 lg:min-h-[760px] lg:px-8 lg:py-10">
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.02))]" />
                        <div className="absolute inset-x-10 top-12 h-44 rounded-full bg-white/28 blur-3xl" />

                        <div className="relative z-10 mx-auto flex h-full max-w-xl items-center">
                            <div className="w-full rounded-[28px] border border-white/70 bg-white/[0.88] p-5 text-slate-950 shadow-[0_32px_90px_rgba(15,23,42,0.22)] backdrop-blur-2xl sm:rounded-[32px] sm:p-8">
                                <div className="flex flex-col gap-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3 lg:hidden">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_16px_34px_rgba(15,23,42,0.22)]">
                                                <Plane className="h-5 w-5 -rotate-12" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                                                    Wanderly
                                                </p>
                                                <p className="text-sm text-slate-500">Your AI travel copilot</p>
                                            </div>
                                        </div>

                                        <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 sm:inline-flex">
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Secure access
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-slate-100 p-1.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsLogin(true)
                                                setFeedback(null)
                                            }}
                                            className={cn(
                                                "rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200",
                                                isLogin
                                                    ? "bg-white text-slate-950 shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
                                                    : "text-slate-500 hover:text-slate-700",
                                            )}
                                        >
                                            Sign in
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsLogin(false)
                                                setFeedback(null)
                                            }}
                                            className={cn(
                                                "rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200",
                                                !isLogin
                                                    ? "bg-white text-slate-950 shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
                                                    : "text-slate-500 hover:text-slate-700",
                                            )}
                                        >
                                            Create account
                                        </button>
                                    </div>

                                    <div className="animate-[zoom-in-50_500ms_ease-out]">
                                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                                            {isLogin ? "Member sign-in" : "New traveler"}
                                        </p>
                                        <h2
                                            className="mt-3 text-4xl leading-tight tracking-[-0.04em] text-slate-950"
                                            style={{ fontFamily: displayFont }}
                                        >
                                            {activeTitle}
                                        </h2>
                                        <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                                            {activeDescription}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                        <div className="flex items-center gap-2 font-medium text-slate-700">
                                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                            Secure sign-in for your trips, bookings, and travel plans.
                                        </div>
                                        <div className="hidden h-4 w-px bg-slate-200 sm:block" />
                                        <div className="inline-flex items-center gap-2 text-slate-500">
                                            <MapPinned className="h-4 w-4 text-sky-600" />
                                            Built for premium travel planning
                                        </div>
                                    </div>

                                    {feedback && (
                                        <div
                                            aria-live="polite"
                                            className={cn(
                                                "flex items-start gap-3 rounded-[22px] border px-4 py-3 text-sm",
                                                feedback.tone === "error"
                                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                                            )}
                                        >
                                            <CheckCircle2
                                                className={cn(
                                                    "mt-0.5 h-4 w-4 shrink-0",
                                                    feedback.tone === "error" && "text-rose-500",
                                                )}
                                            />
                                            <span>{feedback.message}</span>
                                        </div>
                                    )}

                                    {isLogin ? (
                                        <form onSubmit={handleLoginSubmit} className="space-y-4">
                                            <div className="space-y-2">
                                                <label htmlFor="login-email" className="text-sm font-semibold text-slate-700">
                                                    Email address
                                                </label>
                                                <div className="relative">
                                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        id="login-email"
                                                        type="email"
                                                        autoComplete="email"
                                                        placeholder="name@company.com"
                                                        value={loginData.email}
                                                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                                        className={cn(
                                                            "h-14 rounded-[18px] border pl-12 pr-4 text-[15px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all duration-200 placeholder:text-slate-400 focus-visible:ring-[3px] focus-visible:ring-offset-0",
                                                            getInputStateClass(
                                                                loginData.email.length === 0
                                                                    ? null
                                                                    : emailRule.test(loginData.email.trim().toLowerCase()),
                                                            ),
                                                        )}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label htmlFor="login-password" className="text-sm font-semibold text-slate-700">
                                                    Password
                                                </label>
                                                <div className="relative">
                                                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        id="login-password"
                                                        type={showLoginPassword ? "text" : "password"}
                                                        autoComplete={rememberMe ? "current-password" : "off"}
                                                        placeholder="Enter your password"
                                                        value={loginData.password}
                                                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                                        className="h-14 rounded-[18px] border border-slate-200/90 bg-white/92 pl-12 pr-12 text-[15px] font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus-visible:ring-[3px] focus-visible:ring-sky-200/80 focus-visible:ring-offset-0"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowLoginPassword((value) => !value)}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                                                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                                                    >
                                                        {showLoginPassword ? (
                                                            <EyeOff className="h-5 w-5" />
                                                        ) : (
                                                            <Eye className="h-5 w-5" />
                                                        )}
                                                    </button>
                                                </div>
                                                <p className="text-xs leading-5 text-slate-500">
                                                    Secure access to your trips, saved stays, and booking workflow.
                                                </p>
                                            </div>

                                            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                                                <label
                                                    htmlFor="remember-device"
                                                    className="flex cursor-pointer items-center gap-3 text-sm text-slate-600"
                                                >
                                                    <Checkbox
                                                        id="remember-device"
                                                        checked={rememberMe}
                                                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                                                        className="h-4 w-4 rounded-[5px] border-slate-300 data-[state=checked]:border-slate-950 data-[state=checked]:bg-slate-950"
                                                    />
                                                    Keep me signed in on this device
                                                </label>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setFeedback({
                                                            tone: "error",
                                                            message:
                                                                "Password recovery is not configured yet. Please use your existing password or register a new account.",
                                                        })
                                                    }
                                                    className="text-sm font-semibold text-slate-700 transition hover:text-sky-700"
                                                >
                                                    Forgot password?
                                                </button>
                                            </div>

                                            <Button
                                                type="submit"
                                                disabled={loading}
                                                className="group h-14 w-full rounded-[18px] bg-slate-950 text-base font-semibold text-white shadow-[0_24px_50px_rgba(15,23,42,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-900 disabled:translate-y-0 disabled:bg-slate-400"
                                            >
                                                {loading ? (
                                                    <>
                                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                                        Signing in...
                                                    </>
                                                ) : (
                                                    <>
                                                        Sign In
                                                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                                                    </>
                                                )}
                                            </Button>

                                            <p className="text-center text-sm text-slate-600">
                                                New to Wanderly?{" "}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsLogin(false)
                                                        setFeedback(null)
                                                    }}
                                                    className="font-semibold text-slate-950 transition hover:text-sky-700"
                                                >
                                                    Create your account
                                                </button>
                                            </p>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleRegisterSubmit} className="space-y-4">
                                            <div className="space-y-2">
                                                <label htmlFor="register-name" className="text-sm font-semibold text-slate-700">
                                                    Full name
                                                </label>
                                                <div className="relative">
                                                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        id="register-name"
                                                        type="text"
                                                        autoComplete="name"
                                                        placeholder="Enter your full name"
                                                        value={registerData.name}
                                                        onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                                                        className="h-14 rounded-[18px] border border-slate-200/90 bg-white/92 pl-12 pr-4 text-[15px] font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus-visible:ring-[3px] focus-visible:ring-sky-200/80 focus-visible:ring-offset-0"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label htmlFor="register-email" className="text-sm font-semibold text-slate-700">
                                                    Email address
                                                </label>
                                                <div className="relative">
                                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        id="register-email"
                                                        type="email"
                                                        autoComplete="email"
                                                        placeholder="name@company.com"
                                                        value={registerData.email}
                                                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                                        className={cn(
                                                            "h-14 rounded-[18px] border pl-12 pr-12 text-[15px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all duration-200 placeholder:text-slate-400 focus-visible:ring-[3px] focus-visible:ring-offset-0",
                                                            getInputStateClass(registerEmailState),
                                                        )}
                                                        required
                                                    />
                                                    {registerEmailState === true && (
                                                        <CheckCircle2 className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500" />
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <label
                                                        htmlFor="register-password"
                                                        className="text-sm font-semibold text-slate-700"
                                                    >
                                                        Password
                                                    </label>
                                                    <div className="relative">
                                                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                                        <Input
                                                            id="register-password"
                                                            type={showRegisterPassword ? "text" : "password"}
                                                            autoComplete="new-password"
                                                            placeholder="Create password"
                                                            value={registerData.password}
                                                            onChange={(e) =>
                                                                setRegisterData({ ...registerData, password: e.target.value })
                                                            }
                                                            className={cn(
                                                                "h-14 rounded-[18px] border pl-12 pr-12 text-[15px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all duration-200 placeholder:text-slate-400 focus-visible:ring-[3px] focus-visible:ring-offset-0",
                                                                getInputStateClass(registerPasswordState),
                                                            )}
                                                            required
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowRegisterPassword((value) => !value)}
                                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                                                            aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                                                        >
                                                            {showRegisterPassword ? (
                                                                <EyeOff className="h-5 w-5" />
                                                            ) : (
                                                                <Eye className="h-5 w-5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label
                                                        htmlFor="register-confirm-password"
                                                        className="text-sm font-semibold text-slate-700"
                                                    >
                                                        Confirm password
                                                    </label>
                                                    <div className="relative">
                                                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                                        <Input
                                                            id="register-confirm-password"
                                                            type={showRegisterConfirmPassword ? "text" : "password"}
                                                            autoComplete="new-password"
                                                            placeholder="Confirm password"
                                                            value={registerData.confirmPassword}
                                                            onChange={(e) =>
                                                                setRegisterData({
                                                                    ...registerData,
                                                                    confirmPassword: e.target.value,
                                                                })
                                                            }
                                                            className={cn(
                                                                "h-14 rounded-[18px] border pl-12 pr-12 text-[15px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all duration-200 placeholder:text-slate-400 focus-visible:ring-[3px] focus-visible:ring-offset-0",
                                                                getInputStateClass(registerConfirmState),
                                                            )}
                                                            required
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setShowRegisterConfirmPassword((value) => !value)
                                                            }
                                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                                                            aria-label={
                                                                showRegisterConfirmPassword
                                                                    ? "Hide password confirmation"
                                                                    : "Show password confirmation"
                                                            }
                                                        >
                                                            {showRegisterConfirmPassword ? (
                                                                <EyeOff className="h-5 w-5" />
                                                            ) : (
                                                                <Eye className="h-5 w-5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                                                Use at least 8 characters, including 1 uppercase letter and 1 number, for
                                                a stronger and more secure account.
                                            </div>

                                            <Button
                                                type="submit"
                                                disabled={loading}
                                                className="group h-14 w-full rounded-[18px] bg-slate-950 text-base font-semibold text-white shadow-[0_24px_50px_rgba(15,23,42,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-900 disabled:translate-y-0 disabled:bg-slate-400"
                                            >
                                                {loading ? (
                                                    <>
                                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                                        Creating account...
                                                    </>
                                                ) : (
                                                    <>
                                                        Continue
                                                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                                                    </>
                                                )}
                                            </Button>

                                            <p className="text-center text-sm text-slate-600">
                                                Already have an account?{" "}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsLogin(true)
                                                        setFeedback(null)
                                                    }}
                                                    className="font-semibold text-slate-950 transition hover:text-sky-700"
                                                >
                                                    Sign in instead
                                                </button>
                                            </p>
                                        </form>
                                    )}

                                    <div className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white">
                                                <ShieldCheck className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900">Private and protected</p>
                                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                                    Your account access is secured for trip planning, bookings, and saved
                                                    preferences.
                                                </p>
                                            </div>
                                        </div>

                                        <Link
                                            href="/"
                                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-sky-700"
                                        >
                                            Explore Wanderly
                                            <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}
