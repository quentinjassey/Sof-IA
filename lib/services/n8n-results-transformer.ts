// =============================================================================
// SOF'IA — N8N Results Transformer
// Transforms the consolidation output from the N8N Sondage workflow into
// the structured format needed for Supabase table imports.
//
// The N8N Sondage workflow produces:
//   - consolidation: { contexte_fec, echantillonnage, resultats, par_regle, anomalies, pieces_ok, items_complets }
//   - synthesis: LLM-generated narrative text
//
// This transformer converts that into:
//   - signals[] for the signals table
//   - ecritures[] for the ecritures table (sampled entries only)
//   - rapprochements[] for the rapprochements table
//   - completeness[] for the completeness table
//   - traces[] for audit trail
// =============================================================================

import type { SignalPriority } from '@/types/database'

// -----------------------------------------------------------------------------
// Input types (from N8N consolidation output)
// -----------------------------------------------------------------------------

interface N8NSignalEntry {
  rule: string
  severity: string
  message: string
}

interface N8NFactureData {
  type_document: string
  piece_ref: string | null
  date_document: string | null
  date_livraison: string | null
  emetteur: { nom: string | null } | null
  destinataire: { nom: string | null } | null
  montant_ht: number | null
  montant_tva: number | null
  montant_ttc: number | null
  lignes: Array<{ description: string | null; quantite: number | null }> | null
  confidence: number | null
}

interface N8NItemComplet {
  piece_ref: string
  libelle: string
  montant_fec: number
  date_ecriture: string | null
  facture_trouvee: boolean
  bl_trouve: boolean
  nb_signaux: number
  signaux: N8NSignalEntry[]
  facture: N8NFactureData | null
  bl: N8NFactureData | null
}

interface N8NContexteFec {
  total_lignes: number
  ca_total: number
  vt_pieces_uniques: number
  periode_debut: string | null
  periode_fin: string | null
  journaux: Record<string, { count: number; debit: number; credit: number }>
}

interface N8NEchantillonnage {
  methode: string
  pieces_testees: number
  montant_total_teste: number
  couverture_ca_pct: number | null
}

interface N8NResultats {
  pieces_ok: number
  pieces_avec_signaux: number
  total_signaux: number
  montant_anomalies: number
  taux_anomalie_montant: number
}

export interface N8NConsolidation {
  contexte_fec: N8NContexteFec
  echantillonnage: N8NEchantillonnage
  resultats: N8NResultats
  par_regle: Record<string, Array<{
    piece_ref: string
    libelle: string
    montant_fec: number
    message: string
    severity: string
  }>>
  anomalies: N8NItemComplet[]
  pieces_ok: Array<{ piece_ref: string; libelle: string; montant_fec: number }>
  items_complets: N8NItemComplet[]
}

export interface N8NResults {
  consolidation: N8NConsolidation
  synthesis: string
}

// -----------------------------------------------------------------------------
// Output types (for Supabase import)
// -----------------------------------------------------------------------------

export interface TransformedSignal {
  type: string
  description: string
  source_document: string | null
  source_page: number | null
  source_extract: string | null
  rule_triggered: string
  rule_description: string | null
  priority: SignalPriority
  explicability: Record<string, unknown> | null
  confidence_score: number | null
}

export interface TransformedEcriture {
  journal_code: string
  ecriture_date: string | null
  compte_num: string
  piece_ref: string | null
  ecriture_lib: string | null
  debit: number
  credit: number
}

export interface TransformedRapprochement {
  piece_ref: string
  match_type: 'exact' | 'partial' | 'missing'
  match_details: Record<string, unknown>
  confidence: 'high' | 'medium' | 'low'
}

export interface TransformedCompleteness {
  doc_type: string
  label: string
  required: boolean
  status: 'present' | 'missing' | 'incomplete'
  count: number
  note: string | null
}

export interface TransformResult {
  signals: TransformedSignal[]
  ecritures: TransformedEcriture[]
  rapprochements: TransformedRapprochement[]
  completeness: TransformedCompleteness[]
  synthesis: string
  summary: {
    total_ecritures_fec: number
    pieces_testees: number
    signals_count: number
    ca_total: number
    couverture_pct: number | null
    methode_echantillonnage: string
  }
}

// -----------------------------------------------------------------------------
// Signal rule mapping
// -----------------------------------------------------------------------------

const RULE_TO_SIGNAL_TYPE: Record<string, string> = {
  'SCA-001': 'absence_piece',
  'SCA-002': 'incoherence_montant',
  'SCA-003': 'incoherence_date',
  'SCA-004': 'rupture_chaine',
  'SCA-005': 'rattachement_temporel',
}

const RULE_DESCRIPTIONS: Record<string, string> = {
  'SCA-001': 'Bon de livraison absent pour une vente — Facture presente sans bon de livraison associe (NEP 500)',
  'SCA-002': 'Ecart de montant entre facture et ecriture FEC — Ecart superieur a 1% (NEP 500)',
  'SCA-003': 'Ecart de date entre facture et bon de livraison — Ecart superieur a 5 jours',
  'SCA-004': 'Reference de piece FEC introuvable — Aucun justificatif pour cette ecriture (NEP 500)',
  'SCA-005': 'Rattachement temporel a verifier — Livraison datee de l\'exercice suivant (NEP 230)',
}

const SEVERITY_TO_PRIORITY: Record<string, SignalPriority> = {
  'high': 'high',
  'medium': 'medium',
  'low': 'low',
}

// -----------------------------------------------------------------------------
// Transformer
// -----------------------------------------------------------------------------

export function transformN8NResults(results: N8NResults): TransformResult {
  const { consolidation, synthesis } = results
  const items = consolidation.items_complets || []

  // Transform signals
  const signals: TransformedSignal[] = []
  for (const item of items) {
    if (!item.signaux || item.signaux.length === 0) continue

    for (const signal of item.signaux) {
      const ruleId = signal.rule || 'SCA-000'
      const signalType = RULE_TO_SIGNAL_TYPE[ruleId] || 'incompletude'
      const priority = SEVERITY_TO_PRIORITY[signal.severity] || 'medium'

      const sourceDocParts: string[] = []
      if (item.facture_trouvee) sourceDocParts.push(`Facture ${item.piece_ref}`)
      if (item.bl_trouve) sourceDocParts.push(`BL ${item.piece_ref}`)
      sourceDocParts.push(`FEC (piece_ref: ${item.piece_ref})`)

      const explicability: Record<string, unknown> = {
        reasoning: signal.message,
        compared_documents: sourceDocParts,
        rule_source: ruleId,
        factual_observation: signal.message,
        montant_fec: item.montant_fec,
        date_ecriture: item.date_ecriture,
      }

      if (item.facture) {
        explicability.facture = {
          montant_ttc: item.facture.montant_ttc,
          date: item.facture.date_document,
          emetteur: item.facture.emetteur?.nom,
        }
      }
      if (item.bl) {
        explicability.bon_livraison = {
          date_livraison: item.bl.date_livraison,
          date_document: item.bl.date_document,
        }
      }

      let confidenceScore: number | null = null
      if (item.facture?.confidence != null) {
        confidenceScore = Math.round(item.facture.confidence * 100)
      }

      signals.push({
        type: signalType,
        description: `${signal.message} — Piece ${item.piece_ref} (${item.libelle}), montant FEC: ${item.montant_fec.toFixed(2)} EUR`,
        source_document: sourceDocParts[0] || null,
        source_page: 1,
        source_extract: signal.message,
        rule_triggered: ruleId,
        rule_description: RULE_DESCRIPTIONS[ruleId] || signal.message,
        priority,
        explicability,
        confidence_score: confidenceScore,
      })
    }
  }

  // Transform ecritures (sampled entries from FEC)
  const ecritures: TransformedEcriture[] = items.map((item) => ({
    journal_code: 'VT',
    ecriture_date: item.date_ecriture,
    compte_num: '411000',
    piece_ref: item.piece_ref,
    ecriture_lib: item.libelle,
    debit: item.montant_fec,
    credit: 0,
  }))

  // Transform rapprochements
  const rapprochements: TransformedRapprochement[] = items.map((item) => {
    let matchType: 'exact' | 'partial' | 'missing' = 'exact'
    let confidence: 'high' | 'medium' | 'low' = 'high'

    if (!item.facture_trouvee && !item.bl_trouve) {
      matchType = 'missing'
      confidence = 'low'
    } else if (!item.bl_trouve || !item.facture_trouvee) {
      matchType = 'partial'
      confidence = 'medium'
    } else if (item.nb_signaux > 0) {
      matchType = 'partial'
      confidence = 'medium'
    }

    return {
      piece_ref: item.piece_ref,
      match_type: matchType,
      match_details: {
        facture_trouvee: item.facture_trouvee,
        bl_trouve: item.bl_trouve,
        montant_fec: item.montant_fec,
        montant_facture_ttc: item.facture?.montant_ttc ?? null,
        date_ecriture: item.date_ecriture,
        date_facture: item.facture?.date_document ?? null,
        date_livraison: item.bl?.date_livraison ?? null,
        nb_signaux: item.nb_signaux,
      },
      confidence,
    }
  })

  // Transform completeness
  const completeness: TransformedCompleteness[] = buildCompleteness(consolidation, items)

  // Build summary
  const summary = {
    total_ecritures_fec: consolidation.contexte_fec?.total_lignes || 0,
    pieces_testees: consolidation.echantillonnage?.pieces_testees || 0,
    signals_count: consolidation.resultats?.total_signaux || 0,
    ca_total: consolidation.contexte_fec?.ca_total || 0,
    couverture_pct: consolidation.echantillonnage?.couverture_ca_pct || null,
    methode_echantillonnage: consolidation.echantillonnage?.methode || 'Sondage',
  }

  return { signals, ecritures, rapprochements, completeness, synthesis, summary }
}

function buildCompleteness(
  consolidation: N8NConsolidation,
  items: N8NItemComplet[]
): TransformedCompleteness[] {
  const result: TransformedCompleteness[] = []

  // FEC
  result.push({
    doc_type: 'fec',
    label: 'Fichier des Ecritures Comptables (FEC)',
    required: true,
    status: 'present',
    count: 1,
    note: `${consolidation.contexte_fec?.total_lignes || 0} lignes, CA total: ${(consolidation.contexte_fec?.ca_total || 0).toLocaleString('fr-FR')} EUR`,
  })

  // Factures
  const facturesPresentes = items.filter((i) => i.facture_trouvee).length
  const facturesAttendues = items.length
  result.push({
    doc_type: 'facture_vente',
    label: 'Factures de vente',
    required: true,
    status: facturesPresentes === facturesAttendues ? 'present' : facturesPresentes > 0 ? 'incomplete' : 'missing',
    count: facturesPresentes,
    note: `${facturesPresentes}/${facturesAttendues} factures retrouvees dans l'echantillon`,
  })

  // Bons de livraison
  const blPresents = items.filter((i) => i.bl_trouve).length
  result.push({
    doc_type: 'bon_livraison',
    label: 'Bons de livraison',
    required: true,
    status: blPresents === facturesAttendues ? 'present' : blPresents > 0 ? 'incomplete' : 'missing',
    count: blPresents,
    note: `${blPresents}/${facturesAttendues} BL retrouves dans l'echantillon`,
  })

  return result
}
