-- 004_add_projects.sql
-- Introduit le concept de "projet client" : un projet regroupe des documents
-- et plusieurs missions (analyses) pour un meme client.
-- Les documents sont uploades une seule fois au niveau projet et partages
-- entre les differentes analyses (sondage_ca, cutoff, pointage).

-- ============================================================
-- TABLE: projects
-- Un projet client regroupe documents et analyses.
-- ============================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_license ON projects(license_id);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- Auto-update updated_at
CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS for projects
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own projects"
    ON projects FOR SELECT
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users create own projects"
    ON projects FOR INSERT
    WITH CHECK (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users update own projects"
    ON projects FOR UPDATE
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

CREATE POLICY "Users delete own projects"
    ON projects FOR DELETE
    USING (license_id = COALESCE(
        current_setting('app.license_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    ));

-- ============================================================
-- Add project_id to missions
-- ============================================================

ALTER TABLE missions ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_missions_project ON missions(project_id);

-- ============================================================
-- Add project_id to documents, make mission_id nullable
-- ============================================================

ALTER TABLE documents ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE documents ALTER COLUMN mission_id DROP NOT NULL;
CREATE INDEX idx_documents_project ON documents(project_id);

COMMENT ON TABLE projects IS 'Projets clients. Regroupe documents et analyses (missions) pour un meme client.';
COMMENT ON COLUMN missions.project_id IS 'Projet parent. Toutes les missions d''un projet partagent les memes documents.';
COMMENT ON COLUMN documents.project_id IS 'Projet proprietaire du document. Les documents sont partages entre les missions du projet.';
COMMENT ON COLUMN documents.mission_id IS 'Nullable. Conserve pour compatibilite avec les anciennes missions sans projet.';
