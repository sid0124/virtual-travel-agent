"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Plane,
  Hotel,
  MapPin,
  MessageSquare,
  Calendar,
  Wallet,
  Cloud,
  User,
  Menu,
  X,
  LogOut,
  LogIn,
} from "lucide-react"
import { useSession, signOut } from "next-auth/react"

function AuthButtons() {
  const { data: session } = useSession()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.replace("/login")
    router.refresh()
  }

  if (session) {
    return (
      <div className="hidden md:flex items-center gap-2">
        <Link href="/profile">
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <User className="h-4 w-4" />
            <span className="hidden lg:inline">Profile</span>
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">Logout</span>
        </Button>
      </div>
    )
  }

  return (
    <Link href="/login" className="hidden md:block">
      <Button variant="default" size="sm" className="gap-2">
        <LogIn className="h-4 w-4" />
        <span>Login</span>
      </Button>
    </Link>
  )
}

const navItems = [
  { href: "/", label: "Home", icon: Plane },
  { href: "/destinations", label: "Destinations", icon: MapPin },
  { href: "/ai-assistant", label: "AI Assistant", icon: MessageSquare },
  { href: "/itinerary", label: "Itinerary", icon: Calendar },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/booking", label: "Booking", icon: Hotel },
  { href: "/weather", label: "Weather", icon: Cloud },
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Plane className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">Wanderly</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-2",
                    isActive && "bg-primary/10 text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Button>
              </Link>
            )
          })}
        </div>

        {/* Profile & Mobile Toggle */}
        <div className="flex items-center gap-2">
          <AuthButtons />

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t bg-card md:hidden">
          <div className="container mx-auto space-y-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive && "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
            <Link href="/profile" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full justify-start gap-3 bg-transparent">
                <User className="h-5 w-5" />
                Profile
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
