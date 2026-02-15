'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ActivatePage() {
  const router = useRouter()
  const [licenseKey, setLicenseKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleActivate = useCallback(async () => {
    const trimmed = licenseKey.trim()
    if (!trimmed) {
      setError('Veuillez saisir votre cle de licence.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: trimmed }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        const errorMessages: Record<string, string> = {
          INVALID_KEY: 'Cle de licence invalide. Verifiez votre saisie.',
          EXPIRED: 'Cette licence a expire. Contactez votre administrateur.',
          REVOKED: 'Cette licence a ete revoquee. Contactez votre administrateur.',
        }
        setError(
          errorMessages[json.code] ||
            json.error ||
            'Une erreur est survenue lors de la validation.'
        )
        return
      }

      // Check if profile exists
      const profileRes = await fetch('/api/profile')
      if (profileRes.ok) {
        const profileJson = await profileRes.json()
        if (profileJson.data) {
          router.push('/missions')
          return
        }
      }
      router.push('/setup')
    } catch {
      setError(
        'Impossible de contacter le serveur. Verifiez votre connexion.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [licenseKey, router])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) {
        handleActivate()
      }
    },
    [handleActivate, isLoading]
  )

  return (
    <div className="animate-fade-in rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-serif text-xl text-card-foreground">
          Activez votre licence
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Saisissez la cle fournie pour acceder a Sof&apos;IA
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label
            htmlFor="license-key"
            className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Cle de licence
          </label>
          <input
            id="license-key"
            type="text"
            value={licenseKey}
            onChange={(e) => {
              setLicenseKey(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="DEMO-SOFI-2026-XXXX"
            className={cn(
              "block w-full rounded-xl border bg-background px-4 py-3 text-sm font-mono tracking-wider text-foreground placeholder:text-muted-foreground/50 transition-all",
              "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
              error ? "border-destructive/50" : "border-input"
            )}
            disabled={isLoading}
            autoFocus
            autoComplete="off"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <button
          onClick={handleActivate}
          disabled={isLoading || !licenseKey.trim()}
          className={cn(
            "group flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-all",
            "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
            "hover:shadow-md hover:shadow-primary/25 hover:brightness-110",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Validation en cours...
            </>
          ) : (
            <>
              Activer la licence
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
          Format attendu
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <p className="mt-3 text-center font-mono text-xs tracking-wider text-muted-foreground/60">
        DEMO-SOFI-2026-XXXX
      </p>
    </div>
  )
}
