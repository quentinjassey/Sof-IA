# Workflow Sondage — Construction du payload Sof'IA

Ce document décrit comment ajouter au workflow N8N **Sondage** les nœuds nécessaires pour produire le payload attendu par Next.js (`GET /missions/analyze/:id/results`) et l’importer dans Supabase.

## Prérequis

1. **Migration Supabase**  
   Appliquer `supabase/migrations/002_n8n_analysis_state_results.sql` pour ajouter la colonne `results_payload` à `n8n_analysis_state`.

2. **WF-08 (Results Retrieval)**  
   Doit lire la ligne `n8n_analysis_state` où `analysis_id = :id` et renvoyer `results_payload` en JSON (et mettre à jour `status = 'completed'` si besoin).

3. **Conventions dans le workflow**
   - Le nœud qui parse le FEC s’appelle par ex. **"Code in JavaScript"** (FEC).
   - Le nœud qui produit les signaux (après règles SCA + LLM) s’appelle par ex. **"Code in JavaScript4"**.
   - Le trigger du sous-workflow reçoit `body` avec `mission_id`, `scenario`, `documents`, `analysis_id` (passés par le workflow parent).

---

## 1. Schéma des ajouts

```
[Code FEC] ──► [Ecritures Keeper] ──┐
                                    ├──► [Merge] ──► [Build Sofia Payload] ──► [Supabase: PATCH n8n_analysis_state]
[Code4 (signaux)] ──────────────────┘
```

- **Ecritures Keeper** : reçoit la sortie du Code FEC, ne fait que repasser `ecritures` (et éventuellement `ecritures_count`) pour les avoir en entrée du Merge.
- **Merge** : mode **Combine** (ou Append selon votre version N8N), 2 entrées ; 1 entrée = sortie Ecritures Keeper, 1 entrée = sortie Code4.
- **Build Sofia Payload** : reçoit l’item fusionné + accès au trigger pour `analysis_id`, `mission_id`, `scenario`, `documents`. Construit l’objet `N8NResultsPayload` et le met dans `payload` pour le nœud suivant.
- **Supabase** : un nœud Supabase (ou HTTP Request) qui met à jour `n8n_analysis_state` :  
  `results_payload = payload.results_payload`, `status = 'completed'`, `progress_percent = 100`, etc., où `analysis_id` = celui du trigger.

---

## 2. Nœud « Ecritures Keeper »

- **Type** : Code (JavaScript).
- **Entrée** : sortie du nœud **Code FEC** (un item avec `ecritures` et optionnellement `ecritures_count`).
- **Sortie** : un seul item contenant `ecritures` (et éventuellement `ecritures_count`) pour alimenter le Merge.

```javascript
const item = $input.first().json;
return [
  {
    json: {
      ecritures: item.ecritures || [],
      ecritures_count: item.ecritures_count || 0,
    },
  },
];
```

Aucune autre logique : ce nœud sert uniquement à « garder » les écritures jusqu’au Merge.

---

## 3. Nœud « Build Sofia Payload »

- **Type** : Code (JavaScript).
- **Entrée** : sortie du **Merge** (un item qui contient à la fois les champs venant d’Ecritures Keeper et ceux de Code4).
- **Convention** : dans ce code, on suppose que :
  - Le trigger (ex. « When Executed by Another Workflow ») fournit `analysis_id`, `mission_id`, `scenario`, `documents`.
  - Le Merge a combiné :
    - `ecritures` (tableau) depuis Ecritures Keeper ;
    - `signals` (tableau) depuis Code4 — chaque élément peut avoir `rule_triggered`, `description`, `priority`, `source_document`, `source_page`, `source_extract`, `explicability`, etc. ;
    - `rapprochements` (tableau) depuis Code4 — chaque élément : `ecriture_id`, `document_id`, `match_type`, `match_details`, `confidence`.

Adaptez les noms de propriétés (`signals`, `rapprochements`, `ecritures`) si vos nœuds Code utilisent d’autres clés (ex. `signaux`, `matches`).

```javascript
// Récupérer le trigger pour analysis_id, mission_id, scenario, documents
const trigger = $("When Executed by Another Workflow").first().json;
const body = trigger.body || trigger;
const analysis_id = body.analysis_id || trigger.analysis_id;
const mission_id = body.mission_id || trigger.mission_id;
const scenario = (
  body.scenario ||
  trigger.scenario ||
  "sondage_ca"
).toLowerCase();
const documentsList = body.documents || trigger.documents || [];

// Entrée fusionnée (Merge) : ecritures + sortie Code4
const merged = $input.first().json;
const ecrituresRaw = merged.ecritures || [];
const signalsRaw = merged.signals || [];
const rapprochementsRaw = merged.rapprochements || [];

// ---------- 1) Ecritures avec id stable ----------
const ecritures = ecrituresRaw.map((e, i) => {
  const id = e.id || `ec-${analysis_id}-${i}`;
  return {
    id,
    journal_code: e.journal_code || e.JournalCode || "",
    journal_lib: e.journal_lib ?? e.JournalLib ?? null,
    ecriture_num: String(e.ecriture_num ?? e.EcritureNum ?? ""),
    ecriture_date: String(e.ecriture_date ?? e.EcritureDate ?? ""),
    compte_num: String(e.compte_num ?? e.CompteNum ?? ""),
    compte_lib: e.compte_lib ?? e.CompteLib ?? null,
    comp_aux_num: e.comp_aux_num ?? e.CompAuxNum ?? null,
    comp_aux_lib: e.comp_aux_lib ?? e.CompAuxLib ?? null,
    piece_ref: e.piece_ref ?? e.PieceRef ?? null,
    piece_date: e.piece_date ?? e.PieceDate ?? null,
    ecriture_lib: e.ecriture_lib ?? e.EcritureLib ?? null,
    debit: Number(e.debit ?? e.Debit ?? 0),
    credit: Number(e.credit ?? e.Credit ?? 0),
    lettrage: e.lettrage ?? e.Lettrage ?? null,
    date_lettrage: e.date_lettrage ?? e.DateLettrage ?? null,
    valid_date: e.valid_date ?? e.ValidDate ?? null,
  };
});

// Map ecriture index/ref -> id pour rapprochements
const ecritureIdByIndex = {};
ecritures.forEach((e, i) => {
  ecritureIdByIndex[i] = e.id;
  if (e.piece_ref) ecritureIdByIndex[e.piece_ref] = e.id;
});

// ---------- 2) Rapprochements avec id ----------
const rapprochements = rapprochementsRaw.map((r, i) => ({
  id: r.id || `rapp-${analysis_id}-${i}`,
  ecriture_id:
    r.ecriture_id ??
    ecritureIdByIndex[r.ecriture_index] ??
    ecritures[0]?.id ??
    "",
  document_id: r.document_id ?? null,
  match_type: (r.match_type || r.matchType || "partial").toLowerCase(),
  match_details: {
    montant_match:
      r.match_details?.montant_match ?? r.match_details?.montantMatch ?? true,
    date_match:
      r.match_details?.date_match ?? r.match_details?.dateMatch ?? true,
    reference_match:
      r.match_details?.reference_match ??
      r.match_details?.referenceMatch ??
      true,
    details: r.match_details?.details ?? null,
  },
  confidence: (r.confidence || r.Confidence || "medium").toLowerCase(),
}));

const rapprochementIdMap = {};
rapprochements.forEach((r, i) => {
  rapprochementIdMap[r.id] = r.id;
});

// ---------- 3) Completeness (attendu vs reçu) ----------
const docTypesExpected = {
  sondage_ca: ["fec", "facture_vente", "bon_livraison", "contrat", "annexe"],
  cutoff: ["fec", "facture_vente", "facture_achat", "bon_livraison", "contrat"],
  pointage: ["bilan", "compte_resultat", "annexe", "fec"],
};
const requiredByType = {
  sondage_ca: {
    fec: true,
    facture_vente: true,
    bon_livraison: true,
    contrat: false,
    annexe: false,
  },
  cutoff: {
    fec: true,
    facture_vente: true,
    facture_achat: true,
    bon_livraison: true,
    contrat: false,
  },
  pointage: { bilan: true, compte_resultat: true, annexe: true, fec: false },
};
const labels = {
  fec: "Fichier des Écritures Comptables (FEC)",
  facture_vente: "Factures de vente",
  facture_achat: "Factures fournisseurs",
  bon_livraison: "Bons de livraison",
  contrat: "Contrats",
  annexe: "Annexe aux comptes annuels",
  bilan: "Bilan",
  compte_resultat: "Compte de résultat",
};
const typesForScenario =
  docTypesExpected[scenario] || docTypesExpected.sondage_ca;
const required = requiredByType[scenario] || requiredByType.sondage_ca;
const byType = {};
(documentsList || []).forEach((d) => {
  const t = (d.type || d.doc_type || "").toLowerCase();
  if (!byType[t]) byType[t] = 0;
  byType[t]++;
});
const completeness = typesForScenario.map((type) => {
  const count = byType[type] || 0;
  let status = count > 0 ? "present" : required[type] ? "missing" : "present";
  if (type === "fec" && ecritures.length === 0 && count > 0)
    status = "incomplete";
  return {
    type,
    label: labels[type] || type,
    required: !!required[type],
    status,
    count,
    note:
      status === "missing" && required[type]
        ? "Document attendu non fourni."
        : undefined,
  };
});

// ---------- 4) Signaux (format N8NSignal) ----------
const signalTypeByRule = {
  "SCA-001": "absence_piece",
  "SCA-002": "incoherence_montant",
  "SCA-003": "incoherence_date",
  "SCA-004": "rupture_chaine",
  "SCA-005": "rattachement_temporel",
  "DOC-001": "absence_piece",
  "DOC-002": "incompletude",
};
const signals = signalsRaw.map((s, i) => {
  const rule = s.rule_triggered || s.ruleTriggered || s.rule || "SCA-001";
  const explicability = s.explicability || {
    reasoning: s.reasoning || s.description || "",
    documents_compared: s.documents_compared || [
      { document: s.source_document || "", element: "" },
    ],
    rule_source: s.rule_source || rule,
  };
  return {
    id: s.id || `sig-${analysis_id}-${i}`,
    document_id: s.document_id ?? null,
    ecriture_id: s.ecriture_id
      ? ecritureIdByIndex[s.ecriture_id] || s.ecriture_id
      : null,
    rapprochement_id: s.rapprochement_id
      ? rapprochementIdMap[s.rapprochement_id] || s.rapprochement_id
      : null,
    type: signalTypeByRule[rule] || "absence_piece",
    description:
      s.description ||
      "Signal documentaire à valider par le commissaire aux comptes.",
    source_document: s.source_document ?? null,
    source_page: s.source_page ?? null,
    source_extract: s.source_extract ?? null,
    rule_triggered: rule,
    rule_description: s.rule_description ?? null,
    priority: (s.priority || "medium").toLowerCase(),
    explicability,
  };
});

// ---------- 5) Livrables (stubs si non générés par le workflow) ----------
const now = new Date().toISOString();
const deliverables = (merged.deliverables || []).map((d, i) => ({
  id: d.id || `del-${i}`,
  type: d.type || "checklist",
  title: d.title || "Document",
  format: (d.format || "pdf").toLowerCase(),
  content_json: d.content_json || {},
  file_base64: d.file_base64 || "",
}));
if (deliverables.length === 0) {
  // Stubs minimaux pour que l’import ne plante pas (optionnel)
  deliverables.push(
    {
      id: "del-checklist",
      type: "checklist",
      title: "Check-list de complétude",
      format: "pdf",
      content_json: { completeness },
      file_base64: "",
    },
    {
      id: "del-signals",
      type: "signals_table",
      title: "Tableau des signaux",
      format: "xlsx",
      content_json: { signals: signals.length },
      file_base64: "",
    },
    {
      id: "del-synthesis",
      type: "synthesis",
      title: "Synthèse de pré-analyse",
      format: "pdf",
      content_json: {},
      file_base64: "",
    },
    {
      id: "del-traces",
      type: "trace_journal",
      title: "Journal de traçabilité",
      format: "pdf",
      content_json: {},
      file_base64: "",
    },
  );
}

// ---------- 6) Traces Sofia ----------
const traces = (merged.traces || []).map((t) => ({
  timestamp: t.timestamp || now,
  actor: "sofia",
  action: t.action || "step",
  details: t.details || "",
}));
if (traces.length === 0) {
  traces.push(
    {
      timestamp: now,
      actor: "sofia",
      action: "parsing_fec",
      details: `Fichier FEC analysé : ${ecritures.length} écritures.`,
    },
    {
      timestamp: now,
      actor: "sofia",
      action: "signals_detected",
      details: `${signals.length} signal(s) documentaire(s) détecté(s). À valider par le CAC.`,
    },
    {
      timestamp: now,
      actor: "sofia",
      action: "analysis_completed",
      details: "Pré-analyse documentaire terminée.",
    },
  );
}

// ---------- Payload final ----------
const results_payload = {
  analysis_id,
  mission_id,
  completed_at: now,
  completeness,
  ecritures,
  rapprochements,
  signals,
  deliverables,
  traces,
};

return [{ json: { results_payload, analysis_id, mission_id } }];
```

- En sortie du nœud, l’item contient `results_payload` (objet complet) et `analysis_id`, `mission_id` pour le nœud Supabase suivant.

---

## 4. Mise à jour de `n8n_analysis_state` (Supabase)

Après **Build Sofia Payload**, ajouter un nœud qui met à jour la ligne d’analyse :

- **Table** : `n8n_analysis_state`
- **Opération** : Update (PATCH).
- **Filtre** : `analysis_id` = `{{ $json.analysis_id }}`
- **Champs à mettre à jour** :
  - `results_payload` = `{{ $json.results_payload }}`
  - `status` = `completed`
  - `current_step` = 6
  - `current_step_key` = `completed`
  - `progress_percent` = 100
  - `progress_message` = `Pré-analyse terminée.`

(Variables selon le nom de votre nœud ; en N8N on utilise souvent `$json.results_payload` depuis l’item précédent.)

---

## 5. WF-08 (Results Retrieval)

- **Entrée** : paramètre d’URL `analysis_id` (ou équivalent).
- **Comportement** :
  - Lire la ligne `n8n_analysis_state` où `analysis_id` = paramètre.
  - Renvoyer en JSON le champ `results_payload` (et éventuellement `analysis_id`, `mission_id` pour cohérence).

Next.js appelle `GET /missions/analyze/:id/results` et utilise ce JSON pour `importResultsToSupabase` ; les types attendus sont ceux de `lib/n8n/types.ts` (`N8NResultsPayload`, `N8NEcriture`, `N8NSignal`, etc.).

---

## 6. Alignement avec Code4 (signaux)

Pour que **Build Sofia Payload** fonctionne sans changement :

- Code4 doit produire un tableau **`signals`** où chaque élément contient au minimum :
  - `rule_triggered` (ex. `SCA-001`, `SCA-002`) ou `rule` ;
  - `description` ;
  - `priority` : `high` | `medium` | `low` ;
  - `source_document`, `source_page`, `source_extract` si disponibles ;
  - `explicability` ou champs séparés (`reasoning`, `documents_compared`, `rule_source`) ;
  - optionnel : `ecriture_id`, `document_id`, `rapprochement_id` (références aux id générés dans ce payload).

- Code4 doit produire un tableau **`rapprochements`** où chaque élément contient :
  - `ecriture_id` (ou `ecriture_index` pour mapper vers `ecritures[i].id`) ;
  - `document_id` (UUID document Supabase si disponible) ;
  - `match_type`, `match_details`, `confidence`.

Si vos noms de champs diffèrent (ex. `signaux`, `matches`), adaptez dans **Build Sofia Payload** les lignes `merged.signals`, `merged.rapprochements` et les propriétés lues sur chaque élément.

---

## 7. Résumé

| Élément                 | Rôle                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **Ecritures Keeper**    | Garde la sortie FEC (`ecritures`) pour le Merge.                                                        |
| **Merge**               | Combine Ecritures Keeper + Code4 en un seul item.                                                       |
| **Build Sofia Payload** | Construit `N8NResultsPayload` (completeness, ecritures, rapprochements, signals, deliverables, traces). |
| **Supabase Update**     | Enregistre `results_payload` dans `n8n_analysis_state` et met `status = completed`.                     |
| **WF-08**               | Retourne `results_payload` pour `GET /results`.                                                         |

Après ces ajouts, le workflow Sondage produit un payload compatible avec `importResultsToSupabase` et le parcours mission → analyse → import dans Supabase fonctionne de bout en bout.
