'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { Settings, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import AppBreadcrumb from './AppBreadcrumb'

interface ProfileData {
  name: string
  inscription_cncc: string | null
  cabinet: string
}

export default function Header() {
  const [profile, setProfile] = useState<ProfileData | null>(null)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/profile')
        if (res.ok) {
          const json = await res.json()
          if (json.data) {
            setProfile(json.data)
          }
        }
      } catch {
        // Profile may not exist yet
      }
    }
    fetchProfile()
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      {/* Breadcrumb navigation */}
      <Suspense fallback={<div className="h-5" />}>
        <AppBreadcrumb />
      </Suspense>

      <div className="flex items-center gap-3">
        {profile && (
          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-secondary-foreground">
                {profile.name}
              </span>
            </div>
            {profile.inscription_cncc && (
              <span className="text-xs font-mono tracking-wide text-muted-foreground">
                {profile.inscription_cncc}
              </span>
            )}
          </div>
        )}

        <div className="h-5 w-px bg-border" />

        <Link
          href="/settings"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
          title="Paramètres"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  )
}
