-- ============================================================
-- SOF'IA POC - Seed Data
-- supabase/seed.sql
--
-- Test license keys for the POC / HackAudit competition.
-- Run after 001_initial.sql migration.
-- ============================================================

-- Test license keys
-- All keys grant access to all 3 scenarios and are valid until end of 2026.
INSERT INTO licenses (license_key, valid_until, features, max_missions, status) VALUES
    (
        'DEMO-SOFI-2026-0001',
        '2026-12-31T23:59:59Z',
        '["sondage_ca", "cutoff", "pointage"]'::jsonb,
        -1,
        'active'
    ),
    (
        'DEMO-SOFI-2026-0002',
        '2026-12-31T23:59:59Z',
        '["sondage_ca", "cutoff", "pointage"]'::jsonb,
        -1,
        'active'
    ),
    (
        'DEMO-SOFI-2026-JURY',
        '2026-12-31T23:59:59Z',
        '["sondage_ca", "cutoff", "pointage"]'::jsonb,
        -1,
        'active'
    );
