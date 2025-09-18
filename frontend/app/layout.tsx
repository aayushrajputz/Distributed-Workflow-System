import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { headers } from "next/headers"
import "./globals.css"
import { ReactQueryProvider } from "@/lib/react-query"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { NotificationProvider } from "@/contexts/notification-context"
import { ApiKeyProvider } from "@/contexts/api-key-context"
import { NonceProvider } from "@/contexts/nonce-context"
import { ErrorBoundary } from "@/components/error-boundary"
import { CSP } from "@/lib/security"

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
  // Read the nonce from headers during SSR
  const headersList = headers();
  const nonce = headersList.get('x-csp-nonce') || '';

  // Generate CSP policy string for meta tag fallback
  const cspPolicy = nonce ? CSP.generatePolicyString(nonce) : '';

  return (
    <html lang="en">
      <head>
        {/* CSP meta tag as fallback */}
        {cspPolicy && (
          <meta httpEquiv="Content-Security-Policy" content={cspPolicy} />
        )}
        <style nonce={nonce}>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <ErrorBoundary>
          <NonceProvider nonce={nonce}>
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
          </NonceProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
