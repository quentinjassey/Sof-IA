import type { SignalPriority, HumanDecision, MissionStatus, ScenarioType } from './database'

export interface DashboardKPIs {
  total_projects: number
  total_missions: number
  missions_completed: number
  missions_in_progress: number
  document_completeness_pct: number
  deliverables_generated: number
  total_signals: number
  pending_decisions: number
  high_priority_signals: number
  validated_signals: number
  rejected_signals: number
  to_investigate_signals: number
}

export interface DashboardProject {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface DashboardMission {
  id: string
  project_id: string | null
  name: string
  scenario: ScenarioType
  status: MissionStatus
  company_id: string | null
  created_at: string
}

export interface DashboardSignal {
  id: string
  mission_id: string
  type: string
  priority: SignalPriority
  human_decision: HumanDecision
}

export interface DashboardDeliverable {
  id: string
  mission_id: string
  type: string
  format: string
}

export interface DashboardTrace {
  id: string
  mission_id: string
  timestamp: string
  actor: string
  action: string
  details: string | null
}

export interface DashboardData {
  projects: DashboardProject[]
  missions: DashboardMission[]
  signals: DashboardSignal[]
  deliverables: DashboardDeliverable[]
  recent_traces: DashboardTrace[]
  kpis: DashboardKPIs
}
