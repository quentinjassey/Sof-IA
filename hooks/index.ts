// =============================================================================
// SOF'IA — Hooks Index
// Re-exports all custom React hooks for convenient imports.
// =============================================================================

export { useSession } from './useSession'
export type { UseSessionReturn, LicenseInfo } from './useSession'

export { useMission } from './useMission'
export type { UseMissionReturn } from './useMission'

export { useSignals } from './useSignals'
export type {
  UseSignalsReturn,
  SignalFilters,
  SignalStats,
} from './useSignals'

export { useAnalysisPolling } from './useAnalysisPolling'
export type {
  UseAnalysisPollingReturn,
  AnalysisStep,
} from './useAnalysisPolling'

export { useDocuments } from './useDocuments'
export type { UseDocumentsReturn } from './useDocuments'
