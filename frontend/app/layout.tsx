import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { ReactQueryProvider } from "@/lib/react-query"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { NotificationProvider } from "@/contexts/notification-context"
import { ApiKeyProvider } from "@/contexts/api-key-context"

export const metadata: Metadata = {
  title: "Workflow Management System",
  description: "Distributed Workflow Management System",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <ReactQueryProvider>
          <NotificationProvider>
            <ApiKeyProvider>
              {children}
              <Toaster />
              <SonnerToaster
                position="top-right"
                richColors
                closeButton
                duration={4000}
              />
            </ApiKeyProvider>
          </NotificationProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
