// =============================================================================
// GET /api/dashboard
// Aggregates all dashboard data in a single call: projects, missions, signals,
// deliverables, completeness, recent traces, and pre-computed KPIs.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'
import type { DashboardKPIs } from '@/types/dashboard'

export async function GET(_request: NextRequest) {
  try {
    const session = await getSessionFromServerCookies()
    if (!session) {
      return NextResponse.json(
        { error: 'Session non valide. Veuillez vous reconnecter.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const supabase = createServerSupabaseClient()
    const license_id = session.license_id

    // 1. Fetch projects, missions, deliverables, and recent traces in parallel
    const [projectsRes, missionsRes, deliverablesRes, tracesRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, description, created_at')
        .eq('license_id', license_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('missions')
        .select('id, project_id, name, scenario, status, company_id, created_at')
        .eq('license_id', license_id),
      supabase
        .from('deliverables')
        .select('id, mission_id, type, format')
        .eq('license_id', license_id),
      supabase
        .from('traces')
        .select('id, mission_id, timestamp, actor, action, details')
        .eq('license_id', license_id)
        .order('timestamp', { ascending: false })
        .limit(10),
    ])

    const projects = projectsRes.data || []
    const missions = missionsRes.data || []
    const deliverables = deliverablesRes.data || []
    const recentTraces = tracesRes.data || []

    // 2. Fetch signals and completeness via mission IDs (signals table has no license_id)
    const missionIds = missions.map((m) => m.id)
    let signals: { id: string; mission_id: string; type: string; priority: string; human_decision: string }[] = []
    let completeness: { id: string; mission_id: string; doc_type: string; status: string }[] = []

    if (missionIds.length > 0) {
      const [signalsRes, completenessRes] = await Promise.all([
        supabase
          .from('signals')
          .select('id, mission_id, type, priority, human_decision')
          .in('mission_id', missionIds),
        supabase
          .from('completeness')
          .select('id, mission_id, doc_type, status')
          .in('mission_id', missionIds),
      ])
      signals = signalsRes.data || []
      completeness = completenessRes.data || []
    }

    // 3. Compute KPIs
    const completedStatuses = ['analyzed', 'in_review', 'completed']
    const inProgressStatuses = ['analyzing']

    // Document completeness: % of items with status 'present' among all completeness entries
    const totalCompletenessItems = completeness.length
    const presentItems = completeness.filter((c) => c.status === 'present').length
    const documentCompletenessPct = totalCompletenessItems > 0
      ? Math.round((presentItems / totalCompletenessItems) * 100)
      : 0

    const kpis: DashboardKPIs = {
      total_projects: projects.length,
      total_missions: missions.length,
      missions_completed: missions.filter((m) => completedStatuses.includes(m.status)).length,
      missions_in_progress: missions.filter((m) => inProgressStatuses.includes(m.status)).length,
      document_completeness_pct: documentCompletenessPct,
      deliverables_generated: deliverables.length,
      total_signals: signals.length,
      pending_decisions: signals.filter((s) => s.human_decision === 'pending').length,
      high_priority_signals: signals.filter((s) => s.priority === 'high').length,
      validated_signals: signals.filter((s) => s.human_decision === 'validated').length,
      rejected_signals: signals.filter((s) => s.human_decision === 'rejected').length,
      to_investigate_signals: signals.filter((s) => s.human_decision === 'to_investigate').length,
    }

    // 4. Return aggregated data
    return NextResponse.json({
      data: {
        projects,
        missions,
        signals,
        deliverables,
        recent_traces: recentTraces,
        kpis,
      },
    })
  } catch (error) {
    console.error('Erreur inattendue dans GET /api/dashboard:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
