// =============================================================================
// GET /api/missions/[id]/signals
// List all documentary signals for a mission with filtering, sorting, and pagination.
// All queries filtered by license_id from session cookie.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'
import type { Signal, SignalPriority, HumanDecision, SignalType } from '@/types/database'

// Valid filter/sort values
const VALID_PRIORITIES: SignalPriority[] = ['low', 'medium', 'high']
const VALID_DECISIONS: HumanDecision[] = ['pending', 'validated', 'rejected', 'to_investigate']
const VALID_TYPES: SignalType[] = [
  'absence_piece',
  'incoherence_date',
  'incoherence_montant',
  'rupture_chaine',
  'rattachement_temporel',
  'incompletude',
]
const VALID_SORT_FIELDS = ['priority', 'created_at', 'type']
const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

// Priority ordering for sorting (high = 1, medium = 2, low = 3)
const PRIORITY_ORDER: Record<SignalPriority, number> = {
  high: 1,
  medium: 2,
  low: 3,
}

export async function GET(
  request: NextRequest,
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

    // 2. Verify mission exists and belongs to this license
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

    // 3. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const priorityFilter = searchParams.get('priority') as SignalPriority | null
    const typeFilter = searchParams.get('type') as SignalType | null
    const decisionFilter = searchParams.get('decision') as HumanDecision | null
    const ruleFilter = searchParams.get('rule_triggered')
    const sortParam = searchParams.get('sort') || '-priority'
    const page = Math.max(1, parseInt(searchParams.get('page') || String(DEFAULT_PAGE), 10))
    const perPage = Math.min(
      MAX_PER_PAGE,
      Math.max(1, parseInt(searchParams.get('per_page') || String(DEFAULT_PER_PAGE), 10))
    )

    // 4. Validate filter values
    if (priorityFilter && !VALID_PRIORITIES.includes(priorityFilter)) {
      return NextResponse.json(
        {
          error: `Priorite invalide. Valeurs acceptees : ${VALID_PRIORITIES.join(', ')}`,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }
    if (typeFilter && !VALID_TYPES.includes(typeFilter)) {
      return NextResponse.json(
        {
          error: `Type de signal invalide. Valeurs acceptees : ${VALID_TYPES.join(', ')}`,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }
    if (decisionFilter && !VALID_DECISIONS.includes(decisionFilter)) {
      return NextResponse.json(
        {
          error: `Decision invalide. Valeurs acceptees : ${VALID_DECISIONS.join(', ')}`,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // 5. Build query
    let query = supabase
      .from('signals')
      .select('*', { count: 'exact' })
      .eq('mission_id', missionId)

    // Apply filters
    if (priorityFilter) {
      query = query.eq('priority', priorityFilter)
    }
    if (typeFilter) {
      query = query.eq('type', typeFilter)
    }
    if (decisionFilter) {
      query = query.eq('human_decision', decisionFilter)
    }
    if (ruleFilter) {
      query = query.eq('rule_triggered', ruleFilter)
    }

    // 6. Apply sorting
    // Parse sort param: "-priority" = descending priority, "created_at" = ascending created_at
    const isDescending = sortParam.startsWith('-')
    const sortField = isDescending ? sortParam.slice(1) : sortParam

    if (!VALID_SORT_FIELDS.includes(sortField)) {
      return NextResponse.json(
        {
          error: `Champ de tri invalide. Valeurs acceptees : ${VALID_SORT_FIELDS.join(', ')}`,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // For priority sorting, use the priority column directly.
    // Supabase sorts text alphabetically, so we use ordering:
    // high < low < medium alphabetically, which is NOT the desired order.
    // We will sort in application layer for priority.
    if (sortField !== 'priority') {
      query = query.order(sortField, { ascending: !isDescending })
    }

    // 7. Apply pagination
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    query = query.range(from, to)

    // 8. Execute query
    const { data: signals, error: queryError, count } = await query

    if (queryError) {
      console.error('Erreur lors de la recuperation des signaux:', queryError)
      return NextResponse.json(
        { error: 'Erreur lors de la recuperation des signaux.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }

    // 9. Sort by priority in application layer if needed
    let sortedSignals = signals as Signal[]
    if (sortField === 'priority') {
      sortedSignals = [...sortedSignals].sort((a, b) => {
        const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        return isDescending ? diff : -diff
      })
    }

    // 10. Build response
    const total = count || 0
    const totalPages = Math.ceil(total / perPage)

    return NextResponse.json({
      data: sortedSignals,
      meta: {
        total,
        page,
        per_page: perPage,
        total_pages: totalPages,
      },
    })
  } catch (error) {
    console.error('Erreur inattendue dans GET /signals:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
