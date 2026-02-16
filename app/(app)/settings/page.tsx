'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings,
  User,
  KeyRound,
  Save,
  LogOut,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
  Hash,
  Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/useSession'
import { apiFetch, ApiError } from '@/lib/utils/api'
import { maskLicenseKey, formatDate } from '@/lib/utils/format'
import type { Profile } from '@/types/database'

export default function SettingsPage() {
  const router = useRouter()
  const { profile, licenseInfo, isLoading, error: sessionError, logout } = useSession()

  // Profile form state
  const [name, setName] = useState('')
  const [cabinet, setCabinet] = useState('')
  const [inscriptionCncc, setInscriptionCncc] = useState('')
  const [email, setEmail] = useState('')

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
      setCabinet(profile.cabinet || '')
      setInscriptionCncc(profile.inscription_cncc || '')
      setEmail(profile.email || '')
    }
  }, [profile])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccess])

  async function handleSaveProfile() {
    setSaveError(null)
    setSaveSuccess(false)

    if (!name.trim()) {
      setSaveError('Le nom est requis.')
      return
    }
    if (!cabinet.trim()) {
      setSaveError('Le nom du cabinet est requis.')
      return
    }

    setIsSaving(true)

    try {
      const profileData = {
        name: name.trim(),
        cabinet: cabinet.trim(),
        inscription_cncc: inscriptionCncc.trim() || undefined,
        email: email.trim() || undefined,
      }

      if (profile) {
        await apiFetch<Profile>('/api/profile', {
          method: 'PUT',
          body: profileData,
        })
      } else {
        await apiFetch<Profile>('/api/profile', {
          method: 'POST',
          body: profileData,
        })
      }

      setSaveSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message)
      } else {
        setSaveError('Erreur lors de la sauvegarde du profil.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logout()
    } catch {
      router.push('/activate')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="mt-3 text-sm text-muted-foreground">Chargement des paramètres...</span>
      </div>
    )
  }

  const PROFILE_FIELDS = [
    {
      id: 'name',
      label: 'Nom complet',
      required: true,
      icon: User,
      type: 'text',
      placeholder: 'Jean Dupont',
      value: name,
      onChange: setName,
    },
    {
      id: 'cabinet',
      label: 'Cabinet',
      required: true,
      icon: Building2,
      type: 'text',
      placeholder: 'Cabinet Dupont & Associés',
      value: cabinet,
      onChange: setCabinet,
    },
    {
      id: 'inscription_cncc',
      label: "Numéro d'inscription CNCC",
      required: false,
      icon: Hash,
      type: 'text',
      placeholder: 'CNCC-12345',
      value: inscriptionCncc,
      onChange: setInscriptionCncc,
    },
    {
      id: 'email',
      label: 'Adresse email',
      required: false,
      icon: Mail,
      type: 'email',
      placeholder: 'jean.dupont@cabinet.fr',
      value: email,
      onChange: setEmail,
    },
  ]

  return (
    <div className="animate-fade-in mx-auto max-w-2xl space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="font-serif text-2xl tracking-tight text-foreground">
          Paramètres
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez votre profil professionnel et votre licence
        </p>
      </div>

      {/* Session error */}
      {sessionError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{sessionError}</p>
        </div>
      )}

      {/* Profile section */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-base text-card-foreground">
                Profil du commissaire aux comptes
              </h2>
              <p className="text-xs text-muted-foreground">
                Ces informations apparaissent sur les livrables et le journal de traçabilité.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          {PROFILE_FIELDS.map((field) => {
            const Icon = field.icon
            return (
              <div key={field.id}>
                <label
                  htmlFor={field.id}
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
                    id={field.id}
                    type={field.type}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className={cn(
                      "block w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm text-foreground",
                      "placeholder:text-muted-foreground/50",
                      "transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    )}
                  />
                </div>
              </div>
            )
          })}

          {/* Save error */}
          {saveError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{saveError}</p>
            </div>
          )}

          {/* Save success */}
          {saveSuccess && (
            <div className="flex items-center gap-2.5 rounded-xl border border-success/20 bg-success/5 px-4 py-3">
              <CheckCircle className="h-4 w-4 shrink-0 text-success" />
              <p className="text-sm text-success">
                Profil enregistré avec succès.
              </p>
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className={cn(
                "group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all",
                "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
                "hover:shadow-md hover:shadow-primary/25 hover:brightness-110",
                "disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </section>

      {/* License section */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-base text-card-foreground">Licence</h2>
              <p className="text-xs text-muted-foreground">
                Informations sur votre licence Sof&apos;IA active.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {licenseInfo ? (
            <div className="space-y-3.5">
              {/* License key (masked) */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Clé de licence
                </span>
                <span className="font-mono text-sm text-foreground">
                  {maskLicenseKey(licenseInfo.license_key)}
                </span>
              </div>

              <div className="h-px bg-border/60" />

              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Statut</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-medium",
                    licenseInfo.valid
                      ? 'bg-success/10 text-success'
                      : 'bg-destructive/10 text-destructive'
                  )}
                >
                  {licenseInfo.valid ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Activation date */}
              {licenseInfo.activated_at && (
                <>
                  <div className="h-px bg-border/60" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Activée le
                    </span>
                    <span className="text-sm text-foreground">
                      {formatDate(licenseInfo.activated_at)}
                    </span>
                  </div>
                </>
              )}

              {/* Validity date */}
              {licenseInfo.valid_until && (
                <>
                  <div className="h-px bg-border/60" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Valide jusqu&apos;au
                    </span>
                    <span className="text-sm text-foreground">
                      {formatDate(licenseInfo.valid_until)}
                    </span>
                  </div>
                </>
              )}

              {/* Days remaining */}
              {licenseInfo.days_remaining >= 0 && (
                <>
                  <div className="h-px bg-border/60" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Jours restants
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        licenseInfo.days_remaining <= 7
                          ? 'text-destructive'
                          : licenseInfo.days_remaining <= 30
                            ? 'text-warning-foreground'
                            : 'text-foreground'
                      )}
                    >
                      {licenseInfo.days_remaining} jour
                      {licenseInfo.days_remaining > 1 ? 's' : ''}
                    </span>
                  </div>
                </>
              )}

              {/* Max missions */}
              {licenseInfo.max_missions > 0 && (
                <>
                  <div className="h-px bg-border/60" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Missions autorisées
                    </span>
                    <span className="text-sm text-foreground">
                      {licenseInfo.max_missions}
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune information de licence disponible.
            </p>
          )}
        </div>
      </section>

      {/* Logout section */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-card-foreground">Déconnexion</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Se déconnecter et retourner à la page d&apos;activation de licence.
              </p>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-destructive/30 bg-card px-4 py-2.5 text-sm font-medium text-destructive transition-all",
                "hover:bg-destructive/5",
                "disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
