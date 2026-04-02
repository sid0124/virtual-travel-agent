import { getServerSession } from "next-auth/next"
import { authOptionsWithProviders } from "@/auth"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const session = await getServerSession(authOptionsWithProviders)

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>
      <div className="bg-card border rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold uppercase">
            {session.user.name?.[0] || session.user.email?.[0] || "U"}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{session.user.name || "User"}</h2>
            <p className="text-muted-foreground">{session.user.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">User ID</label>
            <p className="font-mono text-sm">{session.user.id || "N/A"}</p>
          </div>
          {/* Add more profile fields here if needed */}
        </div>
      </div>
    </div>
  )
}
