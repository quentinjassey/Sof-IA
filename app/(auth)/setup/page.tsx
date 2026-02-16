'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, ArrowRight, Building2, User, Hash, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormData {
  name: string
  cabinet: string
  inscription_cncc: string
  email: string
}

const FIELDS = [
  {
    key: 'name' as const,
    label: 'Nom complet',
    placeholder: 'Jean Dupont',
    icon: User,
    required: true,
    type: 'text',
  },
  {
    key: 'cabinet' as const,
    label: 'Nom du cabinet',
    placeholder: 'Cabinet Dupont & Associés',
    icon: Building2,
    required: true,
    type: 'text',
  },
  {
    key: 'inscription_cncc' as const,
    label: 'N\u00b0 inscription CNCC',
    placeholder: 'CNCC-75-12345',
    icon: Hash,
    required: false,
    type: 'text',
  },
  {
    key: 'email' as const,
    label: 'Email',
    placeholder: 'jean.dupont@cabinet-xyz.fr',
    icon: Mail,
    required: false,
    type: 'email',
  },
]

export default function SetupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({
    name: '',
    cabinet: '',
    inscription_cncc: '',
    email: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateField = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      if (error) setError(null)
    },
    [error]
  )

  const isValid =
    formData.name.trim() !== '' && formData.cabinet.trim() !== ''

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      setError('Les champs Nom complet et Cabinet sont obligatoires.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const body: Record<string, string> = {
        name: formData.name.trim(),
        cabinet: formData.cabinet.trim(),
      }
      if (formData.inscription_cncc.trim()) {
        body.inscription_cncc = formData.inscription_cncc.trim()
      }
      if (formData.email.trim()) {
        body.email = formData.email.trim()
      }

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setError(
          json.error || 'Une erreur est survenue lors de la création du profil.'
        )
        return
      }

      router.push('/missions')
    } catch {
      setError(
        'Impossible de contacter le serveur. Vérifiez votre connexion.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [formData, isValid, router])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading && isValid) {
        handleSubmit()
      }
    },
    [handleSubmit, isLoading, isValid]
  )

  return (
    <div className="animate-fade-in rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-xs font-medium text-primary">Étape 2/2</span>
        </div>
        <h2 className="font-serif text-xl text-card-foreground">
          Profil professionnel
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Vos informations apparaîtront dans les livrables d&apos;audit
        </p>
      </div>

      <div className="space-y-4">
        {FIELDS.map((field, index) => {
          const Icon = field.icon
          return (
            <div key={field.key} className={cn("animate-fade-in opacity-0", `stagger-${index + 1}`)}>
              <label
                htmlFor={field.key}
                className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {field.label}
                {field.required && (
                  <span className="text-destructive">*</span>
                )}
              </label>
              <div className="relative">
                <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  id={field.key}
                  type={field.type}
                  value={formData[field.key]}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={field.placeholder}
                  className={cn(
                    "block w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm text-foreground",
                    "placeholder:text-muted-foreground/50",
                    "transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  )}
                  disabled={isLoading}
                  autoFocus={index === 0}
                />
              </div>
            </div>
          )
        })}

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isLoading || !isValid}
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
              Enregistrement...
            </>
          ) : (
            <>
              Continuer
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/50">
        Les champs marqués * sont obligatoires.
        Ces données seront intégrées à vos livrables d&apos;audit.
      </p>
    </div>
  )
}
