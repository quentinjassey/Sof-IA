-- 003_add_confidence_score.sql
-- Ajoute un score de confiance (0-100) et son explication LLM sur chaque signal.
-- Le score reflète la fiabilité de la détection par Sof'IA, pas la gravité du constat.

ALTER TABLE signals ADD COLUMN confidence_score SMALLINT DEFAULT NULL
  CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));

ALTER TABLE signals ADD COLUMN confidence_explanation TEXT DEFAULT NULL;

COMMENT ON COLUMN signals.confidence_score IS 'Score de confiance Sof''IA (0-100). Reflète la fiabilité de la détection, pas la gravité.';
COMMENT ON COLUMN signals.confidence_explanation IS 'Explication LLM du score de confiance (générée par Gemini Flash via OpenRouter).';
