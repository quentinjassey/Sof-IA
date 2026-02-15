# Guide d'integration N8N — POC SOF'IA

> **Public cible :** Developpeur humain qui construit les workflows N8N pour s'integrer a la webapp Next.js SOF'IA.
>
> **Contexte :** SOF'IA est un outil de pre-analyse documentaire assiste par IA, destine aux commissaires aux comptes (CAC). L'application Next.js gere l'interface, l'authentification, le stockage et la persistance des donnees. N8N gere le traitement des documents, la detection de signaux par LLM et la generation initiale des livrables.
>
> **Principe fondamental :** N8N est un service de traitement temporaire. Toutes les donnees persistantes sont dans Supabase. Apres l'analyse, les resultats N8N sont importes dans Supabase, et N8N peut nettoyer ses donnees temporaires.

---

## Table des matieres

1. [Vue d'ensemble de l'architecture](#1-vue-densemble-de-larchitecture)
2. [Authentification](#2-authentification)
3. [Endpoints webhook a construire](#3-endpoints-webhook-a-construire)
4. [Modeles de donnees — Entree et Sortie](#4-modeles-de-donnees--entree-et-sortie)
5. [Pipeline d'analyse (6 etapes)](#5-pipeline-danalyse-6-etapes)
6. [Reference des regles de signaux](#6-reference-des-regles-de-signaux)
7. [Documents attendus par scenario](#7-documents-attendus-par-scenario)
8. [Directives pour les prompts LLM](#8-directives-pour-les-prompts-llm)
9. [Gestion des erreurs](#9-gestion-des-erreurs)
10. [Tests et validation](#10-tests-et-validation)

---

## 1. Vue d'ensemble de l'architecture

```
┌──────────────┐     POST /analyze      ┌──────────────┐
│              │ ────────────────────►   │              │
│   Next.js    │     GET /status         │     N8N      │
│   (Vercel)   │ ────────────────────►   │  (agence-b)  │
│              │     GET /results        │              │
│              │ ────────────────────►   │              │
└──────┬───────┘                         └──────┬───────┘
       │                                        │
       │  Supabase (PostgreSQL + Storage)       │  Telecharge les docs
       │  ← Toutes les donnees persistantes     │  via URLs signees
       ▼                                        ▼
┌──────────────┐                         ┌──────────────┐
│  Supabase    │                         │  API LLM     │
│  (BD + S3)   │                         │  (Claude/    │
│              │                         │   GPT/etc.)  │
└──────────────┘                         └──────────────┘
```

**Flux :**
1. L'utilisateur televerse les documents → Supabase Storage
2. L'utilisateur clique sur « Lancer la pre-analyse » → Next.js genere des URLs signees
3. Next.js appelle N8N `POST /missions/analyze` avec les URLs signees
4. Next.js interroge N8N `GET /missions/analyze/{id}/status` toutes les 4 secondes
5. Une fois termine, Next.js appelle `GET /missions/analyze/{id}/results`
6. Next.js importe la totalite du payload dans Supabase
7. N8N peut nettoyer les donnees temporaires

**URL de base N8N :** `https://n8n.agence-b.fr/webhook/sofia`

---

## 2. Authentification

Chaque requete de Next.js inclut l'en-tete :

```
X-License-Key: DEMO-SOFI-2026-0001
```

**Vos workflows N8N DOIVENT :**
- Lire l'en-tete `X-License-Key` sur chaque webhook
- Verifier qu'il s'agit d'une chaine non vide
- L'inclure dans les appels Supabase si necessaire
- Rejeter les requetes sans cle valide (retourner 401)

**Cles de licence de test :**
- `DEMO-SOFI-2026-0001` — Acces complet, 3 scenarios
- `DEMO-SOFI-2026-0002` — Acces complet, 3 scenarios
- `DEMO-SOFI-2026-JURY` — Cle d'evaluation jury

---

## 3. Endpoints webhook a construire

Vous devez construire **4 endpoints webhook** dans N8N :

### 3.1. POST /missions/analyze

**URL complete :** `https://n8n.agence-b.fr/webhook/sofia/missions/analyze`

**Objectif :** Demarrer le pipeline de pre-analyse de maniere asynchrone.

**Corps de la requete :**
```json
{
  "mission_id": "uuid-chaine",
  "scenario": "sondage_ca",
  "documents": [
    {
      "id": "uuid-chaine",
      "type": "fec",
      "filename": "FEC_ACME_2025.txt",
      "download_url": "https://xxx.supabase.co/storage/v1/object/sign/documents/..."
    },
    {
      "id": "uuid-chaine",
      "type": "facture_vente",
      "filename": "FAC-2025-0847.pdf",
      "download_url": "https://xxx.supabase.co/storage/v1/object/sign/documents/..."
    }
  ],
  "options": {
    "cutoff_window_days": 10,
    "priority_threshold": "low"
  }
}
```

**Reponse attendue (202 Accepted) :**
```json
{
  "analysis_id": "uuid-que-vous-generez",
  "mission_id": "uuid-de-la-requete",
  "status": "processing",
  "estimated_duration_seconds": 30
}
```

**Ce que vous devez faire :**
1. Generer un `analysis_id` unique (UUID)
2. Stocker le contexte de la requete (mission_id, scenario, documents) indexe par analysis_id
3. Demarrer le pipeline asynchrone en 6 etapes (voir Section 5)
4. Retourner immediatement avec l'analysis_id

---

### 3.2. GET /missions/analyze/{analysisId}/status

**URL complete :** `https://n8n.agence-b.fr/webhook/sofia/missions/analyze/{analysisId}/status`

**Objectif :** Permettre a Next.js de suivre la progression. Appele toutes les 4 secondes.

**Reponse — En cours de traitement :**
```json
{
  "analysis_id": "uuid",
  "status": "processing",
  "progress": {
    "step": "rapprochement",
    "step_number": 3,
    "total_steps": 6,
    "percent": 50,
    "message": "Rapprochement des ecritures avec les pieces justificatives..."
  }
}
```

**Reponse — Termine :**
```json
{
  "analysis_id": "uuid",
  "status": "completed",
  "progress": {
    "step": "termine",
    "step_number": 6,
    "total_steps": 6,
    "percent": 100,
    "message": "Pre-analyse terminee."
  },
  "results_summary": {
    "ecritures_parsed": 9,
    "rapprochements_created": 6,
    "rapprochements_missing": 3,
    "signals_generated": 4,
    "signals_by_priority": {
      "high": 3,
      "medium": 1,
      "low": 0
    },
    "deliverables_generated": 4
  }
}
```

**Reponse — Echec :**
```json
{
  "analysis_id": "uuid",
  "status": "failed",
  "error": "Erreur lors du parsing du FEC : format non reconnu."
}
```

**Les 6 etapes et leurs libelles :**

| step_number | Cle de l'etape | Message (francais) |
|---|---|---|
| 1 | `parsing_fec` | Analyse du fichier des ecritures comptables (FEC)... |
| 2 | `extraction_pdf` | Extraction du texte des documents PDF... |
| 3 | `rapprochement` | Rapprochement des ecritures avec les pieces justificatives... |
| 4 | `analyse_llm` | Analyse documentaire par intelligence artificielle... |
| 5 | `consolidation` | Consolidation et deduplication des signaux... |
| 6 | `generation_livrables` | Generation des livrables documentaires... |

---

### 3.3. GET /missions/analyze/{analysisId}/results

**URL complete :** `https://n8n.agence-b.fr/webhook/sofia/missions/analyze/{analysisId}/results`

**Objectif :** Retourner le payload complet de l'analyse. Appele une seule fois apres status = "completed".

**C'est l'endpoint critique.** Le payload entier est une seule reponse JSON contenant toutes les donnees qui seront importees dans Supabase.

**Reponse (200) :** Voir la [Section 4.2](#42-payload-des-resultats-n8n--nextjs) pour le schema complet.

**Important :**
- Cette reponse peut etre volumineuse (fichiers encodes en base64). Configurez un timeout de 60s minimum.
- Les resultats ont un **TTL de 48 heures**. Apres ce delai, N8N peut nettoyer et retourner 410 Gone.
- Next.js appellera cet endpoint exactement une fois par analyse reussie.

---

### 3.4. POST /missions/documents/upload (Optionnel)

**URL complete :** `https://n8n.agence-b.fr/webhook/sofia/missions/documents/upload`

**Objectif :** Pre-valider les documents avant l'analyse. Cet endpoint est optionnel — l'endpoint `POST /analyze` recoit la meme liste de documents avec les URLs signees.

**Corps de la requete :**
```json
{
  "mission_id": "uuid",
  "scenario": "sondage_ca",
  "documents": [
    {
      "id": "uuid",
      "type": "fec",
      "filename": "FEC_ACME_2025.txt",
      "download_url": "https://url-signee..."
    }
  ]
}
```

**Reponse (200) :**
```json
{
  "mission_id": "uuid",
  "documents_received": 3,
  "ready_for_analysis": true
}
```

---

## 4. Modeles de donnees — Entree et Sortie

### 4.1. Types de documents (Entree)

Le champ `type` de chaque document indique la nature du fichier :

| type | Description | Format |
|---|---|---|
| `fec` | Fichier des Ecritures Comptables | Texte TXT delimite par tabulations (norme DGFiP) |
| `facture_vente` | Facture de vente | PDF |
| `facture_achat` | Facture d'achat | PDF |
| `bon_livraison` | Bon de livraison / bon de reception | PDF |
| `contrat` | Contrat | PDF |
| `annexe` | Annexe aux comptes annuels | PDF ou TXT |
| `bilan` | Bilan | PDF ou TXT |
| `compte_resultat` | Compte de resultat | PDF ou TXT |
| `autre` | Autre document | Tout format |

### 4.2. Payload des resultats (N8N → Next.js)

Voici la structure JSON exacte que votre endpoint `GET /results` doit retourner :

```typescript
{
  // --- Metadonnees ---
  "analysis_id": "uuid",
  "mission_id": "uuid",
  "completed_at": "2026-02-15T14:30:00.000Z",  // ISO 8601

  // --- 1. Completude documentaire ---
  "completeness": [
    {
      "type": "fec",                    // correspond au type de document
      "label": "Fichier des ecritures comptables (FEC)",
      "required": true,
      "status": "present",              // "present" | "missing" | "incomplete"
      "count": 1,
      "note": null                      // explication optionnelle
    },
    {
      "type": "bon_livraison",
      "label": "Bons de livraison",
      "required": true,
      "status": "incomplete",
      "count": 6,
      "note": "6 BL fournis pour 9 factures"
    }
  ],

  // --- 2. Ecritures FEC parsees ---
  "ecritures": [
    {
      "id": "uuid-que-vous-generez",
      "journal_code": "VE",
      "journal_lib": "Journal des ventes",
      "ecriture_num": "VE-2025-0847",
      "ecriture_date": "2025-11-15",    // AAAA-MM-JJ
      "compte_num": "411000",
      "compte_lib": "Clients",
      "comp_aux_num": "CLI-DUPONT",
      "comp_aux_lib": "SA Dupont Equipements",
      "piece_ref": "FAC-2025-0847",
      "piece_date": "2025-11-15",
      "ecriture_lib": "Vente marchandises Dupont",
      "debit": 28800.00,                // NUMERIC(15,2)
      "credit": 0.00,
      "lettrage": null,
      "date_lettrage": null,
      "valid_date": "2025-11-15"
    }
  ],

  // --- 3. Rapprochement ecritures-documents ---
  "rapprochements": [
    {
      "id": "uuid-que-vous-generez",
      "ecriture_id": "uuid-de-l-ecriture-ci-dessus",
      "document_id": "uuid-du-document-televerse-ou-null",
      "match_type": "exact",            // "exact" | "partial" | "missing"
      "match_details": {
        "montant_match": true,
        "date_match": true,
        "reference_match": true,
        "details": "Facture FAC-2025-0847 correspond au BL-2025-0612"
      },
      "confidence": "high"              // "high" | "medium" | "low"
    },
    {
      "id": "uuid",
      "ecriture_id": "uuid-d-une-autre-ecriture",
      "document_id": null,              // null = aucun document correspondant trouve
      "match_type": "missing",
      "match_details": {
        "montant_match": false,
        "date_match": false,
        "reference_match": false,
        "details": "Aucun bon de livraison correspondant"
      },
      "confidence": "high"
    }
  ],

  // --- 4. Signaux documentaires ---
  "signals": [
    {
      "id": "uuid-que-vous-generez",
      "document_id": "uuid-ou-null",
      "ecriture_id": "uuid-ou-null",
      "rapprochement_id": "uuid-ou-null",
      "type": "absence_piece",
      "description": "Facture FAC-2025-0851 (SAS Moreau Industries, 35 000,00 EUR HT) sans bon de livraison associe. La facture mentionne une livraison prevue courant decembre 2025, mais aucun bon de livraison n'a ete fourni.",
      "source_document": "FAC-2025-0851",
      "source_page": 1,
      "source_extract": "Livraison et installation prevues courant decembre 2025",
      "rule_triggered": "SCA-001",
      "rule_description": "Facture de vente sans bon de livraison associe",
      "priority": "high",
      "explicability": {
        "reasoning": "La facture FAC-2025-0851 fait reference a une livraison mais aucun bon de livraison n'a ete fourni dans le dossier. L'absence de ce justificatif ne permet pas de confirmer la realite de la livraison.",
        "documents_compared": [
          {
            "document": "FAC-2025-0851",
            "element": "Mention de livraison en page 1"
          },
          {
            "document": "FEC_ACME_2025.txt",
            "element": "Ecriture VE-2025-0851, debit 35 000,00 EUR"
          }
        ],
        "rule_source": "NEP 500"
      }
    }
  ],

  // --- 5. Livrables generes ---
  "deliverables": [
    {
      "id": "uuid-que-vous-generez",
      "type": "checklist_completude",
      "title": "Check-list de completude documentaire",
      "format": "pdf",
      "content_json": { },              // donnees structurees pour regeneration
      "file_base64": "JVBERi0xLjQK..."  // contenu PDF encode en base64
    },
    {
      "id": "uuid",
      "type": "tableau_signaux",
      "title": "Tableau des signaux documentaires",
      "format": "xlsx",
      "content_json": { },
      "file_base64": "UEsDBBQAAAA..."   // contenu XLSX encode en base64
    },
    {
      "id": "uuid",
      "type": "synthese_preanalyse",
      "title": "Synthese de pre-analyse (NEP 230)",
      "format": "pdf",
      "content_json": { },
      "file_base64": "JVBERi0xLjQK..."
    },
    {
      "id": "uuid",
      "type": "journal_tracabilite",
      "title": "Journal de tracabilite",
      "format": "pdf",
      "content_json": { },
      "file_base64": "JVBERi0xLjQK..."
    }
  ],

  // --- 6. Traces d'analyse ---
  "traces": [
    {
      "timestamp": "2026-02-15T14:28:00.000Z",
      "actor": "sofia",
      "action": "analysis_started",
      "details": "Pre-analyse demarree — Scenario : Sondage sur le chiffre d'affaires"
    },
    {
      "timestamp": "2026-02-15T14:28:05.000Z",
      "actor": "sofia",
      "action": "fec_parsed",
      "details": "FEC analyse : 9 ecritures extraites du journal VE"
    },
    {
      "timestamp": "2026-02-15T14:28:12.000Z",
      "actor": "sofia",
      "action": "pdf_extracted",
      "details": "8 documents PDF traites (extraction texte)"
    },
    {
      "timestamp": "2026-02-15T14:28:20.000Z",
      "actor": "sofia",
      "action": "rapprochement_completed",
      "details": "9 rapprochements realises : 6 exacts, 0 partiels, 3 absents"
    },
    {
      "timestamp": "2026-02-15T14:28:28.000Z",
      "actor": "sofia",
      "action": "signals_generated",
      "details": "4 signaux documentaires generes (3 eleves, 1 moyen, 0 faible)"
    },
    {
      "timestamp": "2026-02-15T14:28:30.000Z",
      "actor": "sofia",
      "action": "deliverables_generated",
      "details": "4 livrables generes (2 PDF, 1 XLSX, 1 PDF)"
    }
  ]
}
```

---

## 5. Pipeline d'analyse (6 etapes)

Construisez ces etapes comme des blocs sequentiels dans vos workflows N8N :

### Etape 1 : Parsing du FEC (`parsing_fec`)

**Entree :** Telecharger le document `fec` via son URL signee.

**Format FEC (norme DGFiP) :**
- Fichier texte delimite par tabulations (TSV)
- Premiere ligne = en-tetes
- Encodage : UTF-8 ou ISO-8859-1
- Champs : JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, etc.
- Dates : format `AAAAMMJJ` (ex. `20251215`)
- Montants : format francais avec virgule comme separateur decimal (ex. `35000,00`) — a convertir en numerique

**Sortie :** Tableau d'objets `ecritures` (voir Section 4.2).

**Convertir les dates** de `AAAAMMJJ` en `AAAA-MM-JJ` pour la sortie.

---

### Etape 2 : Extraction du texte des PDF (`extraction_pdf`)

**Entree :** Telecharger tous les documents PDF via les URLs signees.

**Traitement :**
- Extraire le texte de chaque PDF (extraction native en priorite, OCR en solution de secours)
- Stocker le texte extrait indexe par identifiant de document
- Noter les numeros de page pour reference ulterieure

**Sortie :** Stockage interne de texte pour le rapprochement et l'analyse LLM.

---

### Etape 3 : Rapprochement ecritures-documents (`rapprochement`)

**Entree :** Ecritures parsees + texte extrait des PDF.

**Traitement :**
- Pour chaque ecriture, rechercher le(s) document(s) justificatif(s) correspondant(s)
- Criteres de rapprochement : `piece_ref` → nom de fichier/contenu du document, montants, dates
- Classifier chaque correspondance : `exact`, `partial` ou `missing`
- Calculer le niveau de confiance

**Sortie :** Tableau d'objets `rapprochements` (voir Section 4.2).

---

### Etape 4 : Detection des signaux par LLM (`analyse_llm`)

**Entree :** Ecritures, rapprochements, texte extrait des PDF, type de scenario, regles de signaux.

**Traitement :**
- Envoyer les donnees documentaires au LLM (Claude, GPT, Mistral — independant du fournisseur)
- Utiliser le catalogue de regles de signaux (Section 6) pour guider la detection
- Le LLM identifie les signaux documentaires factuels
- Voir Section 8 pour les directives de prompts

**Sortie :** Tableau d'objets `signals` (voir Section 4.2).

**REGLES IMPERATIVES pour la generation de signaux :**
- Chaque signal DOIT avoir un champ `explicability` avec `reasoning`, `documents_compared` et `rule_source`
- Chaque signal DOIT referencer une regle specifique via `rule_triggered` (ex. `SCA-001`)
- Les descriptions DOIVENT etre des observations factuelles, jamais des conclusions
- Utiliser le vocabulaire requis : « signal documentaire », « constat factuel », « necessite l'attention du CAC »
- NE JAMAIS utiliser : « anomalie », « significatif », « fraude », « conclusion d'audit »

---

### Etape 5 : Consolidation (`consolidation`)

**Entree :** Signaux bruts du LLM.

**Traitement :**
- Dedupliquer les signaux (meme document + meme regle = fusionner)
- Valider que tous les champs requis sont presents
- Attribuer les niveaux de priorite definitifs
- Verifier que le nombre de signaux correspond aux attentes par scenario (voir Section 10)

**Sortie :** Tableau nettoye de `signals`.

---

### Etape 6 : Generation des livrables (`generation_livrables`)

**Entree :** Toutes les donnees d'analyse (completude, ecritures, rapprochements, signaux).

**Generer 4 fichiers :**

| Type | Format | Contenu |
|---|---|---|
| `checklist_completude` | PDF | Tableau des documents attendus vs recus avec statut |
| `tableau_signaux` | XLSX | Tous les signaux avec type, source, regle, priorite (PAS de colonne decision — celle-ci est ajoutee par Next.js apres la revue du CAC) |
| `synthese_preanalyse` | PDF | Perimetre, documents analyses, constats principaux, limites de l'analyse |
| `journal_tracabilite` | PDF | Journal chronologique de toutes les actions Sof'IA durant l'analyse |

**Chaque livrable DOIT inclure :**
- La mention obligatoire : « Analyse automatique — a valider par le commissaire aux comptes. Sof'IA ne se substitue pas au jugement professionnel. »
- Aucune conclusion ni opinion automatisee

**Retourner :** Le contenu du fichier encode en base64 dans le champ `file_base64`.

**Note :** Next.js regenerera ces livrables apres les decisions du CAC (ajout des colonnes de decision au XLSX, mise a jour de la synthese). Les versions initiales de N8N sont des brouillons pre-decision.

---

## 6. Reference des regles de signaux

Ce sont les regles que votre LLM doit utiliser pour detecter les signaux. Le champ `rule_triggered` de chaque signal doit correspondre a l'un de ces identifiants.

### Regles communes (tous les scenarios)

| ID | Type | Priorite | Description |
|---|---|---|---|
| DOC-001 | absence_piece | elevee | Piece referencee dans le FEC mais non fournie dans le dossier |
| DOC-002 | incompletude | moyenne | Document fourni mais incomplet (pages manquantes, illisible) |
| DOC-003 | rupture_chaine | faible | Document dans un format non exploitable |

### Regles Sondage CA (scenario `sondage_ca`)

| ID | Type | Priorite | Description | NEP |
|---|---|---|---|---|
| SCA-001 | absence_piece | elevee | Facture de vente sans bon de livraison associe | NEP 500 |
| SCA-002 | incoherence_montant | elevee | Ecart de montant > 1% entre facture et ecriture FEC | NEP 500 |
| SCA-003 | incoherence_date | moyenne | Ecart > 5 jours entre date facture et date BL | NEP 500 |
| SCA-004 | rupture_chaine | elevee | Reference piece (PieceRef) du FEC introuvable dans les documents | NEP 500 |
| SCA-005 | rattachement_temporel | elevee | Vente comptabilisee en N, livraison effectuee en N+1 | NEP 500 §A14 |

### Regles Cut-off (scenario `cutoff`)

| ID | Type | Priorite | Description | NEP |
|---|---|---|---|---|
| CUT-001 | rattachement_temporel | elevee | Facture avant cloture, livraison apres cloture | NEP 500 §A14 |
| CUT-002 | rattachement_temporel | elevee | Facture apres cloture, livraison/reception avant cloture | NEP 500 §A14 |
| CUT-003 | incoherence_date | moyenne | Ecart temporel superieur a la fenetre de cut-off | NEP 500 |
| CUT-004 | absence_piece | elevee | Operation sans justificatif de date de livraison/prestation | NEP 500 |
| CUT-005 | incoherence_montant | moyenne | Avoir emis en N+1 annulant (partiellement) une vente enregistree en N | NEP 500 |

### Regles Pointage (scenario `pointage`)

| ID | Type | Priorite | Description | NEP |
|---|---|---|---|---|
| PTG-001 | incoherence_montant | elevee | Ecart de montant entre bilan et annexe sur un meme poste | NEP 500 |
| PTG-002 | incompletude | elevee | Information obligatoire absente de l'annexe (Art. L.123-13 C.Com) | NEP 500 |
| PTG-003 | incoherence_montant | elevee | Total actif different du total passif | NEP 500 |
| PTG-004 | incompletude | moyenne | Poste du bilan/CR sans note explicative dans l'annexe | NEP 500 |
| PTG-005 | rupture_chaine | moyenne | Variation notable d'un poste (>20%) sans explication suffisante | NEP 500 |

---

## 7. Documents attendus par scenario

### Sondage CA (`sondage_ca`)

| Type de document | Obligatoire | Description |
|---|---|---|
| `fec` | Oui | FEC du journal de ventes |
| `facture_vente` | Oui | Factures de l'echantillon selectionne |
| `bon_livraison` | Oui | Bons de livraison associes |
| `contrat` | Non | Contrats clients (si applicable) |
| `annexe` | Non | Annexe aux comptes annuels |

### Cut-off (`cutoff`)

| Type de document | Obligatoire | Description |
|---|---|---|
| `fec` | Oui | FEC journaux VE + HA autour de la cloture |
| `facture_vente` | Oui | Factures de vente periode de cloture |
| `facture_achat` | Oui | Factures fournisseurs periode de cloture |
| `bon_livraison` | Oui | BL clients + bons de reception fournisseurs |
| `contrat` | Non | Contrats prestations continues |

### Pointage (`pointage`)

| Type de document | Obligatoire | Description |
|---|---|---|
| `bilan` | Oui | Bilan (actif + passif) |
| `compte_resultat` | Oui | Compte de resultat |
| `annexe` | Oui | Annexe aux comptes annuels |
| `fec` | Non | FEC (pour verification complementaire) |

---

## 8. Directives pour les prompts LLM

Lors de l'appel au LLM pour la detection de signaux, votre prompt systeme DOIT inclure :

```
ROLE : Vous etes un assistant de pre-analyse documentaire pour un commissaire
aux comptes. Vous identifiez des signaux documentaires factuels.
Vous ne qualifiez JAMAIS une anomalie, vous ne concluez JAMAIS, vous ne
recommandez JAMAIS.

REGLES ABSOLUES :
- Ne jamais emettre de conclusions d'audit
- Ne jamais qualifier de « significatif » ou « non significatif »
- Ne jamais recommander une opinion
- Tous les signaux sont des observations documentaires objectives
- Toujours citer la source exacte (document, page, extrait)
- Utiliser « signal documentaire » (jamais « anomalie »)
- Utiliser « constat factuel » (jamais « conclusion »)
- Utiliser « necessite l'attention du CAC » (jamais « significatif »)

FORMAT DE SORTIE : Retourner un tableau JSON de signaux. Chaque signal doit
inclure :
- type : l'un parmi [absence_piece, incoherence_date, incoherence_montant,
        rupture_chaine, rattachement_temporel, incompletude]
- description : observation factuelle en francais
- rule_triggered : identifiant de la regle declenchee (SCA-001, CUT-002,
  PTG-005, etc.)
- priority : high | medium | low
- source_document : reference du document source
- source_page : numero de page (entier)
- source_extract : citation exacte du document source
- explicability.reasoning : pourquoi ce signal a ete declenche (factuel)
- explicability.documents_compared : quels documents ont ete analyses
- explicability.rule_source : reference NEP (ex. « NEP 500, §A14 »)
```

**Independant du fournisseur :** Utilisez Claude, GPT, Mistral ou tout autre LLM. Le prompt ci-dessus fonctionne avec tous les fournisseurs.

---

## 9. Gestion des erreurs

### Format des reponses d'erreur

Toutes les reponses d'erreur doivent utiliser ce format :

```json
{
  "error": "Message d'erreur lisible en francais",
  "code": "CODE_ERREUR",
  "details": "Details techniques (optionnel)"
}
```

### Codes d'erreur

| Code | Statut HTTP | Signification |
|---|---|---|
| `INVALID_LICENSE` | 401 | Cle de licence manquante ou invalide |
| `ANALYSIS_NOT_FOUND` | 404 | analysis_id introuvable |
| `RESULTS_EXPIRED` | 410 | TTL des resultats (48h) depasse |
| `FEC_PARSE_ERROR` | 422 | Format du fichier FEC illisible |
| `PDF_EXTRACT_ERROR` | 422 | Echec de l'extraction du texte PDF |
| `LLM_ERROR` | 502 | Echec de l'appel a l'API du LLM |
| `INTERNAL_ERROR` | 500 | Erreur N8N inattendue |

### TTL et nettoyage

- Les resultats d'analyse DOIVENT etre disponibles pendant **48 heures** apres la fin du traitement
- Apres 48h, retourner `410 Gone` avec le code `RESULTS_EXPIRED`
- N8N peut nettoyer les fichiers temporaires apres 48h
- Les documents telecharges (via URLs signees) peuvent etre supprimes apres la fin de l'analyse

---

## 10. Tests et validation

### Signaux attendus par scenario

Utilisez ces donnees pour valider que votre pipeline produit les resultats corrects :

**Sondage CA — 4 signaux attendus :**

| Signal | Regle | Type | Priorite | Source |
|---|---|---|---|---|
| S1 | SCA-001 | absence_piece | elevee | FAC-2025-0851 (35 000 EUR, pas de BL) |
| S2 | SCA-001 | absence_piece | elevee | FAC-2025-0854 (18 000 EUR, pas de BL) |
| S3 | SCA-002 | incoherence_montant | elevee | FAC-2025-0852 vs BL-2025-0616 (ecart de 750 EUR, 6%) |
| S4 | SCA-005 | rattachement_temporel | elevee | FAC-2025-0855 (30/12/2025) vs BL-2025-0617 (03/01/2026) |

**Cut-off — 4 signaux attendus :**

| Signal | Regle | Type | Priorite | Source |
|---|---|---|---|---|
| S1 | CUT-001 | rattachement_temporel | elevee | FAC-2025-1182 (29/12) vs BL-2025-0782 (05/01) — 44 000 EUR |
| S2 | CUT-002 | rattachement_temporel | elevee | FRN-2025-0489 (02/01) vs BR-2025-0345 (28/12) — 7 800 EUR |
| S3 | CUT-004 | absence_piece | elevee | FAC-2025-1183 (prestation, sans preuve d'achevement) — 16 000 EUR |
| S4 | CUT-005 | incoherence_montant | moyenne | AV-2026-0001 annule partiellement FAC-2025-1181 — 6 000 EUR |

**Pointage — 3 signaux attendus :**

| Signal | Regle | Type | Priorite | Source |
|---|---|---|---|---|
| S1 | PTG-001 | incoherence_montant | elevee | Bilan immo 996k vs Annexe Note 3 981k (ecart de 15 000 EUR) |
| S2 | PTG-002 | incompletude | moyenne | Engagements hors bilan absents de l'annexe |
| S3 | PTG-005 | rupture_chaine | moyenne | Variation de +82,7% « Autres charges externes » (40k sans explication) |

### Donnees de test

Les fichiers de donnees sont dans le dossier `data/` du depot :
- `data/sondage_ca/` — FEC + 8 factures + 6 bons de livraison
- `data/cutoff/` — FEC + factures autour du 31 decembre + bons de livraison/reception
- `data/pointage/` — Bilan + Compte de resultat + Annexe

**Societe fictive :** ACME Distribution SAS — Exercice clos le 31/12/2025

### Liste de verification avant mise en production

Avant de considerer votre integration N8N comme terminee, verifiez :

- [ ] Les 4 webhooks repondent correctement
- [ ] Le parsing du FEC gere le format delimite par tabulations avec la mise en forme des nombres a la francaise
- [ ] L'extraction du texte PDF fonctionne sur tous les documents d'exemple
- [ ] Le rapprochement ecritures-documents identifie correctement les correspondances exactes/partielles/manquantes
- [ ] Le LLM genere des signaux en utilisant le vocabulaire requis (aucun mot interdit)
- [ ] Le nombre de signaux correspond aux attentes (4 + 4 + 3 = 11 sur l'ensemble des scenarios)
- [ ] Chaque signal dispose d'une explicabilite complete (raisonnement + documents + regle)
- [ ] Les 4 livrables sont generes en tant que PDF/XLSX valides
- [ ] Les livrables incluent la mention obligatoire
- [ ] L'endpoint de statut retourne la progression pour les 6 etapes
- [ ] L'endpoint de resultats retourne le payload complet avec toutes les sections
- [ ] Les resultats sont disponibles pendant 48 heures apres la fin du traitement
- [ ] Les reponses d'erreur utilisent le format correct et des messages en francais
- [ ] L'en-tete `X-License-Key` est valide sur chaque requete
