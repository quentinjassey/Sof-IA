# SOF'IA — Architecture POC HackAudit

> Version 3.0 — 14 février 2026
> Stack : Next.js (Vercel) + Supabase + N8N (https://n8n.agence-b.fr/)
> Modèle : webapp avec licence, N8N en service IA à la demande
>
> **Ce document + ses annexes forment la spécification complète du POC.**
> - Architecture principale : ce fichier
> - Annexes techniques : `ARCHITECTURE_POC_SOFIA_ANNEXES.md`
> - Contexte métier : `CONTEXTE_PROJET_SOFIA.md`

---

## 1. Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│                  NAVIGATEUR (Client React)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Next.js Frontend (App Router)                         │  │
│  │  - React UI (pages + components)                       │  │
│  │  - Zustand (state management)                          │  │
│  │  - Tailwind CSS                                        │  │
│  └─────────────────────────┬──────────────────────────────┘  │
└────────────────────────────┼─────────────────────────────────┘
                             │ fetch / SWR
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              VERCEL (Next.js App Router — API Routes)          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  /api/license │  │  /api/mission│  │  /api/analysis     │ │
│  │  /api/profile │  │  /api/docs   │  │  /api/signals      │ │
│  │               │  │              │  │  /api/deliverables  │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘ │
│         │                 │                    │             │
│  ┌──────┴─────────────────┴────────────────────┴───────────┐ │
│  │              Clients serveur                              │ │
│  │  - Supabase Client (DB + Storage)                        │ │
│  │  - N8N API Client (HTTPS)                                │ │
│  │  - Cookie session (licence)                              │ │
│  └──────────┬─────────────────────────┬────────────────────┘ │
└─────────────┼─────────────────────────┼──────────────────────┘
              │                         │
              ▼                         ▼
┌─────────────────────────┐  ┌──────────────────────────────────┐
│       SUPABASE           │  │    N8N (https://n8n.agence-b.fr/) │
│                          │  │    Service IA à la demande        │
│  ┌────────────────────┐ │  │                                    │
│  │  PostgreSQL         │ │  │  ┌──────────────┐  ┌───────────┐ │
│  │  (toutes les données│ │  │  │  Webhooks    │  │  LLM      │ │
│  │   missions, signaux,│ │  │  │  (API REST)  │  │  Provider │ │
│  │   traces, etc.)     │ │  │  └──────┬───────┘  │(agnostique│ │
│  └────────────────────┘ │  │         │           └───────────┘ │
│  ┌────────────────────┐ │  │  ┌──────┴──────────────────────┐  │
│  │  Storage (buckets)  │ │  │  │  Workflows                   │  │
│  │  - documents/       │ │  │  │  - Parsing FEC               │  │
│  │  - deliverables/    │ │  │  │  - Extraction PDF            │  │
│  └────────────────────┘ │  │  │  - Analyse LLM               │  │
│  ┌────────────────────┐ │  │  │  - Génération livrables      │  │
│  │  Row Level Security │ │  │  └─────────────────────────────┘  │
│  │  (isolation licence)│ │  │                                    │
│  └────────────────────┘ │  │  Stockage temporaire uniquement.   │
└─────────────────────────┘  │  Rien ne persiste après récupération│
                             └──────────────────────────────────┘
```

### Principes fondamentaux

- **Next.js + Supabase** = le produit. Toutes les données vivent dans Supabase : missions, signaux, décisions, traces, documents, livrables.
- **N8N** = un service appelé à la demande. Reçoit des URLs de documents → traitement IA → résultats retournés → stockés dans Supabase. Terminé.
- **Pas de mode offline.** C'est une webapp — la connexion est toujours requise. Simplification majeure par rapport à l'architecture Electron.
- **Pas de sync.** Flux descendant uniquement : N8N produit, Next.js consomme et stocke dans Supabase.
- **Pas de login/password.** Activation par clé de licence + profil CAC stocké dans Supabase.

---

## 2. Licence & Profil utilisateur

### 2.1 Activation par clé de licence

Au premier accès, l'utilisateur saisit une clé de licence.

**Flux d'activation :**
```
Premier accès à l'app
       │
       ▼
┌─────────────────────────┐
│  Écran d'activation     │
│  "Entrez votre clé"     │
│  [XXXX-XXXX-XXXX-XXXX]  │
└────────────┬────────────┘
             │
             ▼
   POST /api/license/validate
             │
             ▼
   Supabase: SELECT FROM licenses
   WHERE key = ? AND status = 'active'
             │
         Valide ?
          │    │
         Oui  Non
          │    │
          ▼    ▼
  Set cookie   Erreur :
  httpOnly     "Clé invalide"
  (chiffré)
          │
          ▼
  Écran setup profil CAC
```

**Table `licenses` dans Supabase :**
```sql
-- Pré-remplie par l'administrateur avec les clés valides
-- Pour le POC : 1 à 3 clés de test
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT UNIQUE NOT NULL,
    activated_at TIMESTAMPTZ,
    valid_until TIMESTAMPTZ NOT NULL,
    features JSONB NOT NULL DEFAULT '["sondage_ca", "cutoff", "pointage"]',
    max_missions INTEGER NOT NULL DEFAULT -1,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Session cookie (httpOnly, chiffré) :**
```json
{
  "license_key": "XXXX-XXXX-XXXX-XXXX",
  "license_id": "uuid",
  "activated_at": "2026-02-14T10:00:00Z"
}
```

Le cookie est vérifié par un middleware Next.js sur chaque requête API. Si absent ou invalide → redirection vers l'écran d'activation.

### 2.2 Profil CAC

Après l'activation de la licence, un écran de configuration demande les infos professionnelles du CAC. Ces informations alimentent la traçabilité (journal, livrables, mentions dans les exports).

```json
{
  "id": "uuid (généré par Supabase)",
  "license_id": "uuid",
  "name": "Jean Dupont",
  "cabinet": "Cabinet Dupont & Associés",
  "inscription_cncc": "CNCC-75-12345",
  "email": "jean.dupont@cabinet-xyz.fr",
  "created_at": "2026-02-14T10:05:00Z"
}
```

Stocké dans Supabase (`profiles` table), lié à la licence. Modifiable dans les paramètres.

### 2.3 Flux au chargement de l'app

```
Accès à l'URL Sof'IA
       │
       ▼
  Cookie de session présent ?
   │           │
  Oui         Non
   │           │
   ▼           ▼
  Cookie     Écran activation
  valide ?
  (check Supabase)
   │     │
  Oui   Non
   │     │
   ▼     ▼
  Profil  Écran activation
  existe ?
  (check Supabase)
   │     │
  Oui   Non
   │     │
   ▼     ▼
 Accueil  Setup profil
```

Pas de login. Pas de mot de passe. Le cookie de licence suffit.

---

## 3. Modèles de données

> Tous les modèles vivent dans Supabase (PostgreSQL).
> Le schéma SQL complet est en Annexe B.

### 3.1 License

| Champ | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| license_key | TEXT (UNIQUE) | Clé XXXX-XXXX-XXXX-XXXX |
| activated_at | TIMESTAMPTZ | Date de première activation |
| valid_until | TIMESTAMPTZ | Date d'expiration |
| features | JSONB | Scénarios autorisés |
| max_missions | INTEGER | -1 = illimité |
| status | TEXT | active / expired / revoked |

### 3.2 Profile

| Champ | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| license_id | UUID (FK) | Lien vers la licence |
| name | TEXT | Nom complet du CAC |
| cabinet | TEXT | Nom du cabinet |
| inscription_cncc | TEXT | N° CNCC |
| email | TEXT | Email professionnel |

### 3.3 Mission

| Champ | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| license_id | UUID (FK) | Lien vers la licence |
| name | TEXT | "Audit Société XYZ — Exercice 2025" |
| scenario | TEXT | sondage_ca / cutoff / pointage |
| status | TEXT | created / documents_ready / uploading / upload_failed / analyzing / analysis_failed / analyzed / in_review / completed |
| analysis_id | UUID | ID de l'analyse N8N en cours/terminée |
| created_at | TIMESTAMPTZ | Date de création |
| updated_at | TIMESTAMPTZ | Dernière modification |

> La liste `expected_documents` est déterminée côté Next.js selon le scénario (config statique). Pas besoin de N8N pour créer une mission.

### 3.4 Document

| Champ | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| mission_id | UUID (FK) | Lien vers la mission |
| type | TEXT | fec / facture_vente / facture_achat / bon_livraison / contrat / annexe / bilan / compte_resultat / autre |
| filename | TEXT | Nom du fichier original |
| storage_path | TEXT | Chemin dans Supabase Storage |
| file_size | INTEGER | Taille en bytes |
| content_hash | TEXT | SHA-256 |
| status | TEXT | present / missing / incomplete |
| added_at | TIMESTAMPTZ | Date d'ajout |

### 3.5 Écriture comptable (parsée du FEC)

| Champ | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| mission_id | UUID (FK) | Lien vers la mission |
| document_id | UUID (FK) | Lien vers le FEC source |
| journal_code | TEXT | Code journal (VE, HA, etc.) |
| journal_lib | TEXT | Libellé journal |
| ecriture_num | TEXT | Numéro d'écriture |
| ecriture_date | DATE | Date de l'écriture |
| compte_num | TEXT | Numéro de compte |
| compte_lib | TEXT | Libellé du compte |
| comp_aux_num | TEXT | N° compte auxiliaire |
| comp_aux_lib | TEXT | Libellé compte auxiliaire |
| piece_ref | TEXT | Référence pièce |
| piece_date | DATE | Date pièce |
| ecriture_lib | TEXT | Libellé écriture |
| debit | NUMERIC(15,2) | Montant débit |
| credit | NUMERIC(15,2) | Montant crédit |
| lettrage | TEXT | Code lettrage |
| date_lettrage | DATE | Date lettrage |
| valid_date | DATE | Date de validation |

### 3.6 Rapprochement (écriture ↔ pièce justificative)

| Champ | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| mission_id | UUID (FK) | Lien vers la mission |
| ecriture_id | UUID (FK) | Lien vers l'écriture |
| document_id | UUID (FK) | Pièce justificative (nullable si missing) |
| match_type | TEXT | exact / partial / missing |
| match_details | JSONB | { montant_match, date_match, reference_match, details } |
| confidence | TEXT | high / medium / low |
| created_by | TEXT | sofia (toujours) |

### 3.7 Signal documentaire

| Champ | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| mission_id | UUID (FK) | Lien vers la mission |
| document_id | UUID (FK) | Document source (nullable) |
| ecriture_id | UUID (FK) | Écriture liée (nullable) |
| rapprochement_id | UUID (FK) | Rapprochement lié (nullable) |
| type | TEXT | absence_piece / incoherence_date / incoherence_montant / rupture_chaine / rattachement_temporel / incompletude |
| description | TEXT | Description humaine du signal |
| source_document | TEXT | Nom du fichier source |
| source_page | INTEGER | Page dans le document |
| source_extract | TEXT | Extrait du document |
| rule_triggered | TEXT | ID de la règle (CUT-001, etc.) |
| rule_description | TEXT | Description de la règle |
| priority | TEXT | low / medium / high |
| explicability | JSONB | { reasoning, documents_compared, rule_source } |
| human_decision | TEXT | pending / validated / rejected / to_investigate |
| human_comment | TEXT | Commentaire du CAC |
| decided_at | TIMESTAMPTZ | Date de la décision |

### 3.8 Livrable

| Champ | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| mission_id | UUID (FK) | Lien vers la mission |
| type | TEXT | checklist_completude / tableau_signaux / synthese_preanalyse / journal_tracabilite |
| format | TEXT | pdf / xlsx |
| title | TEXT | Titre du livrable |
| generated_at | TIMESTAMPTZ | Date de génération |
| content_json | JSONB | Données structurées pour regénération |
| storage_path | TEXT | Chemin dans Supabase Storage |

### 3.9 Journal de traçabilité (Trace)

| Champ | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| mission_id | UUID (FK) | Lien vers la mission |
| timestamp | TIMESTAMPTZ | Date/heure de l'action |
| actor | TEXT | sofia / user |
| actor_name | TEXT | "Sof'IA" / "Jean Dupont, CAC (CNCC-75-12345)" |
| action | TEXT | mission_created / document_added / analysis_started / analysis_completed / fec_parsed / signals_generated / signal_validated / signal_rejected / signal_to_investigate / deliverables_generated / deliverables_regenerated / etc. |
| target_type | TEXT | mission / document / signal / deliverable |
| target_id | UUID | ID de l'élément concerné |
| details | TEXT | Description textuelle |

### 3.10 Complétude documentaire

| Champ | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| mission_id | UUID (FK) | Lien vers la mission |
| doc_type | TEXT | Type de document (fec, facture_vente, etc.) |
| label | TEXT | Libellé affiché |
| required | BOOLEAN | Document requis pour le scénario |
| status | TEXT | present / missing / incomplete |
| count | INTEGER | Nombre de documents de ce type reçus |
| note | TEXT | Remarque (ex: "8 attendus, 5 fournis") |

> Remplie lors de l'import des résultats N8N. Utilisée pour la check-list de complétude et l'écran documents.

---

## 4. API — Webhooks N8N

Base URL : `https://n8n.agence-b.fr/webhook/sofia`

> **Authentification de chaque requête :** header `X-License-Key: XXXX-XXXX-XXXX-XXXX`
> Appelé uniquement depuis les API routes Next.js (côté serveur), jamais depuis le navigateur.

---

### 4.1 Upload de documents

#### `POST /missions/documents/upload` — Envoyer les documents pour analyse

**Request** (JSON — les fichiers sont accessibles via URLs signées Supabase) :
```json
{
  "mission_id": "uuid",
  "scenario": "sondage_ca",
  "documents": [
    {
      "id": "uuid",
      "type": "fec",
      "filename": "FEC_2025.txt",
      "download_url": "https://xxx.supabase.co/storage/v1/object/sign/documents/..."
    },
    {
      "id": "uuid",
      "type": "facture_vente",
      "filename": "FA-2025-0456.pdf",
      "download_url": "https://xxx.supabase.co/storage/v1/object/sign/documents/..."
    }
  ]
}
```

> Les documents sont déjà dans Supabase Storage. N8N les télécharge via les URLs signées (valides 1 heure).
> Plus besoin d'upload multipart — plus léger et plus fiable.

**Response 200 :**
```json
{
  "mission_id": "uuid",
  "documents_received": 4,
  "ready_for_analysis": true
}
```

---

### 4.2 Pré-analyse

#### `POST /missions/analyze` — Lancer la pré-analyse IA

**Request :**
```json
{
  "mission_id": "uuid",
  "scenario": "sondage_ca",
  "documents": [
    { "id": "uuid", "type": "fec", "filename": "FEC_2025.txt", "download_url": "..." },
    { "id": "uuid", "type": "facture_vente", "filename": "FA-2025-0456.pdf", "download_url": "..." }
  ],
  "options": {
    "cutoff_window_days": 10,
    "priority_threshold": "low"
  }
}
```

**Response 202 (Accepted) :**
```json
{
  "analysis_id": "uuid",
  "mission_id": "uuid",
  "status": "processing",
  "estimated_duration_seconds": 120
}
```

#### `GET /missions/analyze/{analysis_id}/status` — Suivi d'avancement

**Response 200 (en cours) :**
```json
{
  "analysis_id": "uuid",
  "status": "processing",
  "progress": {
    "step": "rapprochement",
    "step_number": 3,
    "total_steps": 6,
    "percent": 50,
    "message": "Rapprochement des écritures avec les pièces justificatives..."
  }
}
```

**Response 200 (terminé) :**
```json
{
  "analysis_id": "uuid",
  "status": "completed",
  "progress": { "percent": 100 },
  "results_summary": {
    "ecritures_parsed": 1247,
    "rapprochements_created": 1180,
    "rapprochements_missing": 67,
    "signals_generated": 12,
    "signals_by_priority": { "high": 3, "medium": 5, "low": 4 },
    "deliverables_generated": 4
  }
}
```

---

### 4.3 Récupération des résultats

#### `GET /missions/analyze/{analysis_id}/results` — Télécharger tous les résultats

> C'est le **point clé de l'architecture** : cette unique requête ramène TOUT.
> L'API route Next.js reçoit ce payload, le décompose et le stocke dans Supabase.
> Après ça, N8N n'est plus nécessaire pour cette mission.

**Response 200 :**
```json
{
  "analysis_id": "uuid",
  "mission_id": "uuid",
  "completed_at": "2026-02-14T10:17:30Z",

  "completeness": [
    { "type": "fec", "label": "FEC", "required": true, "status": "present", "count": 1 },
    { "type": "facture_vente", "label": "Factures de vente", "required": true, "status": "present", "count": 8 },
    { "type": "bon_livraison", "label": "Bons de livraison", "required": true, "status": "incomplete", "count": 5, "note": "8 écritures sondées, 5 BL fournis" },
    { "type": "contrat", "label": "Contrats clients", "required": false, "status": "missing", "count": 0 }
  ],

  "ecritures": [
    {
      "id": "uuid",
      "journal_code": "VE",
      "ecriture_num": "VE-2025-001234",
      "ecriture_date": "2025-12-28",
      "compte_num": "701000",
      "compte_lib": "Ventes de produits finis",
      "piece_ref": "FA-2025-0456",
      "ecriture_lib": "Vente client ACME — lot 45B",
      "debit": 0,
      "credit": 15000.00
    }
  ],

  "rapprochements": [
    {
      "id": "uuid",
      "ecriture_id": "uuid",
      "document_id": "uuid",
      "match_type": "exact",
      "match_details": { "montant_match": true, "date_match": true, "reference_match": false },
      "confidence": "high"
    }
  ],

  "signals": [
    {
      "id": "uuid",
      "document_id": "uuid",
      "ecriture_id": "uuid",
      "rapprochement_id": "uuid",
      "type": "rattachement_temporel",
      "description": "Facture FA-2025-0456 datée du 28/12/2025, BL-0789 daté du 03/01/2026. Signal de rattachement temporel.",
      "source_document": "FA-2025-0456.pdf",
      "source_page": 1,
      "source_extract": "Date de livraison effective : 03/01/2026",
      "rule_triggered": "CUT-001",
      "rule_description": "Facture datée avant clôture, livraison après clôture",
      "priority": "high",
      "explicability": {
        "reasoning": "La facture référence une prestation datée du 28/12/2025. Le BL associé (BL-0789) indique une date d'expédition au 03/01/2026. L'écart de 6 jours autour de la clôture constitue un signal de rattachement temporel.",
        "documents_compared": [
          { "document": "FA-2025-0456.pdf", "element": "Date prestation : 28/12/2025" },
          { "document": "BL-0789.pdf", "element": "Date expédition : 03/01/2026" }
        ],
        "rule_source": "Procédure de cut-off — NEP 500, §A14"
      }
    }
  ],

  "deliverables": [
    {
      "id": "uuid",
      "type": "checklist_completude",
      "title": "Check-list de complétude documentaire",
      "format": "pdf",
      "content_json": { "...données structurées..." },
      "file_base64": "JVBERi0xLjQK..."
    },
    {
      "id": "uuid",
      "type": "tableau_signaux",
      "title": "Tableau des signaux documentaires",
      "format": "xlsx",
      "content_json": { "...données structurées..." },
      "file_base64": "UEsDBBQAAAA..."
    },
    {
      "id": "uuid",
      "type": "synthese_preanalyse",
      "title": "Synthèse de pré-analyse — Intégrable dossier NEP 230",
      "format": "pdf",
      "content_json": { "...données structurées..." },
      "file_base64": "JVBERi0xLjQK..."
    },
    {
      "id": "uuid",
      "type": "journal_tracabilite",
      "title": "Journal de traçabilité des actions",
      "format": "pdf",
      "content_json": { "...données structurées..." },
      "file_base64": "JVBERi0xLjQK..."
    }
  ],

  "traces": [
    { "timestamp": "2026-02-14T10:15:00Z", "actor": "sofia", "action": "analysis_started", "details": "Pré-analyse lancée sur 4 documents" },
    { "timestamp": "2026-02-14T10:15:05Z", "actor": "sofia", "action": "fec_parsed", "details": "1247 écritures extraites du FEC" },
    { "timestamp": "2026-02-14T10:16:00Z", "actor": "sofia", "action": "rapprochement_completed", "details": "1180 rapprochements réalisés, 67 écritures sans pièce" },
    { "timestamp": "2026-02-14T10:17:00Z", "actor": "sofia", "action": "signals_generated", "details": "12 signaux documentaires détectés" },
    { "timestamp": "2026-02-14T10:17:30Z", "actor": "sofia", "action": "deliverables_generated", "details": "4 livrables générés" }
  ]
}
```

> **Ce payload unique est le cœur de l'architecture.**
> L'API route Next.js le reçoit, le décompose, le stocke dans Supabase (DB + Storage).
> À partir de ce moment, N8N n'est plus nécessaire pour cette mission.

---

## 5. API Routes Next.js

> Les API routes remplacent les channels IPC d'Electron.
> Elles vivent dans `app/api/` et communiquent avec Supabase et N8N.
> Toutes les routes (sauf `/api/license/validate`) vérifient le cookie de session.

### 5.1 Vue d'ensemble

| Route | Méthode | Description |
|---|---|---|
| `/api/license/validate` | POST | Valider une clé de licence |
| `/api/license/status` | GET | Vérifier la session en cours |
| `/api/profile` | GET / POST / PUT | CRUD profil CAC |
| `/api/missions` | GET / POST | Lister / créer des missions |
| `/api/missions/[id]` | GET / PUT / DELETE | Détail / modifier / supprimer une mission |
| `/api/missions/[id]/documents` | GET / POST / DELETE | Gestion des documents |
| `/api/missions/[id]/documents/completeness` | GET | Calcul de complétude |
| `/api/missions/[id]/analysis` | POST | Lancer la pré-analyse (→ N8N) |
| `/api/missions/[id]/analysis/status` | GET | Statut de l'analyse en cours |
| `/api/missions/[id]/analysis/results` | GET | Résultats importés dans Supabase |
| `/api/missions/[id]/signals` | GET | Liste des signaux (avec filtres) |
| `/api/missions/[id]/signals/[signalId]` | GET / PUT | Détail / décision sur un signal |
| `/api/missions/[id]/signals/stats` | GET | Statistiques des signaux |
| `/api/missions/[id]/deliverables` | GET | Liste des livrables |
| `/api/missions/[id]/deliverables/[delivId]` | GET | Télécharger un livrable |
| `/api/missions/[id]/deliverables/regenerate` | POST | Regénérer les livrables |
| `/api/missions/[id]/traces` | GET | Journal de traçabilité |

> Les contrats détaillés de chaque API route sont en Annexe E.

### 5.2 Middleware d'authentification

```typescript
// middleware.ts (Next.js root)
// Vérifie le cookie de session sur toutes les routes /api/* (sauf /api/license/validate)
// Si cookie absent ou licence expirée → 401 Unauthorized
// Injecte license_id dans les headers pour les API routes
```

### 5.3 Flux d'analyse (orchestration côté API route)

L'API route `POST /api/missions/[id]/analysis` orchestre tout le processus :

```
1. Vérifier que la mission a des documents requis
2. Générer des URLs signées Supabase Storage (validité: 1h)
3. POST vers N8N /missions/analyze avec les URLs signées
4. Stocker l'analysis_id dans la mission (Supabase)
5. Mettre à jour le statut mission → "analyzing"
6. Retourner 202 Accepted au client

Le client poll ensuite GET /api/missions/[id]/analysis/status :
1. L'API route relaye vers N8N GET /missions/analyze/{id}/status
2. Quand status = "completed" :
   a. GET vers N8N /missions/analyze/{id}/results
   b. Importe le payload complet dans Supabase :
      - ecritures → table ecritures
      - rapprochements → table rapprochements
      - signals → table signals (human_decision = 'pending')
      - deliverables → fichiers dans Storage + métadonnées en DB
      - traces → table traces
      - completeness → table completeness
   c. Met à jour mission.status → "analyzed"
   d. Retourne les résultats importés au client
```

---

## 6. Workflows N8N

### 6.1 Vue d'ensemble

| # | Workflow | Déclencheur | Entrée | Sortie |
|---|---------|-------------|--------|--------|
| WF-01 | Upload documents | Webhook POST /missions/documents/upload | URLs signées + métadonnées | confirmation réception |
| WF-02 | Pré-analyse complète | Webhook POST /missions/analyze | mission_id, scenario, URLs signées | lance le traitement asynchrone |
| WF-03 | Parsing FEC | Sous-workflow de WF-02 | URL signée du FEC | écritures structurées |
| WF-04 | Extraction PDF | Sous-workflow de WF-02 | URL signée du PDF | texte extrait + métadonnées |
| WF-05 | Analyse LLM | Sous-workflow de WF-02 | écritures + textes PDFs | signaux documentaires |
| WF-06 | Génération livrables | Sous-workflow de WF-02 | résultats complets | 4 fichiers (PDF/XLSX en base64) |
| WF-07 | Status polling | Webhook GET /missions/analyze/{id}/status | analysis_id | progression |
| WF-08 | Résultats complets | Webhook GET /missions/analyze/{id}/results | analysis_id | payload unique avec tout |

> Note : le workflow WF-01 de validation licence de la v2 est supprimé.
> La validation licence se fait désormais directement via Supabase, sans N8N.

### 6.2 Workflow WF-02 — Pré-analyse complète (détail)

```
[Webhook: POST /missions/analyze]
       │
       ▼
[Vérifier licence via header X-License-Key]
       │
       ▼
[Télécharger les documents via URLs signées Supabase]
       │
       ▼
[Étape 1: Parser le FEC]
  - Télécharger le .txt via l'URL signée
  - Lire le fichier (tab-delimited, norme DGFiP)
  - Colonnes : JournalCode, JournalLib, EcritureNum,
    EcritureDate, CompteNum, CompteLib, CompAuxNum,
    CompAuxLib, PieceRef, PieceDate, EcritureLib,
    Debit, Credit, EcrtureLet, DateLet, ValidDate
  - Valider la structure
  - Extraire et structurer les écritures
       │
       ▼
[Étape 2: Extraire le texte des PDFs]
  - Pour chaque PDF :
    - Télécharger via URL signée
    - Extraction texte natif (pdf-parse)
    - Si scan/image → OCR (Tesseract ou API)
    - Extraction métadonnées : dates, montants, références
       │
       ▼
[Étape 3: Rapprochement écritures ↔ pièces]
  - Pour chaque écriture du FEC :
    - Rechercher la pièce par PieceRef
    - Comparer montant, date, référence
    - Classifier : exact / partial / missing
       │
       ▼
[Étape 4: Analyse LLM — Détection de signaux]
  - Appels LLM (agnostique du provider)
  - Prompt adapté au scénario
  - Le LLM retourne des signaux structurés (JSON)
       │
       ▼
[Étape 5: Consolidation des signaux]
  - Fusion signaux déterministes (rapprochement)
    + signaux LLM (analyse sémantique)
  - Dédoublonnage
  - Classement par priorité
       │
       ▼
[Étape 6: Génération des 4 livrables]
  - Check-list complétude (PDF via pdfmake ou équivalent)
  - Tableau signaux (XLSX via exceljs)
  - Synthèse pré-analyse (PDF)
  - Journal traçabilité (PDF)
       │
       ▼
[Stocker les résultats pour récupération via GET /results]
```

### 6.3 Prompts LLM — Structure type

```
RÔLE :
Tu es un assistant de pré-analyse documentaire pour un commissaire aux
comptes. Tu identifies des signaux documentaires factuels. Tu ne qualifies
jamais une anomalie, tu ne conclus jamais, tu ne recommandes rien.

CONTEXTE :
Scénario : {scenario}
Mission : {mission_name}
Écriture analysée : {ecriture}
Documents associés : {documents_text}

CONSIGNE :
Analyse les éléments ci-dessous et identifie tout signal documentaire
factuel parmi les catégories suivantes :
- absence_piece : pièce justificative attendue mais non fournie
- incoherence_date : écart de dates entre documents
- incoherence_montant : écart de montants entre documents
- rupture_chaine : chaîne documentaire incomplète
- rattachement_temporel : doute sur le rattachement à l'exercice
- incompletude : information manquante dans un document

Pour chaque signal, retourne un objet JSON :
{
  "type": "...",
  "description": "...",
  "source_document": "...",
  "source_page": ...,
  "source_extract": "...",
  "rule_triggered": "...",
  "priority": "low | medium | high",
  "reasoning": "..."
}

Si aucun signal n'est détecté, retourne un tableau vide.

RÈGLES ABSOLUES :
- Jamais de conclusion d'audit
- Jamais de qualification "significatif" ou "non significatif"
- Jamais de recommandation d'opinion
- Tous les signaux sont des constats documentaires objectifs
- Toujours citer la source exacte (document, page, extrait)
```

### 6.4 Nettoyage N8N post-analyse

Après que l'API route Next.js a récupéré les résultats via `GET /results`, N8N peut supprimer les documents téléchargés et résultats temporaires. Rien ne persiste côté N8N. Les données comptables vivent dans Supabase, sous le contrôle de l'utilisateur.

---

## 7. Structure du projet Next.js

```
sofia-poc/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local                         ← Variables d'environnement
│
├── middleware.ts                       ← Auth middleware (vérifie cookie licence)
│
├── app/                               ← App Router (Next.js 14+)
│   ├── layout.tsx                     ← Root layout
│   ├── page.tsx                       ← Redirect vers /missions ou /activate
│   │
│   ├── (auth)/                        ← Routes sans layout principal
│   │   ├── activate/
│   │   │   └── page.tsx               ← Saisie clé de licence
│   │   └── setup/
│   │       └── page.tsx               ← Configuration profil CAC
│   │
│   ├── (app)/                         ← Routes avec layout principal (header + sidebar)
│   │   ├── layout.tsx                 ← Layout avec Header + Sidebar + Footer
│   │   ├── missions/
│   │   │   ├── page.tsx               ← Écran 1 : Accueil / sélection scénario
│   │   │   └── [id]/
│   │   │       ├── page.tsx           ← Redirect vers documents
│   │   │       ├── documents/
│   │   │       │   └── page.tsx       ← Écran 2 : Documents & complétude
│   │   │       ├── analysis/
│   │   │       │   └── page.tsx       ← Écran intermédiaire : progression
│   │   │       ├── signals/
│   │   │       │   ├── page.tsx       ← Écran 3 : Liste des signaux
│   │   │       │   └── [signalId]/
│   │   │       │       └── page.tsx   ← Écran 4 : Détail + décision
│   │   │       ├── deliverables/
│   │   │       │   └── page.tsx       ← Écran 6 : Livrables
│   │   │       └── traces/
│   │   │           └── page.tsx       ← Journal de traçabilité
│   │   └── settings/
│   │       └── page.tsx               ← Paramètres (profil, licence)
│   │
│   └── api/                           ← API Routes
│       ├── license/
│       │   ├── validate/route.ts      ← POST: valider clé
│       │   └── status/route.ts        ← GET: vérifier session
│       ├── profile/route.ts           ← GET/POST/PUT: CRUD profil
│       ├── missions/
│       │   ├── route.ts              ← GET/POST: lister/créer
│       │   └── [id]/
│       │       ├── route.ts          ← GET/PUT/DELETE: détail mission
│       │       ├── documents/
│       │       │   ├── route.ts      ← GET/POST: lister/ajouter docs
│       │       │   └── completeness/route.ts  ← GET: complétude
│       │       ├── analysis/
│       │       │   ├── route.ts      ← POST: lancer analyse
│       │       │   ├── status/route.ts  ← GET: polling statut
│       │       │   └── results/route.ts ← GET: résultats importés
│       │       ├── signals/
│       │       │   ├── route.ts      ← GET: liste signaux
│       │       │   ├── stats/route.ts ← GET: stats
│       │       │   └── [signalId]/route.ts  ← GET/PUT: détail/décision
│       │       ├── deliverables/
│       │       │   ├── route.ts      ← GET: liste livrables
│       │       │   ├── regenerate/route.ts  ← POST: regénérer
│       │       │   └── [delivId]/route.ts   ← GET: télécharger
│       │       └── traces/route.ts   ← GET: journal
│
├── components/                        ← Composants React partagés
│   ├── layout/
│   │   ├── Header.tsx                 ← Logo Sof'IA, profil CAC
│   │   ├── Sidebar.tsx                ← Navigation mission
│   │   └── Footer.tsx                 ← Version
│   ├── license/
│   │   └── LicenseInput.tsx           ← Input clé avec validation
│   ├── profile/
│   │   └── ProfileForm.tsx            ← Formulaire profil CAC
│   ├── mission/
│   │   ├── MissionCard.tsx
│   │   └── ScenarioSelector.tsx
│   ├── documents/
│   │   ├── DocumentTable.tsx
│   │   ├── CompletenessChart.tsx
│   │   └── FileDropzone.tsx           ← Drag & drop
│   ├── analysis/
│   │   └── ProgressBar.tsx            ← Barre de progression avec étapes
│   ├── signals/
│   │   ├── SignalTable.tsx
│   │   ├── SignalCard.tsx
│   │   ├── SignalDetail.tsx
│   │   ├── PriorityBadge.tsx
│   │   └── DecisionButtons.tsx
│   ├── deliverables/
│   │   ├── DeliverableCard.tsx
│   │   └── ExportButton.tsx
│   ├── trace/
│   │   └── TraceTimeline.tsx
│   └── common/
│       ├── SofiaDisclaimer.tsx         ← Mention obligatoire
│       └── LoadingSpinner.tsx
│
├── lib/                               ← Logique serveur partagée
│   ├── supabase/
│   │   ├── client.ts                  ← Supabase client (server-side)
│   │   ├── browser.ts                 ← Supabase client (client-side, si besoin)
│   │   └── types.ts                   ← Types générés depuis le schéma
│   ├── n8n/
│   │   └── client.ts                  ← Client HTTP vers N8N (+ header licence)
│   ├── auth/
│   │   ├── session.ts                 ← Gestion cookie session (encrypt/decrypt)
│   │   └── middleware.ts              ← Vérification licence
│   ├── services/
│   │   ├── results-importer.ts        ← Importe le payload N8N → Supabase
│   │   └── deliverable-generator.ts   ← Regénération locale des livrables
│   └── config/
│       ├── expected-documents.ts      ← Mapping docs attendus par scénario
│       └── signal-rules.ts            ← Catalogue de règles de signalement
│
├── hooks/                             ← React hooks client
│   ├── useLicense.ts
│   ├── useProfile.ts
│   ├── useMission.ts
│   ├── useSignals.ts
│   └── useDeliverables.ts
│
├── stores/                            ← State management (Zustand)
│   ├── missionStore.ts
│   └── analysisStore.ts
│
├── types/                             ← Types TypeScript partagés
│   ├── mission.ts
│   ├── signal.ts
│   ├── deliverable.ts
│   └── analysis.ts
│
├── data/                              ← Jeux de données fictifs pour le POC
│   ├── sondage_ca/
│   │   ├── FEC_demo.txt
│   │   ├── factures/
│   │   └── bons_livraison/
│   ├── cutoff/
│   │   ├── FEC_demo.txt
│   │   ├── factures/
│   │   └── bons_livraison/
│   └── pointage/
│       ├── bilan.pdf
│       ├── compte_resultat.pdf
│       └── annexe.pdf
│
├── supabase/                          ← Configuration Supabase
│   ├── migrations/
│   │   └── 001_initial.sql            ← Schéma PostgreSQL complet
│   └── seed.sql                       ← Données initiales (licences de test)
│
└── public/
    ├── logo.svg                       ← Logo Sof'IA
    └── favicon.ico
```

---

## 8. Flux utilisateur complet (séquence)

```
UTILISATEUR                    NEXT.JS (Vercel)                    SUPABASE / N8N
    │                              │                               │
    │  [PREMIER ACCÈS]            │                               │
    │── Ouvre l'URL ──────────────►│── Pas de cookie session        │
    │◄── Écran activation ────────│                               │
    │── Saisir clé licence ───────►│── POST /api/license/validate   │
    │                              │── SELECT FROM licenses ───────►│ SUPABASE
    │                              │◄── licence trouvée ───────────│
    │                              │── Set cookie httpOnly           │
    │◄── Écran setup profil ──────│                               │
    │── Remplir nom, cabinet ─────►│── POST /api/profile            │
    │                              │── INSERT INTO profiles ───────►│ SUPABASE
    │                              │                               │
    │  [ACCÈS SUIVANTS]           │                               │
    │── Ouvre l'URL ──────────────►│── Cookie présent + valide      │
    │◄── Écran accueil ──────────│                               │
    │                              │                               │
    │  [NOUVELLE MISSION]          │                               │
    │── Choisir scénario ────────►│── POST /api/missions            │
    │                              │── INSERT INTO missions ───────►│ SUPABASE
    │◄── Écran ajout documents ──│                               │
    │                              │                               │
    │── Glisser FEC + PDFs ──────►│── POST /api/missions/[id]/docs  │
    │                              │── Upload → Supabase Storage ──►│ SUPABASE
    │                              │── INSERT INTO documents ──────►│ SUPABASE
    │◄── Complétude affichée ────│  (calcul côté API route)       │
    │                              │                               │
    │  [ANALYSE]                   │                               │
    │── "Lancer la pré-analyse" ──►│── POST /api/.../analysis       │
    │                              │── Génère URLs signées Storage   │
    │                              │── POST N8N /missions/analyze ──►│ N8N
    │                              │◄── 202 Accepted ──────────────│
    │◄── Barre de progression ───│                               │
    │                              │                               │
    │  (polling)                   │── GET N8N /status ─────────────►│ N8N
    │                              │◄── progress updates ──────────│
    │                              │                               │
    │                              │── GET N8N /results ────────────►│ N8N
    │                              │◄── PAYLOAD COMPLET ───────────│
    │                              │                               │
    │                              │── Importe tout dans Supabase   │
    │                              │   ├─ ecritures ───────────────►│ SUPABASE
    │                              │   ├─ rapprochements ──────────►│ SUPABASE
    │                              │   ├─ signals ─────────────────►│ SUPABASE
    │                              │   ├─ completeness ────────────►│ SUPABASE
    │                              │   ├─ traces ──────────────────►│ SUPABASE
    │                              │   └─ livrables (Storage) ─────►│ SUPABASE
    │                              │── UPDATE mission → analyzed ───►│ SUPABASE
    │◄── Écran signaux ─────────│                               │
    │                              │     ┌─────────────────────┐   │
    │  [CONSULTATION & DÉCISIONS]  │     │ N8N n'est plus      │   │
    │  Tout est dans Supabase      │     │ nécessaire pour     │   │
    │                              │     │ cette mission        │   │
    │── Clic sur un signal ──────►│     └─────────────────────┘   │
    │                              │── SELECT signal + explicab. ──►│ SUPABASE
    │◄── Détail + explicabilité ──│                               │
    │                              │                               │
    │── Valider / Rejeter ───────►│── PUT /api/.../signals/[id]    │
    │                              │── UPDATE signal ───────────────►│ SUPABASE
    │                              │── INSERT trace ────────────────►│ SUPABASE
    │◄── Confirmation ───────────│                               │
    │                              │                               │
    │── "Exporter livrables" ────►│── Regénère depuis Supabase     │
    │◄── PDF / XLSX téléchargés ──│  (intègre les décisions CAC)  │
```

---

## 9. Regénération locale des livrables

Après l'analyse initiale, Supabase stocke les `content_json` de chaque livrable. Quand le CAC prend des décisions (validation/rejet), les livrables doivent être mis à jour pour les refléter.

**Les API routes Next.js regénèrent les livrables** sans N8N :

| Livrable | Comment |
|---|---|
| Check-list complétude | Données statiques (table completeness), ne change pas après analyse |
| Tableau signaux | Ajoute les colonnes décision + commentaire depuis Supabase |
| Synthèse pré-analyse | Template serveur + données Supabase (pas de LLM nécessaire) |
| Journal traçabilité | Concatène les traces Supabase (actions Sof'IA + actions CAC) |

Technologies pour la génération côté serveur (API routes) :
- **PDF** : pdfmake (fonctionne côté Node.js dans les API routes Vercel)
- **XLSX** : exceljs (idem)

Les fichiers regénérés sont uploadés dans Supabase Storage et les métadonnées mises à jour.

---

## 10. Sécurité & conformité

### 10.1 Transport
- Toutes les communications en **HTTPS** (Vercel = HTTPS par défaut)
- Communication Next.js → N8N : header `X-License-Key` (côté serveur uniquement)
- Communication Next.js → Supabase : `SUPABASE_SERVICE_ROLE_KEY` (côté serveur uniquement)
- Le navigateur ne communique jamais directement avec N8N ni avec Supabase en service role

### 10.2 Données dans Supabase
- **Row Level Security (RLS)** : chaque table filtre par `license_id` — un utilisateur ne voit que ses données
- Documents stockés dans Supabase Storage avec politique d'accès par licence
- Pour le POC : RLS simple basé sur le `license_id` injecté par l'API route

### 10.3 Données côté N8N
- **Rien ne persiste.** Les documents téléchargés et résultats sont supprimés après récupération.
- N8N ne stocke aucune donnée durable.
- Les documents sont transmis via URLs signées (expiration 1h) — N8N ne conserve pas d'accès permanent.

### 10.4 Session
- Cookie httpOnly, secure, sameSite=strict
- Chiffré avec une clé secrète (env var `SESSION_SECRET`)
- Expiration : 30 jours (pour le POC)
- Pas de JWT, pas de session serveur complexe

### 10.5 Conformité
- **RGPD** : données dans Supabase (EU possible), N8N ne stocke rien durablement
- **IA Act** : explicabilité systématique, supervision humaine obligatoire
- **NEP 230** : traçabilité complète, livrables intégrables au dossier, identification du CAC

### 10.6 Disclaimer systématique
Chaque écran affichant des résultats Sof'IA doit contenir :
> **Analyse automatique — à valider par le commissaire aux comptes.**
> Sof'IA ne se substitue pas au jugement professionnel.

---

## 11. Stack technique récapitulative

| Composant | Technologie | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | TypeScript, React Server Components |
| Hébergement | Vercel | Déploiement automatique via Git |
| Base de données | Supabase (PostgreSQL) | RLS, realtime (optionnel) |
| Stockage fichiers | Supabase Storage | Buckets : documents, deliverables |
| Frontend | React 18+ + TypeScript | — |
| Styling | Tailwind CSS 3+ | — |
| State management | Zustand 4+ | Stores client légers |
| Data fetching | SWR ou React Query | Polling, cache, revalidation |
| Backend / orchestration IA | N8N (self-hosted) | https://n8n.agence-b.fr/ |
| LLM | Agnostique (Claude / GPT / Mistral) | Via N8N |
| PDF viewer | react-pdf 7+ | Viewer intégré pour documents source |
| Génération PDF serveur | pdfmake 0.2+ | API routes (regénération livrables) |
| Génération XLSX serveur | exceljs 4+ | API routes (regénération livrables) |
| Drag & drop fichiers | react-dropzone 14+ | Upload de documents |
| Session | iron-session ou jose | Cookie chiffré httpOnly |
| Icons | Lucide React | — |

---

## 12. Variables d'environnement (.env.local)

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

> `NEXT_PUBLIC_*` = accessible côté client.
> Toutes les autres = serveur uniquement (API routes).

---

## 13. Déploiement

### 13.1 Vercel

```bash
# Déploiement automatique via Git
# 1. Push sur main → Vercel build + deploy
# 2. Variables d'environnement configurées dans Vercel Dashboard
# 3. Domaine custom possible (sofia-poc.vercel.app par défaut)
```

### 13.2 Supabase

```bash
# 1. Créer un projet Supabase
# 2. Exécuter la migration : supabase/migrations/001_initial.sql
# 3. Exécuter le seed : supabase/seed.sql (licences de test)
# 4. Créer les buckets Storage : "documents" et "deliverables"
# 5. Configurer les politiques RLS
```

### 13.3 N8N

```bash
# N8N déjà hébergé sur https://n8n.agence-b.fr/
# 1. Importer les workflows (WF-01 à WF-08)
# 2. Configurer les credentials LLM
# 3. Activer les webhooks
```

---

## 14. Planning de développement suggéré

| Semaine | Dates | Focus |
|---|---|---|
| S1 | 14–16 fév | Setup Next.js + Supabase + migrations. Licence + profil. Écran accueil (scénario). Écran documents (drag & drop + upload Storage + complétude). |
| S2 | 17–23 fév | Workflows N8N (WF-01 à WF-08). API route analyse (upload URLs signées → N8N → poll → import résultats). Écran progression. Import résultats dans Supabase. Écran signaux. |
| S3 | 24–28 fév | Écran détail signal + explicabilité. Décisions (validation/rejet). Écran livrables + regénération serveur. Journal traçabilité. Polish UI. |
| Buffer | 01–02 mars | Jeux de données fictifs finalisés. Tests end-to-end. Déploiement Vercel final. |
| Dépôt | **02 mars minuit** | **Livraison POC autoportant** |
| Pitch | 03–06 mars | Préparation pitch. Slides (envoi vendredi 06 mars). |
| Finale | **09 mars** | **Pitch 4 min devant le jury** |

---

## 15. Ce qui a changé par rapport à la v2 (Electron)

| Supprimé / Changé | Pourquoi |
|---|---|
| Electron + electron-builder | Remplacé par Next.js webapp sur Vercel |
| SQLite (better-sqlite3) | Remplacé par Supabase (PostgreSQL) |
| Filesystem local | Remplacé par Supabase Storage |
| IPC channels (10 domaines) | Remplacé par API routes REST |
| Mode offline complet | Supprimé — webapp = toujours en ligne |
| Matrice online/offline | Supprimée — tout est online |
| Connectivity indicator | Supprimé |
| electron-store (config chiffrée) | Remplacé par cookie session + Supabase |
| Validation licence via N8N | Remplacé par requête directe Supabase |
| Sync / stockage local | Tout dans Supabase |
| Packaging / installateur | Remplacé par déploiement Vercel (URL) |
| Upload multipart vers N8N | Remplacé par URLs signées Supabase Storage |
