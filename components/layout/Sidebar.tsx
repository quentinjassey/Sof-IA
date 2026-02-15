'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FolderOpen,
  Settings as SettingsIcon,
  FileText,
  BarChart3,
  AlertTriangle,
  FileCheck,
  Clock,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const mainNavItems: NavItem[] = [
  {
    label: 'Missions',
    href: '/missions',
    icon: <FolderOpen className="h-[18px] w-[18px]" />,
  },
  {
    label: 'Parametres',
    href: '/settings',
    icon: <SettingsIcon className="h-[18px] w-[18px]" />,
  },
]

function getMissionSubNav(missionId: string): NavItem[] {
  return [
    {
      label: 'Documents',
      href: `/missions/${missionId}/documents`,
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: 'Analyse',
      href: `/missions/${missionId}/analysis`,
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      label: 'Signaux',
      href: `/missions/${missionId}/signals`,
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    {
      label: 'Livrables',
      href: `/missions/${missionId}/deliverables`,
      icon: <FileCheck className="h-4 w-4" />,
    },
    {
      label: 'Tracabilite',
      href: `/missions/${missionId}/traces`,
      icon: <Clock className="h-4 w-4" />,
    },
  ]
}

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const missionMatch = pathname.match(/\/missions\/([^/]+)/)
  const missionId = missionMatch ? missionMatch[1] : null
  const missionSubNav = missionId ? getMissionSubNav(missionId) : null

  function isActive(href: string): boolean {
    if (href === '/missions') {
      return pathname === '/missions'
    }
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-5">
        <Link href="/missions" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="font-serif text-sm text-sidebar-primary-foreground">S</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-lg tracking-tight text-sidebar-foreground">
              Sof&apos;IA
            </span>
            <span className="text-[10px] font-medium tracking-widest text-muted-foreground/50">
              v0.1
            </span>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {mainNavItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <span className={cn(
                  "transition-colors",
                  active ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                )}>
                  {item.icon}
                </span>
                {item.label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                )}
              </Link>
            )
          })}
        </div>

        {/* Mission sub-navigation */}
        {missionSubNav && (
          <div className="mt-6 animate-fade-in">
            <div className="mb-2 flex items-center gap-1.5 px-3">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                Mission en cours
              </span>
            </div>
            <div className="space-y-0.5">
              {missionSubNav.map((item, index) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                      "animate-slide-in-left opacity-0",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-primary"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <span className={cn(
                      "transition-colors",
                      active ? "text-sidebar-primary" : "text-muted-foreground/60 group-hover:text-sidebar-foreground"
                    )}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto border-t border-sidebar-border pt-4">
          <p className="px-3 text-[11px] font-medium text-muted-foreground/40">
            POC HackAudit 2026
          </p>
          <p className="mt-0.5 px-3 text-[10px] text-muted-foreground/30">
            Pre-analyse documentaire
          </p>
        </div>
      </nav>
    </>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-3.5 z-40 rounded-lg border border-border bg-card p-2 shadow-sm lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar shadow-xl transition-transform lg:hidden",
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
