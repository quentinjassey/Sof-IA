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
      .select('id, license_id')
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

    // 5. Return statistics
    return NextResponse.json({
      data: {
        total,
        by_priority,
        by_decision,
        by_type,
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
