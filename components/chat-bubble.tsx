"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MessageSquare, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ChatBubbleProps = {
  inline?: boolean
  className?: string
}

export function ChatBubble({ inline = false, className }: ChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn(inline ? "relative z-50" : "fixed bottom-6 right-6 z-50", className)}>
      {isOpen && (
        <div className="mb-4 w-80 rounded-2xl border bg-card p-4 shadow-xl animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">AI Travel Assistant</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Hi! I&apos;m your AI travel companion. Ready to help you plan your perfect trip?
          </p>
          <Link href="/ai-assistant">
            <Button className="w-full">Start Planning</Button>
          </Link>
        </div>
      )}
      
      <Button
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105",
          isOpen && "rotate-0"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    </div>
  )
}
