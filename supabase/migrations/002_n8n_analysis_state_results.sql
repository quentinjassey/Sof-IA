-- Add results_payload column to n8n_analysis_state for WF-08 Results Retrieval.
-- When Sondage (or other scenario) finishes, it stores the full Sof'IA payload here.
-- WF-08 GET /missions/analyze/:id/results reads this and returns it to Next.js.
ALTER TABLE n8n_analysis_state
ADD COLUMN IF NOT EXISTS results_payload JSONB;
COMMENT ON COLUMN n8n_analysis_state.results_payload IS 'Full N8N results payload (completeness, ecritures, rapprochements, signals, deliverables, traces) for GET /results';