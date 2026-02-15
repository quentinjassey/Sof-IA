'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Search, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { HumanDecision } from '@/types/database'

interface DecisionPanelProps {
  signalId: string
  missionId: string
  currentDecision: HumanDecision
  currentComment: string | null
  decidedAt: string | null
  onDecisionSaved?: (decision: HumanDecision, comment: string) => void
}

const decisionOptions: {
  value: HumanDecision
  label: string
  icon: React.ReactNode
  selectedClass: string
  buttonVariant: 'success' | 'danger' | 'warning'
}[] = [
  {
    value: 'validated',
    label: 'Valider',
    icon: <CheckCircle className="h-4 w-4" />,
    selectedClass: 'border-success/40 bg-success/5 ring-2 ring-offset-1 ring-primary/30',
    buttonVariant: 'success',
  },
  {
    value: 'rejected',
    label: 'Rejeter',
    icon: <XCircle className="h-4 w-4" />,
    selectedClass: 'border-destructive/40 bg-destructive/5 ring-2 ring-offset-1 ring-primary/30',
    buttonVariant: 'danger',
  },
  {
    value: 'to_investigate',
    label: 'A approfondir',
    icon: <Search className="h-4 w-4" />,
    selectedClass: 'border-warning/40 bg-warning/5 ring-2 ring-offset-1 ring-primary/30',
    buttonVariant: 'warning',
  },
]

const decisionBadgeVariant: Record<HumanDecision, 'pending' | 'validated' | 'rejected' | 'to-investigate'> = {
  pending: 'pending',
  validated: 'validated',
  rejected: 'rejected',
  to_investigate: 'to-investigate',
}

const decisionLabel: Record<HumanDecision, string> = {
  pending: 'En attente',
  validated: 'Valide',
  rejected: 'Rejete',
  to_investigate: 'A approfondir',
}

export default function DecisionPanel({
  signalId,
  missionId,
  currentDecision,
  currentComment,
  decidedAt,
  onDecisionSaved,
}: DecisionPanelProps) {
  const [selectedDecision, setSelectedDecision] = useState<HumanDecision | null>(
    currentDecision !== 'pending' ? currentDecision : null
  )
  const [comment, setComment] = useState(currentComment || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isReject = selectedDecision === 'rejected'
  const commentRequired = isReject && comment.trim().length === 0

  async function handleSave() {
    if (!selectedDecision) return
    if (commentRequired) {
      setError('Un commentaire est obligatoire pour rejeter un signal documentaire.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/missions/${missionId}/signals/${signalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          human_decision: selectedDecision,
          comment: comment.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la sauvegarde de la decision.')
      }

      setSuccess(true)
      if (onDecisionSaved) {
        onDecisionSaved(selectedDecision, comment.trim())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur interne.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <h3 className="font-serif text-sm font-semibold text-card-foreground">Decision du commissaire aux comptes</h3>
        {currentDecision !== 'pending' && decidedAt && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Decision actuelle :</span>
            <Badge variant={decisionBadgeVariant[currentDecision]}>
              {decisionLabel[currentDecision]}
            </Badge>
            <span className="text-xs text-muted-foreground/60">
              le {new Date(decidedAt).toLocaleDateString('fr-FR')}
            </span>
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        {/* Decision buttons */}
        <div className="flex flex-wrap gap-2">
          {decisionOptions.map((option) => {
            const isSelected = selectedDecision === option.value
            return (
              <button
                key={option.value}
                onClick={() => {
                  setSelectedDecision(option.value)
                  setError(null)
                  setSuccess(false)
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                  isSelected
                    ? option.selectedClass
                    : "border-border bg-card text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                {option.icon}
                {option.label}
              </button>
            )
          })}
        </div>

        {/* Comment textarea */}
        <div className="mt-4">
          <label htmlFor="decision-comment" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Commentaire
            {isReject && <span className="ml-1 text-destructive">(obligatoire)</span>}
          </label>
          <textarea
            id="decision-comment"
            rows={3}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              if (error && e.target.value.trim().length > 0) {
                setError(null)
              }
            }}
            placeholder={
              isReject
                ? 'Justifiez votre decision de rejet...'
                : 'Commentaire optionnel...'
            }
            className={cn(
              "w-full rounded-xl border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50",
              "transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
              commentRequired && error
                ? "border-destructive/40 bg-destructive/5"
                : "border-input bg-background"
            )}
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-success/20 bg-success/5 px-4 py-3">
            <CheckCircle className="h-4 w-4 flex-shrink-0 text-success" />
            <p className="text-sm text-success">Decision enregistree avec succes.</p>
          </div>
        )}

        {/* Save button */}
        <div className="mt-4">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!selectedDecision || saving}
            loading={saving}
            className="w-full"
          >
            Confirmer la decision
          </Button>
        </div>
      </div>
    </div>
  )
}
