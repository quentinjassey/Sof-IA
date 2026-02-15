-- ============================================================
-- SOF'IA POC - Initial Database Schema
-- supabase/migrations/001_initial.sql
--
-- Complete PostgreSQL schema for the SOF'IA document
-- pre-analysis tool for statutory auditors (CAC).
--
-- Stack: Next.js (Vercel) + Supabase + N8N
-- Reference: ARCHITECTURE_POC_SOFIA_ANNEXES.md Section B
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CUSTOM TYPES (ENUMS)
-- ============================================================

CREATE TYPE scenario_type AS ENUM ('sondage_ca', 'cutoff', 'pointage');

CREATE TYPE mission_status AS ENUM (
    'created',
    'documents_ready',
    'uploading',
    'upload_failed',
    'analyzing',
    'analysis_failed',
    'analyzed',
    'in_review',
    'completed'
);

CREATE TYPE license_status AS ENUM ('active', 'expired', 'revoked');

CREATE TYPE document_type AS ENUM (
    'fec',
    'facture_vente',
    'facture_achat',
    'bon_livraison',
    'contrat',
    'annexe',
    'bilan',
    'compte_resultat',
    'autre'
);

CREATE TYPE document_status AS ENUM ('present', 'missing', 'incomplete');

CREATE TYPE match_type AS ENUM ('exact', 'partial', 'missing');

CREATE TYPE confidence_level AS ENUM ('high', 'medium', 'low');

CREATE TYPE signal_type AS ENUM (
    'absence_piece',
    'incoherence_date',
    'incoherence_montant',
    'rupture_chaine',
    'rattachement_temporel',
    'incompletude'
);

CREATE TYPE signal_priority AS ENUM ('low', 'medium', 'high');

CREATE TYPE human_decision AS ENUM ('pending', 'validated', 'rejected', 'to_investigate');

CREATE TYPE deliverable_type AS ENUM (
    'checklist_completude',
    'tableau_signaux',
    'synthese_preanalyse',
    'journal_tracabilite'
);

CREATE TYPE deliverable_format AS ENUM ('pdf', 'xlsx');

CREATE TYPE trace_actor AS ENUM ('sofia', 'user');

CREATE TYPE trace_action AS ENUM (
    'mission_created',
    'mission_updated',
    'mission_deleted',
    'document_added',
    'document_deleted',
    'analysis_started',
    'analysis_completed',
    'analysis_failed',
    'fec_parsed',
    'pdf_extracted',
    'rapprochement_completed',
    'signals_generated',
    'deliverables_generated',
    'signal_validated',
    'signal_rejected',
    'signal_to_investigate',
    'deliverables_regenerated',
    'deliverables_exported'
);

CREATE TYPE trace_target_type AS ENUM ('mission', 'document', 'signal', 'deliverable');

-- ============================================================
-- TABLE: licenses
-- License keys for authentication. Pre-populated by admin.
-- ============================================================

CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT UNIQUE NOT NULL,
    activated_at TIMESTAMPTZ,
    valid_until TIMESTAMPTZ NOT NULL,
    features JSONB NOT NULL DEFAULT '["sondage_ca", "cutoff", "pointage"]'::jsonb,
    max_missions INTEGER NOT NULL DEFAULT -1,
    status license_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for license key lookups during authentication
CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_status ON licenses(status);

-- ============================================================
-- TABLE: profiles
-- CAC (statutory auditor) professional profiles.
-- One profile per license (UNIQUE constraint).
-- Identity appears in all deliverables and audit trail.
-- ============================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cabinet TEXT NOT NULL,
    inscription_cncc TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(license_id)
);

CREATE INDEX idx_profiles_license ON profiles(license_id);

-- ============================================================
-- TABLE: missions
-- Analysis missions with scenario type and status tracking.
-- Each mission follows a lifecycle from creation to completion.
-- ============================================================

CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    scenario scenario_type NOT NULL,
    status mission_status NOT NULL DEFAULT 'created',
    analysis_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_missions_license ON missions(license_id);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_created_at ON missions(created_at);

-- ============================================================
-- TABLE: documents
-- Uploaded file metadata. Files stored in Supabase Storage
-- at path: documents/{mission_id}/{filename}
-- ============================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    type document_type NOT NULL,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size INTEGER,
    content_hash TEXT,
    status document_status NOT NULL DEFAULT 'present',
    added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_mission ON documents(mission_id);
CREATE INDEX idx_documents_license ON documents(license_id);
CREATE INDEX idx_documents_type ON documents(type);

-- ============================================================
-- TABLE: completeness
-- Documentary completeness tracking (analysis result).
-- Maps expected documents per scenario vs received documents.
-- Used for the completeness checklist deliverable.
-- ============================================================

CREATE TABLE completeness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    label TEXT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT true,
    status document_status NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_completeness_mission ON completeness(mission_id);
CREATE INDEX idx_completeness_license ON completeness(license_id);

-- ============================================================
-- TABLE: ecritures
-- Parsed FEC (Fichier des Ecritures Comptables) entries.
-- Populated by N8N during analysis (WF-03: FEC parsing).
-- Columns follow the DGFiP standard FEC format.
-- ============================================================

CREATE TABLE ecritures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id),
    journal_code TEXT,
    journal_lib TEXT,
    ecriture_num TEXT,
    ecriture_date DATE,
    compte_num TEXT,
    compte_lib TEXT,
    comp_aux_num TEXT,
    comp_aux_lib TEXT,
    piece_ref TEXT,
    piece_date DATE,
    ecriture_lib TEXT,
    debit NUMERIC(15,2) NOT NULL DEFAULT 0,
    credit NUMERIC(15,2) NOT NULL DEFAULT 0,
    lettrage TEXT,
    date_lettrage DATE,
    valid_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ecritures_mission ON ecritures(mission_id);
CREATE INDEX idx_ecritures_license ON ecritures(license_id);
CREATE INDEX idx_ecritures_piece_ref ON ecritures(piece_ref);
CREATE INDEX idx_ecritures_date ON ecritures(ecriture_date);
CREATE INDEX idx_ecritures_compte ON ecritures(compte_num);

-- ============================================================
-- TABLE: rapprochements
-- Document-to-entry matching results.
-- Links FEC entries to their supporting documents.
-- match_type: exact (full match), partial (some fields match),
-- missing (no supporting document found).
-- ============================================================

CREATE TABLE rapprochements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    ecriture_id UUID NOT NULL REFERENCES ecritures(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id),
    match_type match_type NOT NULL,
    match_details JSONB,
    confidence confidence_level,
    created_by TEXT NOT NULL DEFAULT 'sofia',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rapprochements_mission ON rapprochements(mission_id);
CREATE INDEX idx_rapprochements_license ON rapprochements(license_id);
CREATE INDEX idx_rapprochements_ecriture ON rapprochements(ecriture_id);
CREATE INDEX idx_rapprochements_document ON rapprochements(document_id);

-- ============================================================
-- TABLE: signals
-- Detected documentary signals (alerts for CAC attention).
--
-- IMPORTANT: These are documentary signals, NEVER qualified
-- anomalies. Each signal includes full explicability:
-- reasoning, compared documents, rule source, source extract.
--
-- All signals start with human_decision = 'pending'.
-- The CAC must explicitly decide on each signal.
-- ============================================================

CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id),
    ecriture_id UUID REFERENCES ecritures(id),
    rapprochement_id UUID REFERENCES rapprochements(id),
    type signal_type NOT NULL,
    description TEXT NOT NULL,
    source_document TEXT,
    source_page INTEGER,
    source_extract TEXT,
    rule_triggered TEXT,
    rule_description TEXT,
    priority signal_priority NOT NULL,
    explicability JSONB,
    human_decision human_decision NOT NULL DEFAULT 'pending',
    human_comment TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signals_mission ON signals(mission_id);
CREATE INDEX idx_signals_license ON signals(license_id);
CREATE INDEX idx_signals_priority ON signals(priority);
CREATE INDEX idx_signals_decision ON signals(human_decision);
CREATE INDEX idx_signals_type ON signals(type);
CREATE INDEX idx_signals_rule ON signals(rule_triggered);
CREATE INDEX idx_signals_created_at ON signals(created_at);

-- ============================================================
-- TABLE: deliverables
-- Generated deliverable files (PDF/XLSX).
-- Files stored in Supabase Storage at:
--   deliverables/{mission_id}/{type}.{format}
--
-- 4 required deliverable types:
-- 1. checklist_completude - Documentary completeness checklist
-- 2. tableau_signaux - Documentary signals table (XLSX)
-- 3. synthese_preanalyse - Pre-analysis synthesis (NEP 230)
-- 4. journal_tracabilite - Traceability journal
-- ============================================================

CREATE TABLE deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    type deliverable_type NOT NULL,
    format deliverable_format NOT NULL,
    title TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    content_json JSONB,
    storage_path TEXT
);

CREATE INDEX idx_deliverables_mission ON deliverables(mission_id);
CREATE INDEX idx_deliverables_license ON deliverables(license_id);
CREATE INDEX idx_deliverables_type ON deliverables(type);

-- ============================================================
-- TABLE: traces
-- IMMUTABLE audit trail (NEP 230 compliance).
--
-- CRITICAL: This table is APPEND-ONLY.
-- No UPDATE or DELETE operations are permitted.
-- Every action (Sofia + CAC) creates a trace entry.
--
-- actor = 'sofia' => actor_name = "Sof'IA"
-- actor = 'user'  => actor_name = "{name}, CAC (CNCC-{number})"
-- ============================================================

CREATE TABLE traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor trace_actor NOT NULL,
    actor_name TEXT NOT NULL,
    action trace_action NOT NULL,
    target_type trace_target_type,
    target_id UUID,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_traces_mission ON traces(mission_id);
CREATE INDEX idx_traces_license ON traces(license_id);
CREATE INDEX idx_traces_timestamp ON traces(timestamp);
CREATE INDEX idx_traces_actor ON traces(actor);
CREATE INDEX idx_traces_action ON traces(action);
CREATE INDEX idx_traces_created_at ON traces(created_at);

-- ============================================================
-- IMMUTABILITY: Prevent UPDATE and DELETE on traces table
-- The audit trail must be immutable for NEP 230 compliance.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_trace_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Le journal de tracabilite est immuable. Les modifications et suppressions ne sont pas autorisees.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER traces_no_update
    BEFORE UPDATE ON traces
    FOR EACH ROW
    EXECUTE FUNCTION prevent_trace_modification();

CREATE TRIGGER traces_no_delete
    BEFORE DELETE ON traces
    FOR EACH ROW
    EXECUTE FUNCTION prevent_trace_modification();

-- ============================================================
-- AUTO-UPDATE: updated_at timestamp trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_missions_updated_at
    BEFORE UPDATE ON missions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
--
-- All tables have RLS enabled for data isolation.
-- Each license sees only its own data.
--
-- For the POC: RLS is primarily enforced via API routes
-- using the service role key + license_id from the session
-- cookie. The policies below provide an additional layer
-- of security and are ready for production use.
--
-- The app.license_id setting is injected by the API routes
-- before executing queries:
--   SET LOCAL app.license_id = '<uuid>';
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE completeness ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecritures ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapprochements ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE traces ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: Service role bypass
-- The service role key (used by API routes) bypasses RLS.
-- These policies are for anon/authenticated roles if needed.
-- ============================================================

-- Licenses: read-only for validation (anon can check license keys)
CREATE POLICY "Anon can validate license keys"
    ON licenses FOR SELECT
    TO anon
    USING (true);

-- Licenses: service role has full access (implicit bypass)

-- Profiles: users can only see/modify their own profile
CREATE POLICY "Users see own profile"
    ON profiles FOR SELECT
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users create own profile"
    ON profiles FOR INSERT
    WITH CHECK (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users update own profile"
    ON profiles FOR UPDATE
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

-- Missions: users can only access their own missions
CREATE POLICY "Users see own missions"
    ON missions FOR SELECT
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users create own missions"
    ON missions FOR INSERT
    WITH CHECK (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users update own missions"
    ON missions FOR UPDATE
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users delete own missions"
    ON missions FOR DELETE
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

-- Documents: scoped to license
CREATE POLICY "Users see own documents"
    ON documents FOR SELECT
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users create own documents"
    ON documents FOR INSERT
    WITH CHECK (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users delete own documents"
    ON documents FOR DELETE
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

-- Completeness: scoped to license
CREATE POLICY "Users see own completeness"
    ON completeness FOR SELECT
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users create own completeness"
    ON completeness FOR INSERT
    WITH CHECK (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

-- Ecritures: scoped to license
CREATE POLICY "Users see own ecritures"
    ON ecritures FOR SELECT
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users create own ecritures"
    ON ecritures FOR INSERT
    WITH CHECK (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

-- Rapprochements: scoped to license
CREATE POLICY "Users see own rapprochements"
    ON rapprochements FOR SELECT
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users create own rapprochements"
    ON rapprochements FOR INSERT
    WITH CHECK (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

-- Signals: scoped to license (read + create + update for decisions)
CREATE POLICY "Users see own signals"
    ON signals FOR SELECT
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users create own signals"
    ON signals FOR INSERT
    WITH CHECK (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users update own signals"
    ON signals FOR UPDATE
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

-- Deliverables: scoped to license
CREATE POLICY "Users see own deliverables"
    ON deliverables FOR SELECT
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users create own deliverables"
    ON deliverables FOR INSERT
    WITH CHECK (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users update own deliverables"
    ON deliverables FOR UPDATE
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

-- Traces: scoped to license (INSERT only - no update/delete per triggers)
CREATE POLICY "Users see own traces"
    ON traces FOR SELECT
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users create own traces"
    ON traces FOR INSERT
    WITH CHECK (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

-- ============================================================
-- STORAGE BUCKETS (reference - create via Supabase Dashboard)
--
-- Bucket: documents
--   Path pattern: documents/{mission_id}/{filename}
--   Access: Signed URLs (1h validity) for N8N download
--
-- Bucket: deliverables
--   Path pattern: deliverables/{mission_id}/{type}.{format}
--   Access: Signed URLs for CAC download
-- ============================================================

-- Note: Storage buckets and their policies must be created
-- via the Supabase Dashboard or supabase CLI, not via SQL.
-- The following is for documentation reference:
--
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('documents', 'documents', false),
--   ('deliverables', 'deliverables', false);

-- ============================================================
-- COMMENTS (for documentation)
-- ============================================================

COMMENT ON TABLE licenses IS 'License keys for app authentication. Pre-populated by admin. No user registration needed.';
COMMENT ON TABLE profiles IS 'CAC professional profiles (name, cabinet, CNCC number). One profile per license. Appears in all deliverables.';
COMMENT ON TABLE missions IS 'Analysis missions. Each mission has a scenario type and follows a status lifecycle.';
COMMENT ON TABLE documents IS 'Uploaded document metadata. Actual files stored in Supabase Storage.';
COMMENT ON TABLE completeness IS 'Documentary completeness tracking. Expected vs received documents per scenario.';
COMMENT ON TABLE ecritures IS 'Parsed FEC accounting entries. Follows DGFiP standard FEC format columns.';
COMMENT ON TABLE rapprochements IS 'Document-to-entry matching results. Links FEC entries to supporting documents.';
COMMENT ON TABLE signals IS 'Documentary signals (alerts). Each includes full explicability. CAC must validate/reject each signal.';
COMMENT ON TABLE deliverables IS 'Generated deliverable files (PDF/XLSX). 4 required types per mission.';
COMMENT ON TABLE traces IS 'IMMUTABLE audit trail (NEP 230). Records all Sofia and CAC actions chronologically.';

COMMENT ON COLUMN signals.human_decision IS 'CAC decision: pending (default), validated, rejected, or to_investigate. No signal can be auto-dismissed.';
COMMENT ON COLUMN signals.explicability IS 'JSON object with reasoning, documents_compared, and rule_source for full explicability.';
COMMENT ON COLUMN traces.actor IS 'sofia = automated action by the AI tool, user = human CAC action.';
COMMENT ON COLUMN traces.actor_name IS 'For sofia: "Sof''IA". For user: "{name}, CAC (CNCC-{number})".';
