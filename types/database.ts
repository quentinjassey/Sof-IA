// =============================================================================
// SOF'IA — Database Type Definitions
// Matches Supabase PostgreSQL schema from supabase/migrations/001_initial.sql
// =============================================================================

// -----------------------------------------------------------------------------
// Enum Types
// -----------------------------------------------------------------------------

/** The three analysis scenarios available in Sof'IA */
export type ScenarioType = 'sondage_ca' | 'cutoff' | 'pointage';

/** Mission lifecycle statuses */
export type MissionStatus =
  | 'created'
  | 'documents_ready'
  | 'uploading'
  | 'upload_failed'
  | 'analyzing'
  | 'analysis_failed'
  | 'analyzed'
  | 'in_review'
  | 'completed';

/** Priority level for documentary signals */
export type SignalPriority = 'low' | 'medium' | 'high';

/** Human decision on a signal — all signals start as 'pending' */
export type HumanDecision = 'pending' | 'validated' | 'rejected' | 'to_investigate';

/** Actor type in the audit trail */
export type ActorType = 'sofia' | 'user';

/** Document presence status */
export type DocumentStatus = 'present' | 'missing' | 'incomplete';

/** License status */
export type LicenseStatus = 'active' | 'expired' | 'revoked';

/** Types of documents accepted in a mission */
export type DocumentType =
  | 'fec'
  | 'facture_vente'
  | 'facture_achat'
  | 'bon_livraison'
  | 'bon_commande'
  | 'contrat'
  | 'annexe'
  | 'bilan'
  | 'compte_resultat'
  | 'autre';

/** Types of documentary signals */
export type SignalType =
  | 'absence_piece'
  | 'incoherence_date'
  | 'incoherence_montant'
  | 'rupture_chaine'
  | 'rattachement_temporel'
  | 'incompletude';

/** Deliverable types */
export type DeliverableType =
  | 'checklist_completude'
  | 'tableau_signaux'
  | 'tableau_rapprochement'
  | 'synthese_preanalyse'
  | 'journal_tracabilite';

/** Deliverable file formats */
export type DeliverableFormat = 'pdf' | 'xlsx';

/** Match type for entry-to-document matching */
export type MatchType = 'exact' | 'partial' | 'missing';

/** Confidence level for matching */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Trace action types — all possible actions in the audit trail */
export type TraceAction =
  | 'mission_created'
  | 'mission_updated'
  | 'mission_deleted'
  | 'document_added'
  | 'document_deleted'
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'fec_parsed'
  | 'pdf_extracted'
  | 'rapprochement_completed'
  | 'signals_generated'
  | 'deliverables_generated'
  | 'signal_validated'
  | 'signal_rejected'
  | 'signal_to_investigate'
  | 'deliverables_regenerated'
  | 'deliverables_exported';

/** Target type for trace entries */
export type TraceTargetType = 'mission' | 'document' | 'signal' | 'deliverable';

// -----------------------------------------------------------------------------
// Row Types (SELECT / read from database)
// -----------------------------------------------------------------------------

/** License table row */
export interface License {
  id: string;
  license_key: string;
  activated_at: string | null;
  valid_until: string;
  features: ScenarioType[];
  max_missions: number;
  status: LicenseStatus;
  created_at: string;
}

/** Profile table row */
export interface Profile {
  id: string;
  license_id: string;
  name: string;
  cabinet: string;
  inscription_cncc: string | null;
  email: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Project table row — groups documents and missions for a client */
export interface Project {
  id: string;
  license_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** Mission table row */
export interface Mission {
  id: string;
  license_id: string;
  project_id: string | null;
  name: string;
  scenario: ScenarioType;
  status: MissionStatus;
  analysis_id: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Document table row */
export interface Document {
  id: string;
  mission_id: string | null;
  project_id: string | null;
  type: DocumentType;
  filename: string;
  storage_path: string;
  file_size: number | null;
  content_hash: string | null;
  status: DocumentStatus;
  added_at: string;
}

/** Ecriture comptable table row (parsed from FEC by N8N) */
export interface Ecriture {
  id: string;
  mission_id: string;
  document_id: string | null;
  journal_code: string | null;
  journal_lib: string | null;
  ecriture_num: string | null;
  ecriture_date: string | null;
  compte_num: string | null;
  compte_lib: string | null;
  comp_aux_num: string | null;
  comp_aux_lib: string | null;
  piece_ref: string | null;
  piece_date: string | null;
  ecriture_lib: string | null;
  debit: number;
  credit: number;
  lettrage: string | null;
  date_lettrage: string | null;
  valid_date: string | null;
}

/** Match details JSONB structure */
export interface MatchDetails {
  montant_match: boolean;
  date_match: boolean;
  reference_match: boolean;
  details?: string;
}

/** Rapprochement table row (entry-to-document matching) */
export interface Rapprochement {
  id: string;
  mission_id: string;
  ecriture_id: string;
  document_id: string | null;
  match_type: MatchType;
  match_details: MatchDetails | null;
  confidence: ConfidenceLevel | null;
  created_by: string;
}

/** Explicability JSONB structure for a signal */
export interface SignalExplicability {
  reasoning: string;
  documents_compared: Array<{
    document: string;
    element: string;
  }>;
  rule_source: string;
}

/** Signal table row */
export interface Signal {
  id: string;
  mission_id: string;
  document_id: string | null;
  ecriture_id: string | null;
  rapprochement_id: string | null;
  type: SignalType;
  description: string;
  source_document: string | null;
  source_page: number | null;
  source_extract: string | null;
  rule_triggered: string | null;
  rule_description: string | null;
  priority: SignalPriority;
  explicability: SignalExplicability | null;
  confidence_score: number | null;
  confidence_explanation: string | null;
  human_decision: HumanDecision;
  human_comment: string | null;
  decided_at: string | null;
}

/** Deliverable table row */
export interface Deliverable {
  id: string;
  mission_id: string;
  type: DeliverableType;
  format: DeliverableFormat;
  title: string;
  generated_at: string;
  content_json: Record<string, unknown> | null;
  storage_path: string | null;
}

/** Trace table row (audit trail entry) */
export interface Trace {
  id: string;
  mission_id: string;
  license_id: string;
  timestamp: string;
  actor: ActorType;
  actor_name: string;
  action: TraceAction;
  target_type: TraceTargetType | null;
  target_id: string | null;
  details: string | null;
}

/** Completeness table row (document completeness assessment) */
export interface Completeness {
  id: string;
  mission_id: string;
  doc_type: string;
  label: string;
  required: boolean;
  status: DocumentStatus;
  count: number;
  note: string | null;
}

// -----------------------------------------------------------------------------
// Insert Types (INSERT — omit server-generated fields)
// -----------------------------------------------------------------------------

export interface LicenseInsert {
  id?: string;
  license_key: string;
  activated_at?: string | null;
  valid_until: string;
  features?: ScenarioType[];
  max_missions?: number;
  status?: LicenseStatus;
  created_at?: string;
}

export interface ProfileInsert {
  id?: string;
  license_id: string;
  name: string;
  cabinet: string;
  inscription_cncc?: string | null;
  email?: string | null;
  created_at?: string;
  updated_at?: string | null;
}

export interface ProjectInsert {
  id?: string;
  license_id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MissionInsert {
  id?: string;
  license_id: string;
  project_id?: string | null;
  name: string;
  scenario: ScenarioType;
  status?: MissionStatus;
  analysis_id?: string | null;
  company_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentInsert {
  id?: string;
  mission_id?: string | null;
  project_id?: string | null;
  type: DocumentType;
  filename: string;
  storage_path: string;
  file_size?: number | null;
  content_hash?: string | null;
  status?: DocumentStatus;
  added_at?: string;
}

export interface EcritureInsert {
  id?: string;
  mission_id: string;
  document_id?: string | null;
  journal_code?: string | null;
  journal_lib?: string | null;
  ecriture_num?: string | null;
  ecriture_date?: string | null;
  compte_num?: string | null;
  compte_lib?: string | null;
  comp_aux_num?: string | null;
  comp_aux_lib?: string | null;
  piece_ref?: string | null;
  piece_date?: string | null;
  ecriture_lib?: string | null;
  debit?: number;
  credit?: number;
  lettrage?: string | null;
  date_lettrage?: string | null;
  valid_date?: string | null;
}

export interface RapprochementInsert {
  id?: string;
  mission_id: string;
  ecriture_id: string;
  document_id?: string | null;
  match_type: MatchType;
  match_details?: MatchDetails | null;
  confidence?: ConfidenceLevel | null;
  created_by?: string;
}

export interface SignalInsert {
  id?: string;
  mission_id: string;
  license_id?: string;
  document_id?: string | null;
  ecriture_id?: string | null;
  rapprochement_id?: string | null;
  type: SignalType;
  description: string;
  source_document?: string | null;
  source_page?: number | null;
  source_extract?: string | null;
  rule_triggered?: string | null;
  rule_description?: string | null;
  priority: SignalPriority;
  explicability?: SignalExplicability | null;
  confidence_score?: number | null;
  confidence_explanation?: string | null;
  human_decision?: HumanDecision;
  human_comment?: string | null;
  decided_at?: string | null;
}

export interface DeliverableInsert {
  id?: string;
  mission_id: string;
  license_id?: string;
  type: DeliverableType;
  format: DeliverableFormat;
  title: string;
  generated_at?: string;
  content_json?: Record<string, unknown> | null;
  storage_path?: string | null;
}

export interface TraceInsert {
  id?: string;
  mission_id: string;
  license_id: string;
  timestamp?: string;
  actor: ActorType;
  actor_name: string;
  action: TraceAction;
  target_type?: TraceTargetType | null;
  target_id?: string | null;
  details?: string | null;
}

export interface CompletenessInsert {
  id?: string;
  mission_id: string;
  license_id?: string;
  doc_type: string;
  label: string;
  required?: boolean;
  status: DocumentStatus;
  count?: number;
  note?: string | null;
}

// -----------------------------------------------------------------------------
// Update Types (UPDATE — all fields optional except id)
// -----------------------------------------------------------------------------

export interface LicenseUpdate {
  license_key?: string;
  activated_at?: string | null;
  valid_until?: string;
  features?: ScenarioType[];
  max_missions?: number;
  status?: LicenseStatus;
}

export interface ProfileUpdate {
  name?: string;
  cabinet?: string;
  inscription_cncc?: string | null;
  email?: string | null;
  updated_at?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string | null;
  updated_at?: string;
}

export interface MissionUpdate {
  name?: string;
  project_id?: string | null;
  scenario?: ScenarioType;
  status?: MissionStatus;
  analysis_id?: string | null;
  company_id?: string | null;
  updated_at?: string;
}

export interface DocumentUpdate {
  type?: DocumentType;
  filename?: string;
  storage_path?: string;
  file_size?: number | null;
  content_hash?: string | null;
  status?: DocumentStatus;
}

export interface SignalUpdate {
  human_decision?: HumanDecision;
  human_comment?: string | null;
  decided_at?: string | null;
}

export interface DeliverableUpdate {
  title?: string;
  generated_at?: string;
  content_json?: Record<string, unknown> | null;
  storage_path?: string | null;
}

// -----------------------------------------------------------------------------
// Database Type Interface (for Supabase client generic)
// -----------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      licenses: {
        Row: License;
        Insert: LicenseInsert;
        Update: LicenseUpdate;
      };
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      projects: {
        Row: Project;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
      };
      missions: {
        Row: Mission;
        Insert: MissionInsert;
        Update: MissionUpdate;
      };
      documents: {
        Row: Document;
        Insert: DocumentInsert;
        Update: DocumentUpdate;
      };
      ecritures: {
        Row: Ecriture;
        Insert: EcritureInsert;
        Update: Partial<EcritureInsert>;
      };
      rapprochements: {
        Row: Rapprochement;
        Insert: RapprochementInsert;
        Update: Partial<RapprochementInsert>;
      };
      signals: {
        Row: Signal;
        Insert: SignalInsert;
        Update: SignalUpdate;
      };
      deliverables: {
        Row: Deliverable;
        Insert: DeliverableInsert;
        Update: DeliverableUpdate;
      };
      traces: {
        Row: Trace;
        Insert: TraceInsert;
        Update: never; // Traces are immutable — no UPDATE allowed
      };
      completeness: {
        Row: Completeness;
        Insert: CompletenessInsert;
        Update: Partial<CompletenessInsert>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      scenario_type: ScenarioType;
      mission_status: MissionStatus;
      signal_priority: SignalPriority;
      human_decision: HumanDecision;
      actor_type: ActorType;
      document_status: DocumentStatus;
      deliverable_type: DeliverableType;
      deliverable_format: DeliverableFormat;
      document_type: DocumentType;
      signal_type: SignalType;
      match_type: MatchType;
      confidence_level: ConfidenceLevel;
      license_status: LicenseStatus;
      trace_action: TraceAction;
      trace_target_type: TraceTargetType;
    };
  };
}
