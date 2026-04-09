import React from "react"
import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Wanderly - AI Travel Agent',
  description: 'Your intelligent travel companion. Plan trips, discover destinations, and book with AI-powered assistance.',
}

import { Provider } from "@/components/session-provider"
import { Toaster } from "@/components/ui/sonner"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/remixicon/3.5.0/remixicon.css" crossOrigin="" />
      </head>
      <body className="font-sans antialiased">
        <Provider>
          {children}
          <Toaster />
        </Provider>
      </body>
    </html>
  )
}
