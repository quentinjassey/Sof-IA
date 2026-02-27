// =============================================================================
// GET /api/missions/[id]/signals/stats
// Signal statistics for a mission: total count, breakdown by priority, decision, and type.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'
import type {
  Signal,
  SignalPriority,
  HumanDecision,
  SignalType,
} from '@/types/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verify session
    const session = await getSessionFromServerCookies()
    if (!session) {
      return NextResponse.json(
        { error: 'Session non valide. Veuillez vous reconnecter.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { id: missionId } = await params
    const supabase = createServerSupabaseClient()

    // 2. Verify mission belongs to this license
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('id, license_id, scenario')
      .eq('id', missionId)
      .eq('license_id', session.license_id)
      .single()

    if (missionError || !mission) {
      return NextResponse.json(
        { error: 'Mission non trouvee.', code: 'MISSION_NOT_FOUND' },
        { status: 404 }
      )
    }

    // 3. Fetch all signals for this mission (only the fields we need for stats)
    const { data: signals, error: queryError } = await supabase
      .from('signals')
      .select('priority, human_decision, type')
      .eq('mission_id', missionId)

    if (queryError) {
      console.error('Erreur lors de la recuperation des statistiques:', queryError)
      return NextResponse.json(
        { error: 'Erreur lors de la recuperation des statistiques.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }

    const signalList = (signals || []) as Pick<Signal, 'priority' | 'human_decision' | 'type'>[]

    // 4. Compute statistics
    const total = signalList.length

    // By priority
    const by_priority: Record<SignalPriority, number> = {
      high: 0,
      medium: 0,
      low: 0,
    }
    for (const s of signalList) {
      if (s.priority in by_priority) {
        by_priority[s.priority]++
      }
    }

    // By decision
    const by_decision: Record<HumanDecision, number> = {
      pending: 0,
      validated: 0,
      rejected: 0,
      to_investigate: 0,
    }
    for (const s of signalList) {
      if (s.human_decision in by_decision) {
        by_decision[s.human_decision]++
      }
    }

    // By type
    const by_type: Record<string, number> = {}
    const validTypes: SignalType[] = [
      'absence_piece',
      'incoherence_date',
      'incoherence_montant',
      'rupture_chaine',
      'rattachement_temporel',
      'incompletude',
    ]
    for (const t of validTypes) {
      by_type[t] = 0
    }
    for (const s of signalList) {
      if (s.type in by_type) {
        by_type[s.type]++
      } else {
        by_type[s.type] = 1
      }
    }

    // 5. Coverage data for sondage_ca scenario
    // IMPORTANT: ca_total from FEC is HT (from 7xxx accounts), but ecritures
    // store TTC amounts (from 411xxx accounts). We use montant_facture_ht from
    // rapprochements for consistent HT-based coverage calculations.
    let coverage: {
      ca_total: number
      montant_teste_ht: number
      montant_factures_ht: number
      montant_avoirs_ht: number
      couverture_pct: number
      pieces_testees: number
      montant_signaux: number
      taux_erreur_pct: number
      extrapolation_montant: number
    } | null = null

    if (mission.scenario === 'sondage_ca') {
      const { data: rapprochements } = await supabase
        .from('rapprochements')
        .select('match_details')
        .eq('mission_id', missionId)

      const { data: completeness } = await supabase
        .from('completeness')
        .select('doc_type, note')
        .eq('mission_id', missionId)

      const { data: allSignals } = await supabase
        .from('signals')
        .select('explicability, human_decision')
        .eq('mission_id', missionId)

      if (rapprochements && rapprochements.length > 0) {
        let caTotal = 0
        const fecEntry = (completeness || []).find(
          (c) => c.doc_type === 'fec' || c.doc_type === 'FEC'
        )
        if (fecEntry?.note) {
          const match = fecEntry.note.match(/CA total\s*:\s*([\d\s,.]+)\s*EUR/i)
          if (match) {
            caTotal = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'))
          }
        }

        let montantFacturesHt = 0
        let montantAvoirsHt = 0
        for (const rap of rapprochements) {
          const md = rap.match_details as Record<string, unknown> | null
          if (!md) continue
          const isAvoir = Boolean(md.is_avoir)
          const htAmount = getHtAmount(md)
          if (isAvoir) {
            montantAvoirsHt += htAmount
          } else {
            montantFacturesHt += htAmount
          }
        }
        const montantTesteHt = montantFacturesHt - montantAvoirsHt

        const montantSignaux = (allSignals || [])
          .filter((sig) => sig.human_decision !== 'rejected')
          .reduce((s, sig) => {
            const expl = sig.explicability as Record<string, unknown> | null
            return s + getHtAmountFromExplicability(expl)
          }, 0)

        const tauxErreur = montantTesteHt > 0
          ? Math.round((montantSignaux / montantTesteHt) * 10000) / 100
          : 0
        const extrapolationMontant = caTotal > 0 && montantTesteHt > 0
          ? Math.round((montantSignaux / montantTesteHt) * caTotal)
          : 0

        coverage = {
          ca_total: caTotal,
          montant_teste_ht: montantTesteHt,
          montant_factures_ht: montantFacturesHt,
          montant_avoirs_ht: montantAvoirsHt,
          couverture_pct: caTotal > 0
            ? Math.round((montantTesteHt / caTotal) * 10000) / 100
            : 0,
          pieces_testees: rapprochements.length,
          montant_signaux: montantSignaux,
          taux_erreur_pct: tauxErreur,
          extrapolation_montant: extrapolationMontant,
        }
      }
    }

    // 6. Return statistics
    return NextResponse.json({
      data: {
        total,
        by_priority,
        by_decision,
        by_type,
        coverage,
      },
    })
  } catch (error) {
    console.error('Erreur inattendue dans GET /signals/stats:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * Extracts HT amount from rapprochement match_details.
 * Uses montant_facture_ht if stored (new analyses), otherwise
 * falls back to montant_facture_ttc / 1.20 for existing data
 * where 411xxx (TTC) amounts were stored without HT counterparts.
 */
function getHtAmount(md: Record<string, unknown>): number {
  if (typeof md.montant_facture_ht === 'number' && md.montant_facture_ht > 0) {
    return md.montant_facture_ht
  }
  const ttc = typeof md.montant_facture_ttc === 'number' ? md.montant_facture_ttc : null
  if (ttc != null && ttc > 0) {
    return Math.round(ttc / 1.20 * 100) / 100
  }
  const fec = typeof md.montant_fec === 'number' ? md.montant_fec : 0
  return Math.round(fec / 1.20 * 100) / 100
}

function getHtAmountFromExplicability(expl: Record<string, unknown> | null): number {
  if (!expl) return 0
  if (typeof expl.montant_ht === 'number' && expl.montant_ht > 0) {
    return expl.montant_ht
  }
  const montantFec = typeof expl.montant_fec === 'number' ? expl.montant_fec : 0
  if (montantFec <= 0) return 0
  return Math.round(montantFec / 1.20 * 100) / 100
}
