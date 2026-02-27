'use client'

import {
  FileX,
  CalendarX,
  DollarSign,
  Link2Off,
  Clock,
  FileQuestion,
  ChevronRight,
  ShieldCheck,
  BookCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Signal, SignalType, SignalPriority, HumanDecision } from '@/types/database'

// Map signal types to icons
const signalTypeIcons: Record<SignalType, React.ReactNode> = {
  absence_piece: <FileX className="h-4 w-4" />,
  incoherence_date: <CalendarX className="h-4 w-4" />,
  incoherence_montant: <DollarSign className="h-4 w-4" />,
  rupture_chaine: <Link2Off className="h-4 w-4" />,
  rattachement_temporel: <Clock className="h-4 w-4" />,
  incompletude: <FileQuestion className="h-4 w-4" />,
}

// Map signal types to French labels
const signalTypeLabels: Record<SignalType, string> = {
  absence_piece: 'Pièce justificative manquante',
  incoherence_date: 'Incohérence de dates',
  incoherence_montant: 'Écart de montant',
  rupture_chaine: 'Rupture de la chaîne documentaire',
  rattachement_temporel: 'Doute sur le rattachement temporel',
  incompletude: 'Information incomplète',
}

// Map priorities to badge variants
const priorityVariantMap: Record<SignalPriority, 'priority-high' | 'priority-medium' | 'priority-low'> = {
  high: 'priority-high',
  medium: 'priority-medium',
  low: 'priority-low',
}

const priorityLabels: Record<SignalPriority, string> = {
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Faible',
}

// Map decisions to badge variants
const decisionVariantMap: Record<HumanDecision, 'pending' | 'validated' | 'rejected' | 'to-investigate'> = {
  pending: 'pending',
  validated: 'validated',
  rejected: 'rejected',
  to_investigate: 'to-investigate',
}

const decisionLabels: Record<HumanDecision, string> = {
  pending: 'En attente',
  validated: 'Validé',
  rejected: 'Rejeté',
  to_investigate: 'À approfondir',
}

interface SignalCardProps {
  signal: Signal
  index: number
  onClick?: () => void
}

function getCutoffFecStatus(signal: Signal): string | null {
  const rule = signal.rule_triggered
  if (!rule?.startsWith('CUT-')) return null

  switch (rule) {
    case 'CUT-001':
      return 'Facture comptabilisee dans le FEC de l\'exercice clos'
    case 'CUT-002':
      return 'Facture comptabilisee dans le FEC de l\'exercice suivant'
    case 'CUT-004':
      return 'Operation comptabilisee dans le FEC de l\'exercice clos'
    case 'CUT-005':
      return 'Vente initiale comptabilisee dans le FEC de l\'exercice clos'
    default:
      return null
  }
}

export default function SignalCard({ signal, index, onClick }: SignalCardProps) {
  const TypeIcon = signalTypeIcons[signal.type] || <FileQuestion className="h-4 w-4" />
  const cutoffFecStatus = getCutoffFecStatus(signal)

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-all",
        "hover:border-primary/20 hover:shadow-sm"
      )}
    >
      {/* Index */}
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {index}
      </span>

      {/* Type icon */}
      <span className="flex-shrink-0 text-muted-foreground/60">
        {TypeIcon}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-card-foreground group-hover:text-primary transition-colors">
            {signal.rule_triggered || signalTypeLabels[signal.type]}
          </span>
          <Badge variant={priorityVariantMap[signal.priority]}>
            {priorityLabels[signal.priority]}
          </Badge>
          <Badge variant={decisionVariantMap[signal.human_decision]}>
            {decisionLabels[signal.human_decision]}
          </Badge>
          {signal.confidence_score != null && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                signal.confidence_score >= 90
                  ? 'bg-primary/10 text-primary'
                  : signal.confidence_score >= 75
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              )}
            >
              <ShieldCheck className="h-3 w-3" />
              {signal.confidence_score}%
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {signal.description}
        </p>
        {cutoffFecStatus && (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <BookCheck className="h-3 w-3" />
            {cutoffFecStatus}
          </p>
        )}
        {signal.source_document && (
          <p className="mt-0.5 text-xs text-muted-foreground/60">
            Source : {signal.source_document}
            {signal.source_page ? ` — Page ${signal.source_page}` : ''}
          </p>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </div>
  )
}

export { signalTypeLabels, signalTypeIcons, priorityLabels, priorityVariantMap, decisionLabels, decisionVariantMap }
