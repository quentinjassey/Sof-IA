-- 002_add_company_id.sql
-- Adds company_id column to missions table for multi-company pointage scenario
ALTER TABLE missions ADD COLUMN company_id TEXT;
