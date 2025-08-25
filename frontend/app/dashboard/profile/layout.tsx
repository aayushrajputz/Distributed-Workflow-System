"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { User, Lock, Mail, SettingsIcon } from "lucide-react"

const profileNavigation = [
  { name: "Profile Details", href: "/dashboard/profile", icon: User },
  { name: "Security", href: "/dashboard/profile/security", icon: Lock },
  { name: "Email Settings", href: "/dashboard/profile/email", icon: Mail },
  { name: "Preferences", href: "/dashboard/profile/preferences", icon: SettingsIcon },
]

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-border bg-card">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">Profile Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
        </div>
        <nav className="p-4 space-y-2">
          {profileNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
