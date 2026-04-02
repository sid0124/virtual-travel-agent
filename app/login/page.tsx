"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import Image from "next/image"

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const router = useRouter()

    // Login Form State
    const [loginData, setLoginData] = useState({ email: "", password: "" })

    // Register Form State
    const [registerData, setRegisterData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    })

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email: loginData.email.trim().toLowerCase(),
                password: loginData.password,
            })

            if (result?.error) {
                setError("Invalid email or password")
            } else {
                router.push("/")
                router.refresh()
            }
        } catch (err) {
            setError("An error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        if (registerData.password !== registerData.confirmPassword) {
            setError("Passwords do not match")
            setLoading(false)
            return
        }

        try {
            const passwordRule = /^(?=.*[A-Z])(?=.*\d).{8,}$/
            if (!passwordRule.test(registerData.password)) {
                setError("Password must be at least 8 characters and include 1 uppercase letter and 1 number")
                setLoading(false)
                return
            }

            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: registerData.name.trim(),
                    email: registerData.email.trim().toLowerCase(),
                    password: registerData.password,
                }),
            })

            if (res.ok) {
                // Auto login after register or switch to login
                setIsLogin(true)
                setLoginData({ email: registerData.email, password: registerData.password })
                setError("")
                alert("Registration successful! Please login.")
            } else {
                const data = await res.json()
                const detailMessage = Array.isArray(data?.details) ? data.details[0]?.message : undefined
                setError(detailMessage || data.error || "Registration failed")
            }
        } catch (err) {
            setError("An error occurred during registration.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center font-sans">
            <Image
                src="/assets/img/desktop-wallpaper-travel-mobile-global.jpg"
                alt="Travel background"
                fill
                className="object-cover absolute inset-0 z-0"
                priority
            />

            <div className="relative z-10 w-full max-w-[400px] mx-4">
                {isLogin ? (
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-[2rem] text-white shadow-lg">
                        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                            <h1 className="text-3xl font-semibold text-center mb-4">Login</h1>

                            {error && <div className="text-red-300 text-sm text-center bg-red-900/40 p-2 rounded">{error}</div>}

                            <div className="relative">
                                <input
                                    type="email"
                                    placeholder="Email ID"
                                    required
                                    className="w-full bg-white/10 border border-white/40 rounded-full px-5 py-3 text-white placeholder-white/70 outline-none focus:bg-white/20 transition-all font-medium"
                                    value={loginData.email}
                                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                />
                                <i className="ri-mail-fill absolute right-5 top-1/2 -translate-y-1/2"></i>
                            </div>

                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="Password"
                                    required
                                    className="w-full bg-white/10 border border-white/40 rounded-full px-5 py-3 text-white placeholder-white/70 outline-none focus:bg-white/20 transition-all font-medium"
                                    value={loginData.password}
                                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                />
                                <i className="ri-lock-2-fill absolute right-5 top-1/2 -translate-y-1/2"></i>
                            </div>
                            <p className="text-xs text-white/80 px-2 -mt-2">
                                Use at least 8 characters, including 1 uppercase letter and 1 number.
                            </p>

                            <div className="flex justify-between items-center text-sm px-2">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="user-check" className="accent-white h-4 w-4" />
                                    <label htmlFor="user-check" className="cursor-pointer">Remember me</label>
                                </div>
                                <a href="#" className="hover:underline">Forgot Password?</a>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-[#2c2c2c] font-semibold rounded-full py-3 mt-2 hover:bg-white/90 transition-all disabled:opacity-70"
                            >
                                {loading ? "Logging in..." : "Login"}
                            </button>

                            <div className="text-center mt-4">
                                Don't have an account?
                                <button type="button" onClick={() => setIsLogin(false)} className="font-semibold hover:underline ml-1">
                                    Register
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-[2rem] text-white shadow-lg">
                        <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
                            <h1 className="text-3xl font-semibold text-center mb-4">Register</h1>

                            {error && <div className="text-red-300 text-sm text-center bg-red-900/40 p-2 rounded">{error}</div>}

                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    required
                                    className="w-full bg-white/10 border border-white/40 rounded-full px-5 py-3 text-white placeholder-white/70 outline-none focus:bg-white/20 transition-all font-medium"
                                    value={registerData.name}
                                    onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                                />
                                <i className="ri-user-fill absolute right-5 top-1/2 -translate-y-1/2"></i>
                            </div>

                            <div className="relative">
                                <input
                                    type="email"
                                    placeholder="Email ID"
                                    required
                                    className="w-full bg-white/10 border border-white/40 rounded-full px-5 py-3 text-white placeholder-white/70 outline-none focus:bg-white/20 transition-all font-medium"
                                    value={registerData.email}
                                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                />
                                <i className="ri-mail-fill absolute right-5 top-1/2 -translate-y-1/2"></i>
                            </div>

                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="Password"
                                    required
                                    className="w-full bg-white/10 border border-white/40 rounded-full px-5 py-3 text-white placeholder-white/70 outline-none focus:bg-white/20 transition-all font-medium"
                                    value={registerData.password}
                                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                                />
                                <i className="ri-lock-2-fill absolute right-5 top-1/2 -translate-y-1/2"></i>
                            </div>

                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="Confirm Password"
                                    required
                                    className="w-full bg-white/10 border border-white/40 rounded-full px-5 py-3 text-white placeholder-white/70 outline-none focus:bg-white/20 transition-all font-medium"
                                    value={registerData.confirmPassword}
                                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                                />
                                <i className="ri-lock-password-fill absolute right-5 top-1/2 -translate-y-1/2"></i>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-[#2c2c2c] font-semibold rounded-full py-3 mt-2 hover:bg-white/90 transition-all disabled:opacity-70"
                            >
                                {loading ? "Registering..." : "Register"}
                            </button>

                            <div className="text-center mt-4">
                                Already have an account?
                                <button type="button" onClick={() => setIsLogin(true)} className="font-semibold hover:underline ml-1">
                                    Login
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
