# SOF'IA — Annexes techniques pour implémentation

> Complément à ARCHITECTURE_POC_SOFIA.md (v3.0)
> Stack : Next.js (Vercel) + Supabase + N8N
> Ce document contient tous les détails nécessaires pour implémenter le POC.

---

## A. Résilience réseau & gestion d'erreurs

### A.1 Principe

L'analyse IA est asynchrone et dépend de N8N. Bien que la webapp soit toujours en ligne, des erreurs peuvent survenir : timeout N8N, erreur LLM, échec d'upload. L'app doit gérer chaque cas sans perte de données ni blocage de l'utilisateur.

> Note v3 : Le mode offline complet de la v2 (Electron) est supprimé. La webapp nécessite une connexion. En revanche, la gestion des erreurs N8N reste importante.

### A.2 États de la mission

```
created → documents_ready → uploading → analyzing → analyzed → in_review → completed
                              │             │
                              ▼             ▼
                          upload_failed  analysis_failed
```

> Simplifié par rapport à la v2 : plus de `analyzing_pending`, `download_failed`, etc.
> Si N8N échoue, on passe en `analysis_failed` et le CAC peut relancer.

### A.3 Cas d'erreur et comportement attendu

| Erreur | État mission | Comportement UI | Action utilisateur |
|---|---|---|---|
| Upload échoue (timeout, erreur réseau) | `upload_failed` | "L'envoi des documents a échoué. Veuillez réessayer." + bouton "Réessayer" | Clic sur "Réessayer" → relance l'upload |
| N8N timeout pendant l'analyse | `analysis_failed` | "L'analyse a pris trop de temps. Le serveur est peut-être surchargé." + bouton "Relancer" | Clic sur "Relancer" → relance POST /analyze |
| N8N erreur LLM (provider down) | `analysis_failed` | "Erreur lors de l'analyse IA. Le service sera rétabli prochainement." + bouton "Relancer" | Attendre puis relancer |
| Résultats expirés (TTL 48h) | `analysis_failed` | "Les résultats de cette analyse ont expiré. Relancez la pré-analyse." | Relancer l'analyse complète |
| Erreur import résultats | `analysis_failed` | "Erreur lors de l'importation des résultats." + bouton "Réessayer l'import" | Réessayer l'import (les résultats sont encore sur N8N) |

### A.4 TTL des résultats côté N8N

N8N conserve les résultats d'une analyse pendant **48 heures** après complétion. Passé ce délai, ils sont purgés.

### A.5 Implémentation côté API route

```typescript
// lib/services/analysis-orchestrator.ts

interface AnalysisState {
  mission_id: string;
  analysis_id: string | null;
  status: 'idle' | 'uploading' | 'analyzing' | 'importing' | 'completed' | 'failed';
  error: string | null;
  retry_count: number;
}

// Comportement du polling (côté client)
const POLL_INTERVAL_MS = 4000;        // 4 secondes entre chaque poll
const POLL_MAX_DURATION_MS = 600000;  // 10 minutes max de polling
const UPLOAD_TIMEOUT_MS = 60000;      // 1 minute pour l'upload
const IMPORT_TIMEOUT_MS = 30000;      // 30 secondes pour l'import
```

### A.6 Indicateurs UI pendant l'analyse

```
┌─────────────────────────────────────────────────────┐
│  Pré-analyse en cours...                             │
│                                                      │
│  ████████████░░░░░░░░░░░░░░░░░  45%                 │
│                                                      │
│  ✅ Lecture du FEC (1247 écritures)                   │
│  ✅ Extraction des pièces justificatives              │
│  ⏳ Rapprochement écritures ↔ pièces...              │
│  ○  Analyse documentaire                             │
│  ○  Consolidation des signaux                        │
│  ○  Génération des livrables                         │
│                                                      │
│  Temps estimé restant : ~1 min 30                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Erreur lors de la pré-analyse                       │
│                                                      │
│  ████████████░░░░░░░░░░░░░░░░░  45%                 │
│                                                      │
│  ❌ L'analyse a échoué après l'étape 3/6.            │
│  Le serveur n'a pas pu terminer le traitement.       │
│                                                      │
│  [Relancer la pré-analyse]    [Annuler]              │
└─────────────────────────────────────────────────────┘
```

---

## B. Schéma Supabase (PostgreSQL)

```sql
-- supabase/migrations/001_initial.sql

-- ============================================
-- Configuration & Authentification
-- ============================================

CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT UNIQUE NOT NULL,
    activated_at TIMESTAMPTZ,
    valid_until TIMESTAMPTZ NOT NULL,
    features JSONB NOT NULL DEFAULT '["sondage_ca", "cutoff", "pointage"]',
    max_missions INTEGER NOT NULL DEFAULT -1,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cabinet TEXT NOT NULL,
    inscription_cncc TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(license_id)  -- Un profil par licence
);

-- ============================================
-- Missions
-- ============================================

CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    scenario TEXT NOT NULL CHECK (scenario IN ('sondage_ca', 'cutoff', 'pointage')),
    status TEXT NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'documents_ready', 'uploading', 'upload_failed',
                          'analyzing', 'analysis_failed', 'analyzed', 'in_review', 'completed')),
    analysis_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_missions_license ON missions(license_id);

-- ============================================
-- Documents
-- ============================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('fec', 'facture_vente', 'facture_achat',
                                       'bon_livraison', 'contrat', 'annexe',
                                       'bilan', 'compte_resultat', 'autre')),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size INTEGER,
    content_hash TEXT,
    status TEXT NOT NULL DEFAULT 'present'
        CHECK (status IN ('present', 'missing', 'incomplete')),
    added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_mission ON documents(mission_id);

-- ============================================
-- Écritures comptables (parsées du FEC par N8N)
-- ============================================

CREATE TABLE ecritures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
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
    valid_date DATE
);

CREATE INDEX idx_ecritures_mission ON ecritures(mission_id);
CREATE INDEX idx_ecritures_piece_ref ON ecritures(piece_ref);
CREATE INDEX idx_ecritures_date ON ecritures(ecriture_date);

-- ============================================
-- Rapprochements
-- ============================================

CREATE TABLE rapprochements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    ecriture_id UUID NOT NULL REFERENCES ecritures(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id),
    match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'partial', 'missing')),
    match_details JSONB,
    confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
    created_by TEXT NOT NULL DEFAULT 'sofia'
);

CREATE INDEX idx_rapprochements_mission ON rapprochements(mission_id);

-- ============================================
-- Signaux documentaires
-- ============================================

CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id),
    ecriture_id UUID REFERENCES ecritures(id),
    rapprochement_id UUID REFERENCES rapprochements(id),
    type TEXT NOT NULL CHECK (type IN ('absence_piece', 'incoherence_date',
                                       'incoherence_montant', 'rupture_chaine',
                                       'rattachement_temporel', 'incompletude')),
    description TEXT NOT NULL,
    source_document TEXT,
    source_page INTEGER,
    source_extract TEXT,
    rule_triggered TEXT,
    rule_description TEXT,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    explicability JSONB,
    human_decision TEXT NOT NULL DEFAULT 'pending'
        CHECK (human_decision IN ('pending', 'validated', 'rejected', 'to_investigate')),
    human_comment TEXT,
    decided_at TIMESTAMPTZ
);

CREATE INDEX idx_signals_mission ON signals(mission_id);
CREATE INDEX idx_signals_priority ON signals(priority);
CREATE INDEX idx_signals_decision ON signals(human_decision);

-- ============================================
-- Livrables
-- ============================================

CREATE TABLE deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('checklist_completude', 'tableau_signaux',
                                       'synthese_preanalyse', 'journal_tracabilite')),
    format TEXT NOT NULL CHECK (format IN ('pdf', 'xlsx')),
    title TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    content_json JSONB,
    storage_path TEXT
);

CREATE INDEX idx_deliverables_mission ON deliverables(mission_id);

-- ============================================
-- Journal de traçabilité
-- ============================================

CREATE TABLE traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor TEXT NOT NULL CHECK (actor IN ('sofia', 'user')),
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN (
        'mission_created', 'mission_updated', 'mission_deleted',
        'document_added', 'document_deleted',
        'analysis_started', 'analysis_completed', 'analysis_failed',
        'fec_parsed', 'pdf_extracted', 'rapprochement_completed',
        'signals_generated', 'deliverables_generated',
        'signal_validated', 'signal_rejected', 'signal_to_investigate',
        'deliverables_regenerated', 'deliverables_exported'
    )),
    target_type TEXT CHECK (target_type IN ('mission', 'document', 'signal', 'deliverable')),
    target_id UUID,
    details TEXT
);

CREATE INDEX idx_traces_mission ON traces(mission_id);
CREATE INDEX idx_traces_timestamp ON traces(timestamp);

-- ============================================
-- Complétude documentaire (résultat d'analyse)
-- ============================================

CREATE TABLE completeness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    label TEXT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL CHECK (status IN ('present', 'missing', 'incomplete')),
    count INTEGER NOT NULL DEFAULT 0,
    note TEXT
);

CREATE INDEX idx_completeness_mission ON completeness(mission_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Note pour le POC : RLS est appliqué via les API routes (service role key).
-- L'API route injecte le license_id depuis le cookie session et filtre toutes les requêtes.
-- En production, on ajouterait des politiques RLS natives Supabase.

-- Exemple de politique RLS (pour référence / production future) :
-- ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can only see their own missions"
--   ON missions FOR SELECT
--   USING (license_id = current_setting('app.license_id')::uuid);
```

```sql
-- supabase/seed.sql

-- Licences de test pour le POC
INSERT INTO licenses (license_key, valid_until, features, status) VALUES
    ('DEMO-SOFI-2026-0001', '2027-12-31T23:59:59Z', '["sondage_ca", "cutoff", "pointage"]', 'active'),
    ('DEMO-SOFI-2026-0002', '2027-12-31T23:59:59Z', '["sondage_ca", "cutoff", "pointage"]', 'active'),
    ('DEMO-SOFI-2026-JURY', '2027-12-31T23:59:59Z', '["sondage_ca", "cutoff", "pointage"]', 'active');
```

---

## C. Mapping documents attendus par scénario

### C.1 Scénario : Sondage sur le chiffre d'affaires (`sondage_ca`)

| Type | Label | Requis | Description |
|---|---|---|---|
| `fec` | Fichier des Écritures Comptables (FEC) | oui | Export FEC au format DGFiP |
| `facture_vente` | Factures de vente (échantillon) | oui | Factures sélectionnées pour le sondage |
| `bon_livraison` | Bons de livraison | oui | BL correspondant aux factures |
| `contrat` | Contrats clients | non | Contrats cadres si disponibles |
| `annexe` | Annexe aux comptes annuels | non | Pour vérification cohérence CA |

### C.2 Scénario : Césure d'exercice / Cut-off (`cutoff`)

| Type | Label | Requis | Description |
|---|---|---|---|
| `fec` | Fichier des Écritures Comptables (FEC) | oui | Export FEC au format DGFiP |
| `facture_vente` | Factures de vente (période de clôture) | oui | Factures émises autour du 31/12 |
| `facture_achat` | Factures fournisseurs (période de clôture) | oui | Factures reçues autour du 31/12 |
| `bon_livraison` | Bons de livraison / réception | oui | BL pour les opérations de clôture |
| `contrat` | Contrats (prestations continues) | non | Contrats avec prestations à cheval |

### C.3 Scénario : Pointage des états financiers (`pointage`)

| Type | Label | Requis | Description |
|---|---|---|---|
| `bilan` | Bilan | oui | Bilan de l'exercice |
| `compte_resultat` | Compte de résultat | oui | Compte de résultat de l'exercice |
| `annexe` | Annexe aux comptes annuels | oui | Annexe complète |
| `fec` | Fichier des Écritures Comptables (FEC) | non | Pour vérifications complémentaires |

### C.4 Implémentation

```typescript
// lib/config/expected-documents.ts

export interface ExpectedDocument {
  type: string;
  label: string;
  required: boolean;
}

export const EXPECTED_DOCUMENTS: Record<string, ExpectedDocument[]> = {
  sondage_ca: [
    { type: 'fec', label: 'Fichier des Écritures Comptables (FEC)', required: true },
    { type: 'facture_vente', label: 'Factures de vente (échantillon)', required: true },
    { type: 'bon_livraison', label: 'Bons de livraison', required: true },
    { type: 'contrat', label: 'Contrats clients', required: false },
    { type: 'annexe', label: 'Annexe aux comptes annuels', required: false },
  ],
  cutoff: [
    { type: 'fec', label: 'Fichier des Écritures Comptables (FEC)', required: true },
    { type: 'facture_vente', label: 'Factures de vente (période de clôture)', required: true },
    { type: 'facture_achat', label: 'Factures fournisseurs (période de clôture)', required: true },
    { type: 'bon_livraison', label: 'Bons de livraison / réception', required: true },
    { type: 'contrat', label: 'Contrats (prestations continues)', required: false },
  ],
  pointage: [
    { type: 'bilan', label: 'Bilan', required: true },
    { type: 'compte_resultat', label: 'Compte de résultat', required: true },
    { type: 'annexe', label: 'Annexe aux comptes annuels', required: true },
    { type: 'fec', label: 'Fichier des Écritures Comptables (FEC)', required: false },
  ],
};
```

---

## D. Catalogue de règles de signalement

### D.1 Règles communes (tous scénarios)

| ID règle | Type signal | Description | Priorité par défaut |
|---|---|---|---|
| `DOC-001` | `absence_piece` | Pièce justificative référencée dans le FEC mais non fournie | high |
| `DOC-002` | `incompletude` | Document présent mais incomplet (pages manquantes, illisible) | medium |
| `DOC-003` | `rupture_chaine` | Chaîne documentaire incomplète (ex: facture sans BL) | medium |

### D.2 Règles spécifiques — Sondage CA (`sondage_ca`)

| ID règle | Type signal | Description | Priorité par défaut |
|---|---|---|---|
| `SCA-001` | `absence_piece` | Facture de vente sans bon de livraison associé | high |
| `SCA-002` | `incoherence_montant` | Écart de montant entre la facture et le BL > seuil (ex: 1%) | high |
| `SCA-003` | `incoherence_date` | Écart > 5 jours entre date facture et date BL | medium |
| `SCA-004` | `rupture_chaine` | Écriture FEC avec PieceRef non retrouvée dans les documents | high |
| `SCA-005` | `rattachement_temporel` | Vente comptabilisée en N mais prestation/livraison en N+1 | high |

### D.3 Règles spécifiques — Cut-off (`cutoff`)

| ID règle | Type signal | Description | Priorité par défaut |
|---|---|---|---|
| `CUT-001` | `rattachement_temporel` | Facture datée avant clôture, livraison après clôture | high |
| `CUT-002` | `rattachement_temporel` | Facture datée après clôture, livraison avant clôture | high |
| `CUT-003` | `incoherence_date` | Écart > `cutoff_window_days` entre date facture et date BL autour de la clôture | medium |
| `CUT-004` | `absence_piece` | Opération dans la fenêtre de cut-off sans justificatif de date de livraison | high |
| `CUT-005` | `incoherence_montant` | Facture d'avoir émise en N+1 annulant une vente de N | medium |

### D.4 Règles spécifiques — Pointage (`pointage`)

| ID règle | Type signal | Description | Priorité par défaut |
|---|---|---|---|
| `PTG-001` | `incoherence_montant` | Écart entre un poste du bilan et le montant correspondant dans l'annexe | high |
| `PTG-002` | `incompletude` | Information obligatoire de l'annexe absente (ex: engagements hors bilan) | medium |
| `PTG-003` | `incoherence_montant` | Total bilan actif ≠ total bilan passif | high |
| `PTG-004` | `incompletude` | Poste du compte de résultat > seuil sans note explicative dans l'annexe | medium |
| `PTG-005` | `rupture_chaine` | Variation significative d'un poste entre N et N-1 sans explication dans l'annexe | medium |

### D.5 Implémentation

```typescript
// lib/config/signal-rules.ts

export type SignalType =
  | 'absence_piece'
  | 'incoherence_date'
  | 'incoherence_montant'
  | 'rupture_chaine'
  | 'rattachement_temporel'
  | 'incompletude';

export type Scenario = 'sondage_ca' | 'cutoff' | 'pointage';

export interface SignalRule {
  id: string;
  type: SignalType;
  description: string;
  default_priority: 'low' | 'medium' | 'high';
  applicable_scenarios: Scenario[];
  nep_reference?: string;
}

export const SIGNAL_RULES: SignalRule[] = [
  // Communes
  { id: 'DOC-001', type: 'absence_piece', description: 'Pièce justificative référencée dans le FEC mais non fournie', default_priority: 'high', applicable_scenarios: ['sondage_ca', 'cutoff', 'pointage'] },
  { id: 'DOC-002', type: 'incompletude', description: 'Document présent mais incomplet', default_priority: 'medium', applicable_scenarios: ['sondage_ca', 'cutoff', 'pointage'] },
  { id: 'DOC-003', type: 'rupture_chaine', description: 'Chaîne documentaire incomplète', default_priority: 'medium', applicable_scenarios: ['sondage_ca', 'cutoff', 'pointage'] },

  // Sondage CA
  { id: 'SCA-001', type: 'absence_piece', description: 'Facture de vente sans BL associé', default_priority: 'high', applicable_scenarios: ['sondage_ca'], nep_reference: 'NEP 500' },
  { id: 'SCA-002', type: 'incoherence_montant', description: 'Écart de montant facture/BL > 1%', default_priority: 'high', applicable_scenarios: ['sondage_ca'] },
  { id: 'SCA-003', type: 'incoherence_date', description: 'Écart > 5j entre date facture et date BL', default_priority: 'medium', applicable_scenarios: ['sondage_ca'] },
  { id: 'SCA-004', type: 'rupture_chaine', description: 'PieceRef FEC non retrouvée dans les documents', default_priority: 'high', applicable_scenarios: ['sondage_ca'] },
  { id: 'SCA-005', type: 'rattachement_temporel', description: 'Vente en N, prestation en N+1', default_priority: 'high', applicable_scenarios: ['sondage_ca'], nep_reference: 'NEP 500, §A14' },

  // Cut-off
  { id: 'CUT-001', type: 'rattachement_temporel', description: 'Facture avant clôture, livraison après', default_priority: 'high', applicable_scenarios: ['cutoff'], nep_reference: 'NEP 500, §A14' },
  { id: 'CUT-002', type: 'rattachement_temporel', description: 'Facture après clôture, livraison avant', default_priority: 'high', applicable_scenarios: ['cutoff'] },
  { id: 'CUT-003', type: 'incoherence_date', description: 'Écart > fenêtre cut-off entre facture et BL', default_priority: 'medium', applicable_scenarios: ['cutoff'] },
  { id: 'CUT-004', type: 'absence_piece', description: 'Opération en fenêtre cut-off sans justificatif date livraison', default_priority: 'high', applicable_scenarios: ['cutoff'] },
  { id: 'CUT-005', type: 'incoherence_montant', description: 'Avoir N+1 annulant vente N', default_priority: 'medium', applicable_scenarios: ['cutoff'] },

  // Pointage
  { id: 'PTG-001', type: 'incoherence_montant', description: 'Écart bilan/annexe', default_priority: 'high', applicable_scenarios: ['pointage'] },
  { id: 'PTG-002', type: 'incompletude', description: 'Information obligatoire annexe absente', default_priority: 'medium', applicable_scenarios: ['pointage'] },
  { id: 'PTG-003', type: 'incoherence_montant', description: 'Total actif ≠ total passif', default_priority: 'high', applicable_scenarios: ['pointage'] },
  { id: 'PTG-004', type: 'incompletude', description: 'Poste significatif sans note annexe', default_priority: 'medium', applicable_scenarios: ['pointage'] },
  { id: 'PTG-005', type: 'rupture_chaine', description: 'Variation significative sans explication annexe', default_priority: 'medium', applicable_scenarios: ['pointage'] },
];
```

---

## E. Contrats API Routes (remplace les IPC channels)

### E.1 Convention

Toutes les routes sont dans `app/api/`. Authentification par cookie de session (middleware).
Format de réponse standard :
```typescript
// Succès
{ data: T }

// Erreur
{ error: string, code: string }
```

### E.2 License

```typescript
// POST /api/license/validate
// Pas de cookie requis (c'est la route qui le crée)
Request:  { license_key: string }
Response: { data: { valid: boolean; license_id: string; valid_until: string; features: string[] } }
          | { error: string; code: 'INVALID_KEY' | 'EXPIRED' | 'REVOKED' }
// Side effect: set cookie httpOnly avec { license_key, license_id, activated_at }

// GET /api/license/status
Request:  (cookie)
Response: { data: { valid: boolean; license_id: string; days_remaining: number } }
          | { error: 'NO_SESSION'; code: 'UNAUTHORIZED' }
```

### E.3 Profile

```typescript
// GET /api/profile
Response: { data: Profile | null }

// POST /api/profile
Request:  { name: string; cabinet: string; inscription_cncc?: string; email?: string }
Response: { data: Profile }

// PUT /api/profile
Request:  Partial<{ name: string; cabinet: string; inscription_cncc: string; email: string }>
Response: { data: Profile }
```

### E.4 Missions

```typescript
// GET /api/missions
Response: { data: Mission[] }

// POST /api/missions
Request:  { name: string; scenario: 'sondage_ca' | 'cutoff' | 'pointage' }
Response: { data: Mission }
// Side effect: INSERT trace (mission_created)

// GET /api/missions/[id]
Response: { data: Mission & { stats: MissionStats } }
// MissionStats = { documents_count, signals_count, signals_by_priority, signals_by_decision }

// PUT /api/missions/[id]
Request:  { name?: string; status?: MissionStatus }
Response: { data: Mission }

// DELETE /api/missions/[id]
Response: { data: { success: true } }
// Side effect: CASCADE delete (documents, ecritures, signals, etc.)
```

### E.5 Documents

```typescript
// GET /api/missions/[id]/documents
Response: { data: Document[] }

// POST /api/missions/[id]/documents
Request:  FormData { files: File[]; types: string[] }
Response: { data: Document[] }
// Side effect:
//   1. Upload fichiers vers Supabase Storage (bucket: documents/{mission_id}/)
//   2. INSERT INTO documents
//   3. INSERT trace (document_added)
//   4. Si tous les docs requis sont présents → UPDATE mission.status = 'documents_ready'

// DELETE /api/missions/[id]/documents?documentId=uuid
Response: { data: { success: true } }
// Side effect: supprime de Storage + DB

// GET /api/missions/[id]/documents/completeness
Response: { data: CompletenessEntry[] }
// CompletenessEntry = { type, label, required, status: 'present'|'missing'|'incomplete', count }
// Calcul : compare EXPECTED_DOCUMENTS[scenario] vs documents en DB
```

### E.6 Analysis

```typescript
// POST /api/missions/[id]/analysis
Response: { data: { analysis_id: string; status: 'uploading' } }
// Orchestration complète (voir section 5.3 du doc principal) :
//   1. Génère URLs signées pour les documents dans Storage
//   2. POST vers N8N /missions/analyze
//   3. Stocke analysis_id dans la mission
//   4. UPDATE mission.status = 'analyzing'
//   5. INSERT trace (analysis_started)

// GET /api/missions/[id]/analysis/status
Response: { data: AnalysisStatus }
// AnalysisStatus = {
//   status: 'uploading' | 'analyzing' | 'importing' | 'completed' | 'failed',
//   progress?: { step, step_number, total_steps, percent, message },
//   error?: string
// }
// Si status N8N = 'completed' et pas encore importé :
//   → déclenche l'import (GET N8N /results → INSERT Supabase)
//   → retourne status = 'importing' puis 'completed' au poll suivant

// GET /api/missions/[id]/analysis/results
Response: { data: { summary: ResultsSummary; imported: boolean } }
// ResultsSummary = { ecritures_parsed, rapprochements_created, signals_generated, ... }
```

### E.7 Signals

```typescript
// GET /api/missions/[id]/signals?priority=high&decision=pending&page=1&limit=20
Response: { data: Signal[]; pagination: { total, page, limit } }

// GET /api/missions/[id]/signals/[signalId]
Response: { data: Signal }
// Signal inclut : explicability (JSONB), document source, écriture liée

// PUT /api/missions/[id]/signals/[signalId]
Request:  { decision: 'validated' | 'rejected' | 'to_investigate'; comment: string }
Response: { data: Signal }
// Side effects :
//   1. UPDATE signal (human_decision, human_comment, decided_at)
//   2. INSERT trace (signal_validated | signal_rejected | signal_to_investigate)

// GET /api/missions/[id]/signals/stats
Response: { data: SignalStats }
// SignalStats = { total, by_priority: { high, medium, low }, by_decision: { pending, validated, rejected, to_investigate } }
```

### E.8 Deliverables

```typescript
// GET /api/missions/[id]/deliverables
Response: { data: Deliverable[] }
// Deliverable = { id, type, format, title, generated_at, storage_path }

// GET /api/missions/[id]/deliverables/[delivId]
Response: File (binary stream — PDF ou XLSX)
// Content-Type: application/pdf ou application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
// Content-Disposition: attachment; filename="checklist_completude.pdf"
// Le fichier est lu depuis Supabase Storage

// POST /api/missions/[id]/deliverables/regenerate
Request:  { types?: ('checklist_completude' | 'tableau_signaux' | 'synthese_preanalyse' | 'journal_tracabilite')[] }
Response: { data: Deliverable[] }
// Side effects :
//   1. Lit les données depuis Supabase (signals, traces, completeness, profile)
//   2. Regénère les fichiers (pdfmake / exceljs)
//   3. Upload vers Supabase Storage
//   4. UPDATE deliverables en DB
//   5. INSERT trace (deliverables_regenerated)
```

### E.9 Traces

```typescript
// GET /api/missions/[id]/traces?limit=100
Response: { data: Trace[] }
// Trace = { id, timestamp, actor, actor_name, action, target_type, target_id, details }
// Triées par timestamp DESC
```

---

## F. Spécifications UI — Écran par écran

### F.0 Layout global

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER                                                       │
│  [Logo Sof'IA]     Mission: Audit XYZ      [Jean Dupont, CAC] │
├──────────┬───────────────────────────────────────────────────┤
│ SIDEBAR  │  CONTENU PRINCIPAL                                 │
│          │                                                    │
│ Missions │                                                    │
│  └ XYZ   │                                                    │
│    ├ Docs│                                                    │
│    ├ Sig.│                                                    │
│    ├ Val.│                                                    │
│    └ Livr│                                                    │
│          │                                                    │
│ + Nouv.  │                                                    │
│          │                                                    │
│ ──────── │                                                    │
│ Paramèt. │                                                    │
├──────────┴───────────────────────────────────────────────────┤
│  FOOTER                                                       │
│  Sof'IA v0.1.0 — POC HackAudit                               │
└──────────────────────────────────────────────────────────────┘
```

> Note v3 : l'indicateur de connectivité (online/offline) est supprimé — webapp = toujours en ligne.

### F.1 Écran : Activation licence (LicenseActivationPage)

**Quand** : Premier accès (pas de cookie session valide).
**Layout** : Plein écran centré, pas de sidebar ni header.

```
┌──────────────────────────────────────────┐
│                                          │
│          [Logo Sof'IA — grand]           │
│                                          │
│   Activez votre licence                  │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │  XXXX - XXXX - XXXX - XXXX      │   │
│   └──────────────────────────────────┘   │
│                                          │
│           [Activer]                      │
│                                          │
│   (message d'erreur si invalide)         │
│                                          │
└──────────────────────────────────────────┘
```

**Actions** :
- Saisie clé → clic "Activer" → `POST /api/license/validate`
- Si OK → redirect vers `/setup`
- Si KO → message d'erreur inline

### F.2 Écran : Setup profil (ProfileSetupPage)

**Quand** : Après activation, si profil absent en Supabase.
**Layout** : Plein écran centré.

```
┌──────────────────────────────────────────┐
│                                          │
│   Configurez votre profil                │
│                                          │
│   Nom complet *                          │
│   ┌──────────────────────────────────┐   │
│   │  Jean Dupont                     │   │
│   └──────────────────────────────────┘   │
│                                          │
│   Cabinet *                              │
│   ┌──────────────────────────────────┐   │
│   │  Cabinet Dupont & Associés       │   │
│   └──────────────────────────────────┘   │
│                                          │
│   N° inscription CNCC                    │
│   ┌──────────────────────────────────┐   │
│   │  CNCC-75-12345                   │   │
│   └──────────────────────────────────┘   │
│                                          │
│   Email                                  │
│   ┌──────────────────────────────────┐   │
│   │  jean.dupont@cabinet-xyz.fr      │   │
│   └──────────────────────────────────┘   │
│                                          │
│           [Continuer]                    │
│                                          │
│   Ces informations apparaîtront dans     │
│   les livrables et le journal de         │
│   traçabilité.                           │
└──────────────────────────────────────────┘
```

**Actions** :
- Remplir les champs → "Continuer" → `POST /api/profile`
- Redirect vers `/missions`

### F.3 Écran 1 : Accueil / Sélection scénario (MissionsPage)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Nouvelle mission de pré-analyse                         │
│                                                          │
│  Nom de la mission                                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Audit Société XYZ — Exercice 2025                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Sélectionnez un scénario :                              │
│                                                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────────┐ │
│  │  Sondage CA     │ │  Cut-off        │ │  Pointage  │ │
│  │                 │ │                 │ │            │ │
│  │  Pré-analyse    │ │  Pré-analyse    │ │ Cohérence  │ │
│  │  documentaire   │ │  documentaire   │ │ états      │ │
│  │  du sondage     │ │  de la césure   │ │ financiers │ │
│  │  sur le CA      │ │  d'exercice     │ │ et annexe  │ │
│  │                 │ │                 │ │            │ │
│  │  [Sélectionner] │ │  [Sélectionner] │ │[Sélection.]│ │
│  └─────────────────┘ └─────────────────┘ └────────────┘ │
│                                                          │
│  ───── Missions précédentes ─────                        │
│                                                          │
│  Audit ABC — Sondage CA — 3 signaux — En revue          │
│  Audit DEF — Cut-off — Terminé                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Actions** :
- Saisir nom + sélectionner scénario → `POST /api/missions`
- Redirect vers `/missions/[id]/documents`
- Clic sur mission existante → reprend au dernier écran

### F.4 Écran 2 : Documents & complétude (DocumentsPage)

```
┌──────────────────────────────────────────────────────────────┐
│  Audit XYZ — Sondage CA                                      │
│                                                              │
│  Documents de la mission                                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Glissez vos documents ici                            │    │
│  │     ou cliquez pour sélectionner                      │    │
│  │     Formats acceptés : .txt (FEC), .pdf               │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Document              │ Type            │ Statut     │    │
│  │────────────────────────┼─────────────────┼────────────│    │
│  │  FEC_2025.txt          │ FEC             │ Présent    │    │
│  │  FA-2025-0456.pdf      │ Facture vente   │ Présent    │    │
│  │  FA-2025-0457.pdf      │ Facture vente   │ Présent    │    │
│  │  BL-0789.pdf           │ Bon livraison   │ Présent    │    │
│  │  —                     │ Contrats clients│ Optionnel  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Complétude : ████████████████░░░░  75% (3/4 requis)        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  [Lancer la pré-analyse]                              │    │
│  │  Actif si ≥ 1 doc requis présent                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Les documents seront envoyés temporairement au serveur      │
│  pour traitement, puis supprimés.                            │
└──────────────────────────────────────────────────────────────┘
```

**Actions** :
- Drag & drop / clic → file dialog → `POST /api/missions/[id]/documents` (FormData)
- Type auto-détecté (FEC = .txt, autres = .pdf) + modifiable manuellement
- Bouton "Lancer la pré-analyse" → `POST /api/missions/[id]/analysis`
- Redirect vers `/missions/[id]/analysis`

### F.5 Écran intermédiaire : Progression (AnalysisPage)

Voir annexe A.6 pour les maquettes.

**Actions** :
- Polling `GET /api/missions/[id]/analysis/status` toutes les 4 secondes
- À réception de `status: 'completed'` → redirect vers `/missions/[id]/signals`
- À réception de `status: 'failed'` → affiche message + bouton "Relancer"

### F.6 Écran 3 : Signaux documentaires (SignalsPage)

```
┌──────────────────────────────────────────────────────────────┐
│  Audit XYZ — Signaux documentaires         12 signaux        │
│                                                              │
│  Filtres : [Tous ▾] [Toutes priorités ▾] [Tous statuts ▾]  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ HIGH   │ CUT-001 │ Facture FA-0456 datée 28/12,     │    │
│  │        │         │ BL-0789 daté 03/01. Écart de      │    │
│  │ Pending│         │ rattachement temporel.             │    │
│  │        │         │              [Voir le détail →]    │    │
│  ├────────┼─────────┼───────────────────────────────────┤    │
│  │ MED    │ SCA-003 │ Écart de 8 jours entre facture    │    │
│  │        │         │ FA-0457 et BL-0790.               │    │
│  │ Validé │         │              [Voir le détail →]    │    │
│  ├────────┼─────────┼───────────────────────────────────┤    │
│  │ LOW    │ DOC-002 │ Contrat CT-123 : page 3           │    │
│  │        │         │ partiellement illisible.           │    │
│  │ Pending│         │              [Voir le détail →]    │    │
│  └────────┴─────────┴───────────────────────────────────┘    │
│                                                              │
│  Résumé : 3 élevés  5 moyens  4 faibles                     │
│           9 en attente  2 validés  1 rejeté                  │
│                                                              │
│  Analyse automatique — à valider par le commissaire          │
│  aux comptes. Sof'IA ne se substitue pas au jugement         │
│  professionnel.                                              │
└──────────────────────────────────────────────────────────────┘
```

**Actions** :
- Fetch `GET /api/missions/[id]/signals` avec filtres (query params)
- Clic "Voir le détail" → redirect vers `/missions/[id]/signals/[signalId]`

### F.7 Écran 4 : Détail d'un signal + décision (SignalDetailPage)

```
┌──────────────────────────────────────────────────────────────┐
│  ← Retour aux signaux                                        │
│                                                              │
│  Signal CUT-001 — Rattachement temporel          Élevé       │
│                                                              │
│  Facture FA-2025-0456 datée du 28/12/2025 mais bon de       │
│  livraison BL-0789 daté du 03/01/2026. Incohérence de       │
│  rattachement temporel.                                      │
│                                                              │
│  ┌─ Explicabilité ──────────────────────────────────────┐    │
│  │                                                       │    │
│  │  La facture référence une prestation datée du         │    │
│  │  28/12/2025. Le BL associé (BL-0789) indique une     │    │
│  │  date d'expédition au 03/01/2026. L'écart de 6 jours │    │
│  │  autour de la clôture (31/12/2025) constitue un       │    │
│  │  signal de rattachement temporel.                     │    │
│  │                                                       │    │
│  │  FA-2025-0456.pdf → "Date prestation : 28/12/2025"   │    │
│  │  BL-0789.pdf → "Date expédition : 03/01/2026"        │    │
│  │                                                       │    │
│  │  Règle : CUT-001 — NEP 500, §A14                     │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ Document source ────────────────────────────────────┐    │
│  │  [Viewer PDF intégré — FA-2025-0456.pdf, page 1]     │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ Écriture FEC associée ──────────────────────────────┐    │
│  │  VE-2025-001234 │ 28/12/2025 │ 701000 │ 15 000,00€ C│    │
│  │  "Vente client ACME — lot 45B"                        │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ Décision ───────────────────────────────────────────┐    │
│  │  [Valider]  [Rejeter]  [À approfondir]                │    │
│  │                                                       │    │
│  │  Commentaire (obligatoire si rejeté) :                │    │
│  │  ┌───────────────────────────────────────────────┐    │    │
│  │  │                                               │    │    │
│  │  └───────────────────────────────────────────────┘    │    │
│  │                                                       │    │
│  │  [Enregistrer la décision]                            │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│  Analyse automatique — à valider par le CAC.                 │
└──────────────────────────────────────────────────────────────┘
```

**Note** : Les écrans 4 (détail) et 5 (validation) du parcours Notion sont fusionnés. Le CAC voit le détail et prend sa décision au même endroit.

**Actions** :
- Fetch `GET /api/missions/[id]/signals/[signalId]` pour le détail
- Viewer PDF intégré (react-pdf) — le PDF est servi depuis Supabase Storage
- Boutons décision → `PUT /api/missions/[id]/signals/[signalId]`
- Commentaire obligatoire si "Rejeter"
- Après décision → trace auto + retour à la liste

### F.8 Écran 6 : Livrables (DeliverablesPage)

```
┌──────────────────────────────────────────────────────────────┐
│  Audit XYZ — Livrables                                       │
│                                                              │
│  Les livrables intègrent vos décisions de validation.        │
│  Cliquez sur "Regénérer" pour mettre à jour après de         │
│  nouvelles décisions.                                        │
│                                                              │
│  ┌───────────────────────────────────────────────────┐       │
│  │  Check-list de complétude documentaire             │       │
│  │  Format : PDF  │  Généré le 14/02/2026 à 10:17    │       │
│  │  [Aperçu]   [Télécharger PDF]                     │       │
│  └───────────────────────────────────────────────────┘       │
│                                                              │
│  ┌───────────────────────────────────────────────────┐       │
│  │  Tableau des signaux documentaires                 │       │
│  │  Format : XLSX │  Généré le 14/02/2026 à 10:17    │       │
│  │  9/12 signaux décidés                              │       │
│  │  [Aperçu]   [Télécharger XLSX]                    │       │
│  └───────────────────────────────────────────────────┘       │
│                                                              │
│  ┌───────────────────────────────────────────────────┐       │
│  │  Synthèse de pré-analyse (NEP 230)                 │       │
│  │  Format : PDF  │  Généré le 14/02/2026 à 10:17    │       │
│  │  [Aperçu]   [Télécharger PDF]                     │       │
│  └───────────────────────────────────────────────────┘       │
│                                                              │
│  ┌───────────────────────────────────────────────────┐       │
│  │  Journal de traçabilité                            │       │
│  │  Format : PDF  │  Généré le 14/02/2026 à 10:17    │       │
│  │  23 actions tracées                                │       │
│  │  [Aperçu]   [Télécharger PDF]                     │       │
│  └───────────────────────────────────────────────────┘       │
│                                                              │
│  [Regénérer tous les livrables]                              │
│                                                              │
│  Ces documents sont des outils de pré-analyse. Ils ne        │
│  constituent pas une conclusion d'audit.                     │
└──────────────────────────────────────────────────────────────┘
```

**Actions** :
- Fetch `GET /api/missions/[id]/deliverables` au chargement
- "Aperçu" → ouvre le PDF/XLSX dans un nouvel onglet (URL signée Supabase Storage)
- "Télécharger" → `GET /api/missions/[id]/deliverables/[delivId]` → download navigateur
- "Regénérer" → `POST /api/missions/[id]/deliverables/regenerate`

---

## G. Spécifications des jeux de données fictifs

### G.1 Principe

Chaque scénario dispose d'un jeu de données fictif pré-construit. Ces jeux de données doivent être **réalistes et cohérents** pour que le jury comprenne la valeur de Sof'IA.

Les données fictives concernent une société fictive : **ACME Distribution SAS** — exercice clos au 31/12/2025.

### G.2 Jeu de données — Sondage CA (`data/sondage_ca/`)

**FEC (FEC_demo.txt)** : ~50 écritures du journal de ventes (VE) entre le 01/10/2025 et le 31/01/2026.

Colonnes standard FEC DGFiP, séparées par tabulation :
```
JournalCode	JournalLib	EcritureNum	EcritureDate	CompteNum	CompteLib	CompAuxNum	CompAuxLib	PieceRef	PieceDate	EcritureLib	Debit	Credit	EcrtureLet	DateLet	ValidDate
VE	Ventes	VE-2025-001	20251015	701000	Ventes produits finis	CLI001	Client Alpha	FA-2025-001	20251015	Vente Alpha lot 12	0	12500.00		 	20251031
```

**8 factures de vente** (PDF) : FA-2025-001 à FA-2025-008
- Chaque facture contient : n°, date, client, description, montant HT, TVA, TTC
- Montants cohérents avec le FEC

**6 bons de livraison** (PDF) : BL-2025-001 à BL-2025-006
- Volontairement 6 BL pour 8 factures → 2 signaux absence_piece
- Un BL avec une date postérieure à la clôture (signal rattachement)

**Signaux attendus** (ce que l'analyse doit détecter) :
- FA-2025-005 sans BL → SCA-001
- FA-2025-008 sans BL → SCA-001
- FA-2025-003 (28/12) avec BL-2025-003 (03/01) → SCA-005 (rattachement)
- Écart montant FA-2025-006 vs BL-2025-005 (12 500€ vs 12 750€) → SCA-002

### G.3 Jeu de données — Cut-off (`data/cutoff/`)

**FEC** : ~30 écritures de ventes et achats autour de la clôture (20/12/2025 — 15/01/2026).

**5 factures de vente + 3 factures fournisseurs** (PDF)
**5 bons de livraison/réception** (PDF)

**Signaux attendus** :
- Facture vente datée 29/12, BL daté 05/01 → CUT-001
- Facture achat datée 02/01, réception le 28/12 → CUT-002
- Facture sans justificatif de date de livraison → CUT-004
- Avoir du 10/01 annulant une vente du 22/12 → CUT-005

### G.4 Jeu de données — Pointage (`data/pointage/`)

**Bilan** (PDF) : Bilan simplifié avec actif et passif (~15 postes).
**Compte de résultat** (PDF) : CR simplifié (~10 postes).
**Annexe** (PDF) : Annexe simplifiée avec notes explicatives.

**Signaux attendus** :
- Poste "Immobilisations corporelles" bilan = 1 250 000€, annexe note 3 = 1 235 000€ → PTG-001
- Engagements hors bilan non mentionnés dans l'annexe → PTG-002
- Variation de +45% du poste "Autres charges" sans note explicative → PTG-005

### G.5 Bonnes pratiques pour les données fictives

- Utiliser des noms de sociétés clairement fictifs (ACME, Widgets Corp)
- Montants réalistes mais pas de vrais chiffres
- Au moins 3-4 signaux par scénario pour que l'écran soit démonstratif
- Un mix de priorités (high, medium, low) pour montrer le tri
- Les PDFs peuvent être générés avec pdfmake ou un outil similaire

---

## H. Templates des livrables

### H.1 Check-list de complétude documentaire (PDF)

```
═══════════════════════════════════════════════════
  CHECK-LIST DE COMPLÉTUDE DOCUMENTAIRE
  Mission : {mission_name}
  Scénario : {scenario_label}
  Générée le : {date} par Sof'IA
  Commissaire aux comptes : {cac_name} ({inscription_cncc})
  Cabinet : {cabinet}
═══════════════════════════════════════════════════

  Document attendu              │ Statut       │ Détail
  ─────────────────────────────┼──────────────┼──────────
  FEC                          │ Présent      │ 1 fichier, 1247 écritures
  Factures de vente            │ Présent      │ 8 factures
  Bons de livraison            │ Incomplet    │ 6 BL / 8 attendus
  Contrats clients             │ Absent       │ Non fourni (optionnel)

  Taux de complétude : 75% (documents requis)

  ─────────────────────────────────────────────
  Ce document est un outil de pré-analyse documentaire.
  Il ne constitue pas une conclusion d'audit.
  Validation humaine requise.
═══════════════════════════════════════════════════
```

### H.2 Tableau des signaux documentaires (XLSX)

**Feuille 1 : Signaux**

| # | Type | Description | Document source | Page | Règle | Priorité | Décision CAC | Commentaire CAC | Date décision |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Rattachement temporel | FA-0456 datée 28/12, BL-0789 daté 03/01 | FA-2025-0456.pdf | 1 | CUT-001 | Élevé | Validé | Incohérence confirmée | 14/02/2026 |
| 2 | Absence pièce | FA-0005 sans BL associé | FA-2025-005.pdf | — | SCA-001 | Élevé | En attente | — | — |

**Feuille 2 : Résumé**
- Nombre total de signaux
- Répartition par priorité
- Répartition par décision
- Date de génération
- Identité du CAC

**En-tête de chaque feuille** :
```
Sof'IA — Tableau des signaux documentaires
Mission : {mission_name} | CAC : {cac_name} | Date : {date}
Analyse automatique — à valider par le commissaire aux comptes
```

### H.3 Synthèse de pré-analyse (PDF)

```
═══════════════════════════════════════════════════
  SYNTHÈSE DE PRÉ-ANALYSE DOCUMENTAIRE
  Intégrable au dossier de travail — NEP 230
═══════════════════════════════════════════════════

  Mission : {mission_name}
  Scénario : {scenario_label}
  Date de pré-analyse : {date}
  Commissaire aux comptes : {cac_name} ({inscription_cncc})
  Cabinet : {cabinet}

  1. PÉRIMÈTRE DE LA PRÉ-ANALYSE
  La présente pré-analyse porte sur {nb_documents} documents
  relatifs à {scenario_description}.
  Documents analysés : {liste des documents avec types}.

  2. PRINCIPAUX CONSTATS DOCUMENTAIRES
  La pré-analyse a identifié {nb_signals} signaux documentaires :
  - {nb_high} signaux de priorité élevée
  - {nb_medium} signaux de priorité moyenne
  - {nb_low} signaux de priorité faible

  Principaux constats :
  - {description du signal 1 le plus critique}
  - {description du signal 2}
  - {description du signal 3}

  3. DÉCISIONS DU COMMISSAIRE AUX COMPTES
  Sur les {nb_signals} signaux identifiés :
  - {nb_validated} validés
  - {nb_rejected} rejetés
  - {nb_to_investigate} à approfondir
  - {nb_pending} en attente de décision

  4. LIMITES DE L'ANALYSE
  La présente pré-analyse est réalisée par un outil
  d'intelligence artificielle (Sof'IA). Elle porte
  exclusivement sur des constats documentaires factuels.
  Elle ne constitue en aucun cas :
  - une conclusion d'audit,
  - une qualification d'anomalie significative,
  - une recommandation d'opinion.

  L'ensemble des signaux a été soumis à la validation
  du commissaire aux comptes, qui reste seul décisionnaire.

  5. VALIDATION
  Pré-analyse validée par : {cac_name}
  Date : {date_validation}
  Signature : ___________________________

═══════════════════════════════════════════════════
```

### H.4 Journal de traçabilité (PDF)

```
═══════════════════════════════════════════════════
  JOURNAL DE TRAÇABILITÉ
  Mission : {mission_name}
═══════════════════════════════════════════════════

  Date/Heure          │ Acteur        │ Action                │ Détail
  ────────────────────┼───────────────┼───────────────────────┼──────────
  14/02/2026 10:00    │ Jean Dupont   │ Mission créée         │ Scénario : Sondage CA
  14/02/2026 10:05    │ Jean Dupont   │ Documents ajoutés     │ 14 documents
  14/02/2026 10:15    │ Sof'IA        │ Analyse démarrée      │ Pré-analyse sur 14 docs
  14/02/2026 10:15    │ Sof'IA        │ FEC parsé             │ 1247 écritures extraites
  14/02/2026 10:16    │ Sof'IA        │ Rapprochement terminé │ 1180 rapprochés, 67 sans pièce
  14/02/2026 10:17    │ Sof'IA        │ Signaux générés       │ 12 signaux détectés
  14/02/2026 10:17    │ Sof'IA        │ Livrables générés     │ 4 livrables
  14/02/2026 14:30    │ Jean Dupont   │ Signal validé         │ SIG-001 (CUT-001)
  14/02/2026 14:32    │ Jean Dupont   │ Signal rejeté         │ SIG-007 — "Faux positif"
  14/02/2026 14:35    │ Jean Dupont   │ Signal à approfondir  │ SIG-003 — "Vérifier montant"
  14/02/2026 15:00    │ Jean Dupont   │ Livrables regénérés   │ Intégration des décisions
  14/02/2026 15:05    │ Jean Dupont   │ Livrables exportés    │ 4 fichiers exportés

  ─────────────────────────────────────────────
  Total : {nb_traces} actions tracées
  Dont : {nb_sofia} actions Sof'IA, {nb_user} actions CAC

  Ce journal est généré automatiquement et ne peut
  être modifié. Il constitue la trace des diligences
  réalisées dans le cadre de cette pré-analyse.
═══════════════════════════════════════════════════
```

---

## I. Référence rapide pour l'implémentation

### I.1 Ordre de développement recommandé

```
1.  Scaffold Next.js + Tailwind + TypeScript
2.  Setup Supabase (migrations/001_initial.sql + seed.sql)
3.  Supabase clients (server + browser) + types
4.  Middleware auth (cookie session + vérification licence)
5.  License flow (activation page + API route + cookie)
6.  Profile flow (setup page + API route + Supabase)
7.  Mission CRUD (create, list, select + API routes)
8.  Document management (drag & drop, upload Storage, complétude)
9.  N8N API client (lib/n8n/client.ts + header licence)
10. Analysis flow API route (URLs signées → N8N → poll → import)
11. Analysis progress UI (polling + barre de progression)
12. Results importer (payload N8N → Supabase tables + Storage)
13. Signals UI (list, filters, detail + décision)
14. Deliverables UI (affichage, téléchargement, regénération)
15. Deliverable generator (pdfmake + exceljs côté serveur)
16. Trace timeline
17. Jeux de données fictifs (data/)
18. Polish UI + tests
19. Déploiement Vercel + config env
```

### I.2 Fichiers critiques à implémenter en premier

```
middleware.ts                           ← Auth middleware
app/api/license/validate/route.ts       ← Point d'entrée de l'app
app/api/profile/route.ts                ← Profil CAC
app/api/missions/route.ts               ← CRUD missions
app/api/missions/[id]/documents/route.ts     ← Upload documents
app/api/missions/[id]/analysis/route.ts      ← Orchestration analyse
app/api/missions/[id]/signals/route.ts       ← Signaux
app/api/missions/[id]/deliverables/route.ts  ← Livrables
lib/supabase/client.ts                  ← Client Supabase (server)
lib/n8n/client.ts                       ← Client N8N
lib/auth/session.ts                     ← Gestion cookie session
lib/services/results-importer.ts        ← Import payload N8N
lib/config/expected-documents.ts        ← Mapping docs par scénario
lib/config/signal-rules.ts              ← Catalogue règles
supabase/migrations/001_initial.sql     ← Schéma complet
```

### I.3 Variables d'environnement (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# N8N
N8N_BASE_URL=https://n8n.agence-b.fr/webhook/sofia
N8N_TIMEOUT_MS=30000

# Session
SESSION_SECRET=une-clé-secrète-de-32-caractères-minimum

# App
NEXT_PUBLIC_APP_VERSION=0.1.0
POLL_INTERVAL_MS=4000
RESULTS_TTL_HOURS=48
```

### I.4 Dépendances NPM principales

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "react-dom": "^18",
    "@supabase/supabase-js": "^2",
    "zustand": "^4",
    "swr": "^2",
    "iron-session": "^8",
    "react-dropzone": "^14",
    "react-pdf": "^7",
    "pdfmake": "^0.2",
    "exceljs": "^4",
    "lucide-react": "^0.300",
    "tailwindcss": "^3",
    "typescript": "^5"
  }
}
```
