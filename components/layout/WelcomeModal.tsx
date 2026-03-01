'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Sparkles,
  ArrowRight,
  Shield,
  FileSearch,
  UserCheck,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

const WELCOME_DISMISSED_KEY = 'sofia-welcome-dismissed'

export default function WelcomeModal() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const dismissed = sessionStorage.getItem(WELCOME_DISMISSED_KEY)
    if (!dismissed) {
      const timer = setTimeout(() => setIsOpen(true), 400)
      return () => clearTimeout(timer)
    }
  }, [])

  function handleClose() {
    sessionStorage.setItem(WELCOME_DISMISSED_KEY, '1')
    setIsOpen(false)
  }

  function handleOpenGuide() {
    sessionStorage.setItem(WELCOME_DISMISSED_KEY, '1')
    setIsOpen(false)
    router.push('/guide')
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      showCloseButton
      closeOnOverlay={false}
    >
      <div className="space-y-6">
        {/* Header with branding */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-serif text-2xl tracking-tight text-foreground">
            Bienvenue sur Sof&apos;IA
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Proof of Concept — HackAudit 2026
          </p>
        </div>

        {/* Context */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-sm leading-relaxed text-foreground/90">
            Sof&apos;IA est un outil d&apos;aide à la <strong>pré-analyse documentaire</strong> destiné
            aux commissaires aux comptes. Elle automatise le rapprochement entre écritures comptables,
            pièces justificatives et journaux pour identifier les zones nécessitant une attention particulière.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Ce POC illustre trois cas d&apos;usage concrets : le sondage sur le chiffre d&apos;affaires,
            le contrôle du cut-off et le pointage des états financiers.
          </p>
        </div>

        {/* Key principles */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileSearch className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Pré-analyse</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Signaux documentaires factuels et traçables
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Validation humaine</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Le CAC reste seul décisionnaire
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Traçabilité</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Journal immuable conforme NEP 230
              </p>
            </div>
          </div>
        </div>

        {/* Info notice about analysis duration */}
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
          <p className="text-xs leading-relaxed text-warning-foreground">
            <strong>Note :</strong> Les analyses documentaires sont réalisées par intelligence artificielle
            et peuvent prendre <strong>quelques minutes</strong> selon le volume de documents.
            Vous serez informé de l&apos;avancement en temps réel.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={handleClose}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Fermer et commencer
          </button>
          <button
            onClick={handleOpenGuide}
            className={cn(
              'group flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all',
              'bg-primary text-primary-foreground shadow-sm shadow-primary/20',
              'hover:shadow-md hover:shadow-primary/25 hover:brightness-110'
            )}
          >
            <BookOpen className="h-4 w-4" />
            Consulter le guide d&apos;utilisation
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </Modal>
  )
}
