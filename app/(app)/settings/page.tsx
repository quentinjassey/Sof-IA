'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  KeyRound,
  Save,
  LogOut,
  Shield,
  CalendarDays,
  Clock,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/useSession'
import { apiFetch, ApiError } from '@/lib/utils/api'
import { maskLicenseKey, formatDate } from '@/lib/utils/format'
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Separator } from '@/components/ui/Separator'
import { Alert } from '@/components/ui/Alert'
import type { Profile } from '@/types/database'

type SettingsSection = 'profile' | 'license'

const NAV_ITEMS: { key: SettingsSection; label: string; icon: React.ElementType }[] = [
  { key: 'profile', label: 'Profil CAC', icon: User },
  { key: 'license', label: 'Licence', icon: KeyRound },
]

export default function SettingsPage() {
  const router = useRouter()
  const { profile, licenseInfo, isLoading, error: sessionError, logout } = useSession()

  const [section, setSection] = useState<SettingsSection>('profile')

  const [name, setName] = useState('')
  const [cabinet, setCabinet] = useState('')
  const [inscriptionCncc, setInscriptionCncc] = useState('')
  const [email, setEmail] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
      setCabinet(profile.cabinet || '')
      setInscriptionCncc(profile.inscription_cncc || '')
      setEmail(profile.email || '')
    }
  }, [profile])

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
        await apiFetch<Profile>('/api/profile', { method: 'PUT', body: profileData })
      } else {
        await apiFetch<Profile>('/api/profile', { method: 'POST', body: profileData })
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="mt-3 text-sm text-muted-foreground">Chargement...</span>
      </div>
    )
  }

  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'CA'

  return (
    <div className="animate-fade-in h-full overflow-y-auto p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Page heading */}
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-foreground">Param&egrave;tres</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            G&eacute;rez votre profil professionnel et votre licence Sof&apos;IA.
          </p>
        </div>

        <Separator />

        {sessionError && <Alert variant="error">{sessionError}</Alert>}

        {/* Settings layout: side nav + content */}
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          {/* Side navigation */}
          <aside className="-mx-1 lg:w-48 lg:shrink-0">
            <nav className="flex gap-1 lg:flex-col">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = section === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => setSection(item.key)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-transparent hover:text-foreground hover:underline'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </nav>

            {/* Logout at bottom of nav */}
            <Separator className="my-3" />
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'D\u00e9connexion...' : 'Se d\u00e9connecter'}
            </button>
          </aside>

          {/* Content area */}
          <div className="flex-1 space-y-6 lg:max-w-2xl">
            {section === 'profile' && (
              <>
                {/* Profile identity card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                        {initials}
                      </div>
                      <div>
                        <CardTitle className="font-serif text-lg">{name || 'Nouveau profil'}</CardTitle>
                        <CardDescription>
                          {cabinet || 'Cabinet non renseign\u00e9'}
                          {inscriptionCncc ? ` \u2022 ${inscriptionCncc}` : ''}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Profile form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Informations professionnelles</CardTitle>
                    <CardDescription>
                      Ces informations apparaissent sur les livrables et le journal de tra&ccedil;abilit&eacute;.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Nom complet"
                        required
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jean Dupont"
                      />
                      <Input
                        label="Cabinet"
                        required
                        id="cabinet"
                        value={cabinet}
                        onChange={(e) => setCabinet(e.target.value)}
                        placeholder="Cabinet Dupont & Associ\u00e9s"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="N\u00b0 inscription CNCC"
                        id="inscription_cncc"
                        value={inscriptionCncc}
                        onChange={(e) => setInscriptionCncc(e.target.value)}
                        placeholder="CNCC-12345"
                        helperText="Optionnel"
                      />
                      <Input
                        label="Adresse email"
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jean.dupont@cabinet.fr"
                        helperText="Optionnel"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {saveError && (
                        <Alert variant="error" className="py-2 text-xs">{saveError}</Alert>
                      )}
                      {saveSuccess && (
                        <Alert variant="success" className="py-2 text-xs">Profil enregistr&eacute;.</Alert>
                      )}
                    </div>
                    <Button
                      onClick={handleSaveProfile}
                      loading={isSaving}
                      iconLeft={<Save className="h-4 w-4" />}
                    >
                      Enregistrer
                    </Button>
                  </CardFooter>
                </Card>
              </>
            )}

            {section === 'license' && (
              <>
                {/* License status card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Licence Sof&apos;IA</CardTitle>
                        <CardDescription>
                          D&eacute;tails de votre licence active.
                        </CardDescription>
                      </div>
                      {licenseInfo && (
                        <Badge variant={licenseInfo.valid ? 'validated' : 'rejected'}>
                          {licenseInfo.valid ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="py-0">
                    {licenseInfo ? (
                      <div className="divide-y divide-border">
                        <LicenseRow
                          icon={<KeyRound className="h-4 w-4" />}
                          label="Cl\u00e9 de licence"
                          value={
                            <span className="font-mono text-xs tracking-wider">
                              {maskLicenseKey(licenseInfo.license_key)}
                            </span>
                          }
                        />
                        {licenseInfo.activated_at && (
                          <LicenseRow
                            icon={<CalendarDays className="h-4 w-4" />}
                            label="Activ\u00e9e le"
                            value={formatDate(licenseInfo.activated_at)}
                          />
                        )}
                        {licenseInfo.valid_until && (
                          <LicenseRow
                            icon={<Clock className="h-4 w-4" />}
                            label="Valide jusqu&apos;au"
                            value={formatDate(licenseInfo.valid_until)}
                          />
                        )}
                        {licenseInfo.days_remaining >= 0 && (
                          <LicenseRow
                            icon={<Shield className="h-4 w-4" />}
                            label="Jours restants"
                            value={
                              <span
                                className={cn(
                                  'font-semibold tabular-nums',
                                  licenseInfo.days_remaining <= 7
                                    ? 'text-destructive'
                                    : licenseInfo.days_remaining <= 30
                                      ? 'text-warning-foreground'
                                      : 'text-foreground'
                                )}
                              >
                                {licenseInfo.days_remaining} jour{licenseInfo.days_remaining > 1 ? 's' : ''}
                              </span>
                            }
                          />
                        )}
                        {licenseInfo.max_missions > 0 && (
                          <LicenseRow
                            icon={<Briefcase className="h-4 w-4" />}
                            label="Missions autoris\u00e9es"
                            value={licenseInfo.max_missions}
                          />
                        )}
                      </div>
                    ) : (
                      <p className="py-5 text-center text-sm text-muted-foreground">
                        Aucune information de licence disponible.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Danger zone */}
                <Card className="border-destructive/20">
                  <CardHeader>
                    <CardTitle className="text-sm text-destructive">Zone sensible</CardTitle>
                    <CardDescription>
                      Se d&eacute;connecter et retourner &agrave; la page d&apos;activation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      onClick={handleLogout}
                      loading={isLoggingOut}
                      iconLeft={<LogOut className="h-4 w-4" />}
                      className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                    >
                      Se d&eacute;connecter
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LicenseRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex items-center gap-2.5 text-muted-foreground">
        <span className="text-muted-foreground/50">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}
