// =============================================================================
// SOF'IA — Analyseur local pour le scénario Cut-Off (séparation des exercices)
// Effectue la pré-analyse documentaire sans passer par N8N.
// Compare FEC, factures et bons de livraison/réception pour détecter
// les signaux de cut-off autour de la date de clôture (31/12/2025).
//
// Règles implémentées :
//   CUT-001 : Facture avant clôture, livraison après clôture
//   CUT-002 : Facture après clôture, livraison/réception avant clôture (FNP)
//   CUT-003 : Écart de dates important dans la fenêtre de cut-off
//   CUT-004 : Opération sans justificatif de date de livraison
//   CUT-005 : Avoir en N+1 annulant une vente de N
//
// VOCABULAIRE OBLIGATOIRE :
// - « signal documentaire » (jamais « anomalie »)
// - « constat factuel » (jamais « conclusion »)
// - « nécessite l'attention du CAC » (jamais « significatif »)
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js'
import type { SignalInsert, CompletenessInsert } from '@/types/database'
import {
  getCompanyWithDiscrepancies,
  type CutoffCompany,
  type CutoffInvoice,
  type DeliveryNote,
  type FecEntry,
} from '@/lib/config/cutoff-companies'
import { createTrace } from '@/lib/auth/helpers'
import { generateAllDeliverables } from './deliverable-generator'
import { generateConfidenceExplanation } from '@/lib/llm/openrouter'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AnalysisResult {
  signals_count: number
  completeness_count: number
  company_name: string
}

/**
 * Jeu de documents parsés — compatible avec les données fictives et réelles.
 * Les fonctions de détection acceptent cette interface.
 */
export interface CutoffDocumentSet {
  name: string
  fec_entries: FecEntry[]
  invoices: CutoffInvoice[]
  delivery_notes: DeliveryNote[]
  cutoff_window_days: number
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const CLOSING_DATE = '2025-12-31'
const NEXT_YEAR_START = '2026-01-01'

/** Formate un nombre avec des espaces comme séparateur de milliers. */
function fmt(n: number): string {
  const parts = Math.abs(n).toFixed(0).split('')
  const result: string[] = []
  for (let i = parts.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) result.unshift('\u00A0')
    result.unshift(parts[i])
  }
  return (n < 0 ? '-' : '') + result.join('')
}

/** Calcule l'écart en jours entre deux dates YYYY-MM-DD. */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.round(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

/** Convertit YYYY-MM-DD en DD/MM/YYYY. */
function fmtDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

/** Méthode de détection par règle — utilisée dans le prompt LLM */
const DETECTION_METHODS: Record<string, string> = {
  'CUT-001': 'Rapprochement chronologique : comparaison de la date de la facture (avant clôture) avec la date du bon de livraison (après clôture).',
  'CUT-002': 'Rapprochement chronologique inversé : facture datée après clôture alors que le bon de réception est daté avant clôture (schéma FNP).',
  'CUT-003': 'Calcul de l\'écart en jours entre la date de facturation et la date de livraison/réception dans la fenêtre de cut-off.',
  'CUT-004': 'Recherche d\'un bon de livraison ou de réception associé pour chaque facture dans la fenêtre de cut-off.',
  'CUT-005': 'Identification des factures d\'avoir datées de N+1 référençant une facture de vente de N.',
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

/**
 * Analyse locale d'une mission cut-off.
 * Compare FEC, factures et BL/BR de l'entreprise assignée.
 * Écrit les résultats directement dans Supabase.
 */
export async function analyzeCutoffMission(
  supabase: SupabaseClient,
  missionId: string,
  licenseId: string,
  companyId: string
): Promise<AnalysisResult> {
  const company = getCompanyWithDiscrepancies(companyId, missionId)
  if (!company) {
    throw new Error(`Entreprise introuvable : ${companyId}`)
  }

  // 1. Detect signals
  const signals = detectSignals(company, missionId, licenseId)

  // 2. Enrich signals with LLM confidence explanations (non-blocking)
  await enrichWithConfidenceExplanations(signals)

  // 3. Build completeness entries
  const completenessEntries = buildCompleteness(company, missionId, licenseId)

  // 4. Write signals to Supabase
  if (signals.length > 0) {
    const { error: signalsError } = await supabase
      .from('signals')
      .insert(signals)

    if (signalsError) {
      console.error('[Cutoff] Erreur insertion signaux:', signalsError.message)
      throw new Error(`Erreur lors de l'insertion des signaux : ${signalsError.message}`)
    }
  }

  // 5. Write completeness to Supabase
  if (completenessEntries.length > 0) {
    const { error: compError } = await supabase
      .from('completeness')
      .insert(completenessEntries)

    if (compError) {
      console.error('[Cutoff] Erreur insertion complétude:', compError.message)
      throw new Error(`Erreur lors de l'insertion de la complétude : ${compError.message}`)
    }
  }

  // 6. Create traces for Sofia actions
  const docCount = company.invoices.length + company.delivery_notes.length + 1 // +1 for FEC
  await createTrace({
    mission_id: missionId,
    license_id: licenseId,
    actor: 'sofia',
    actor_name: 'Sof\'IA',
    action: 'analysis_completed',
    target_type: 'mission',
    target_id: missionId,
    details: `Pré-analyse documentaire terminée pour ${company.name}. ` +
      `${signals.length} signal(s) documentaire(s) détecté(s). ` +
      `${docCount} documents analysés (FEC, ${company.invoices.length} factures, ${company.delivery_notes.length} bons de livraison/réception).`,
  })

  if (signals.length > 0) {
    await createTrace({
      mission_id: missionId,
      license_id: licenseId,
      actor: 'sofia',
      actor_name: 'Sof\'IA',
      action: 'signals_generated',
      target_type: 'mission',
      target_id: missionId,
      details: `${signals.length} signal(s) documentaire(s) généré(s) : ` +
        signals.map((s) => s.rule_triggered).join(', '),
    })
  }

  // 7. Update mission status to 'analyzed'
  await supabase
    .from('missions')
    .update({
      status: 'analyzed',
      analysis_id: missionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', missionId)

  // 8. Generate deliverables
  try {
    await generateAllDeliverables(supabase, missionId, licenseId)

    await createTrace({
      mission_id: missionId,
      license_id: licenseId,
      actor: 'sofia',
      actor_name: 'Sof\'IA',
      action: 'deliverables_generated',
      target_type: 'mission',
      target_id: missionId,
      details: '4 livrables générés : check-list, tableau des signaux, synthèse, journal de traçabilité.',
    })
  } catch (err) {
    console.error('[Cutoff] Erreur génération livrables:', err)
    // Don't fail the whole analysis if deliverable generation fails
  }

  return {
    signals_count: signals.length,
    completeness_count: completenessEntries.length,
    company_name: company.name,
  }
}

// -----------------------------------------------------------------------------
// Real document analysis entry point
// -----------------------------------------------------------------------------

/**
 * Analyse une mission cut-off à partir de documents réels uploadés.
 * Télécharge et parse les documents depuis Supabase Storage,
 * puis applique les mêmes règles CUT-001 à CUT-005.
 */
export async function analyzeCutoffFromDocuments(
  supabase: SupabaseClient,
  missionId: string,
  licenseId: string
): Promise<AnalysisResult> {
  // Dynamic import to avoid circular dependency at module load time
  const { fetchAndParseAllCutoffDocuments } = await import('./cutoff-document-parser')

  console.log(`[Cutoff] Parsing real documents for mission ${missionId.slice(0, 8)}...`)
  const parsed = await fetchAndParseAllCutoffDocuments(supabase, missionId)

  const docSet: CutoffDocumentSet = {
    name: parsed.companyName || 'Entreprise (documents uploadés)',
    fec_entries: parsed.fecEntries,
    invoices: parsed.invoices,
    delivery_notes: parsed.deliveryNotes,
    cutoff_window_days: 10,
  }

  console.log(
    `[Cutoff] Documents parsés : ${docSet.fec_entries.length} écritures FEC, ` +
    `${docSet.invoices.length} factures, ${docSet.delivery_notes.length} BL/BR`
  )

  // 1. Detect signals using parsed data
  const signals = detectSignals(docSet, missionId, licenseId)

  // 2. Enrich signals with LLM confidence explanations (non-blocking)
  await enrichWithConfidenceExplanations(signals)

  // 3. Build completeness entries
  const completenessEntries = buildCompleteness(docSet, missionId, licenseId)

  // 4. Write signals to Supabase
  if (signals.length > 0) {
    const { error: signalsError } = await supabase
      .from('signals')
      .insert(signals)

    if (signalsError) {
      console.error('[Cutoff] Erreur insertion signaux:', signalsError.message)
      throw new Error(`Erreur lors de l'insertion des signaux : ${signalsError.message}`)
    }
  }

  // 5. Write completeness to Supabase
  if (completenessEntries.length > 0) {
    const { error: compError } = await supabase
      .from('completeness')
      .insert(completenessEntries)

    if (compError) {
      console.error('[Cutoff] Erreur insertion complétude:', compError.message)
      throw new Error(`Erreur lors de l'insertion de la complétude : ${compError.message}`)
    }
  }

  // 6. Create traces for Sofia actions
  const docCount = docSet.invoices.length + docSet.delivery_notes.length + 1 // +1 for FEC
  await createTrace({
    mission_id: missionId,
    license_id: licenseId,
    actor: 'sofia',
    actor_name: 'Sof\'IA',
    action: 'analysis_completed',
    target_type: 'mission',
    target_id: missionId,
    details: `Pré-analyse documentaire terminée pour ${docSet.name} (documents réels). ` +
      `${signals.length} signal(s) documentaire(s) détecté(s). ` +
      `${docCount} documents analysés (FEC, ${docSet.invoices.length} factures, ${docSet.delivery_notes.length} bons de livraison/réception).`,
  })

  if (signals.length > 0) {
    await createTrace({
      mission_id: missionId,
      license_id: licenseId,
      actor: 'sofia',
      actor_name: 'Sof\'IA',
      action: 'signals_generated',
      target_type: 'mission',
      target_id: missionId,
      details: `${signals.length} signal(s) documentaire(s) généré(s) : ` +
        signals.map((s) => s.rule_triggered).join(', '),
    })
  }

  // 7. Update mission status to 'analyzed'
  await supabase
    .from('missions')
    .update({
      status: 'analyzed',
      analysis_id: missionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', missionId)

  // 8. Generate deliverables
  try {
    await generateAllDeliverables(supabase, missionId, licenseId)

    await createTrace({
      mission_id: missionId,
      license_id: licenseId,
      actor: 'sofia',
      actor_name: 'Sof\'IA',
      action: 'deliverables_generated',
      target_type: 'mission',
      target_id: missionId,
      details: '4 livrables générés : check-list, tableau des signaux, synthèse, journal de traçabilité.',
    })
  } catch (err) {
    console.error('[Cutoff] Erreur génération livrables:', err)
  }

  return {
    signals_count: signals.length,
    completeness_count: completenessEntries.length,
    company_name: docSet.name,
  }
}

// -----------------------------------------------------------------------------
// LLM confidence explanation enrichment
// -----------------------------------------------------------------------------

/**
 * Enrichit chaque signal avec une explication LLM de son score de confiance.
 * Non bloquant : si le LLM échoue, le signal conserve son score sans explication.
 */
export async function enrichWithConfidenceExplanations(signals: SignalInsert[]): Promise<void> {
  if (signals.length === 0) {
    console.log('[Cutoff] [LLM] Aucun signal à enrichir — LLM non appelé.')
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey === '<YOUR_OPENROUTER_API_KEY>') {
    console.log('[Cutoff] [LLM] OPENROUTER_API_KEY non configurée — enrichissement LLM désactivé.')
    return
  }

  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'
  console.log(`[Cutoff] [LLM] Enrichissement de ${signals.length} signal(s) via ${model}...`)

  const enrichmentPromises = signals.map(async (signal) => {
    if (signal.confidence_score == null || !signal.rule_triggered) return

    try {
      const start = Date.now()
      const explanation = await generateConfidenceExplanation({
        rule_triggered: signal.rule_triggered,
        confidence_score: signal.confidence_score,
        description: signal.description,
        source_document: signal.source_document || 'Non précisé',
        detection_method: DETECTION_METHODS[signal.rule_triggered] || 'Analyse documentaire automatisée.',
      })

      const elapsed = Date.now() - start

      if (explanation) {
        signal.confidence_explanation = explanation
        console.log(`[Cutoff] [LLM] ✓ ${signal.rule_triggered} enrichi (${elapsed} ms) — score ${signal.confidence_score}%`)
      } else {
        console.warn(`[Cutoff] [LLM] ✗ ${signal.rule_triggered} — réponse vide du LLM (${elapsed} ms)`)
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[Cutoff] [LLM] ✗ ${signal.rule_triggered} — échec : ${reason}`)
    }
  })

  await Promise.all(enrichmentPromises)
  console.log('[Cutoff] [LLM] Enrichissement terminé.')
}

// -----------------------------------------------------------------------------
// Signal detection rules
// -----------------------------------------------------------------------------

/**
 * Détecte tous les signaux documentaires de cut-off pour un jeu de documents.
 * Accepte CutoffCompany (données fictives) ou CutoffDocumentSet (données réelles).
 */
export function detectSignals(company: CutoffDocumentSet, missionId: string, licenseId: string): SignalInsert[] {
  const signals: SignalInsert[] = []

  // CUT-001 : Facture de vente avant clôture, BL après clôture
  signals.push(...checkCUT001(company, missionId, licenseId))

  // CUT-002 : Facture d'achat après clôture, BR avant clôture (FNP)
  signals.push(...checkCUT002(company, missionId, licenseId))

  // CUT-003 : Écart de dates important dans la fenêtre de cut-off
  signals.push(...checkCUT003(company, missionId, licenseId))

  // CUT-004 : Opération sans justificatif de date de livraison
  signals.push(...checkCUT004(company, missionId, licenseId))

  // CUT-005 : Avoir en N+1 annulant une vente de N
  signals.push(...checkCUT005(company, missionId, licenseId))

  return signals
}

/**
 * CUT-001 : Pour chaque facture de vente datée <= 31/12 :
 * trouver le BL associé et vérifier si sa date est >= 01/01/N+1.
 */
function checkCUT001(company: CutoffDocumentSet, missionId: string, licenseId: string): SignalInsert[] {
  const signals: SignalInsert[] = []

  const salesBeforeClosing = company.invoices.filter(
    (inv) => inv.type === 'vente' && inv.date <= CLOSING_DATE && inv.linked_bl_ref
  )

  for (const invoice of salesBeforeClosing) {
    const bl = company.delivery_notes.find((dn) => dn.ref === invoice.linked_bl_ref)
    if (!bl) continue

    if (bl.date_delivery >= NEXT_YEAR_START) {
      const gap = daysBetween(invoice.date, bl.date_delivery)

      signals.push({
        mission_id: missionId,
        license_id: licenseId,
        type: 'rattachement_temporel',
        description:
          `Facture ${invoice.ref} datée du ${fmtDate(invoice.date)} (vente à ${invoice.client_or_supplier}, ` +
          `montant ${fmt(invoice.total_ht)} EUR HT) mais bon de livraison ${bl.ref} daté du ${fmtDate(bl.date_delivery)}. ` +
          `La facture est enregistrée avant la clôture de l'exercice alors que la livraison effective est constatée ` +
          `après la clôture. Le rattachement du produit à l'exercice 2025 nécessite l'attention du commissaire aux comptes.`,
        source_document: `Facture ${invoice.ref}`,
        source_page: null,
        source_extract: `Facture du ${fmtDate(invoice.date)} — BL du ${fmtDate(bl.date_delivery)} — Écart de ${gap} jours après clôture`,
        rule_triggered: 'CUT-001',
        rule_description: 'Facture avant clôture, livraison après clôture',
        priority: 'high',
        confidence_score: 95,
        explicability: {
          reasoning:
            `Constat factuel : la facture ${invoice.ref} est datée du ${fmtDate(invoice.date)} (avant la clôture du 31/12/2025) ` +
            `tandis que le bon de livraison ${bl.ref} est daté du ${fmtDate(bl.date_delivery)} (après la clôture). ` +
            `L'écart de ${gap} jours entre la facturation et la livraison, avec un franchissement de la date de clôture, ` +
            `nécessite l'attention du commissaire aux comptes pour vérifier le rattachement temporel du produit.`,
          documents_compared: [
            { document: `Facture ${invoice.ref}`, element: `Date : ${fmtDate(invoice.date)}, montant : ${fmt(invoice.total_ht)} EUR HT` },
            { document: `Bon de livraison ${bl.ref}`, element: `Date de livraison : ${fmtDate(bl.date_delivery)}` },
          ],
          rule_source: 'CUT-001 — Facture avant clôture, livraison après clôture (NEP 500, §A14)',
        },
        human_decision: 'pending',
      })
    }
  }

  return signals
}

/**
 * CUT-002 : Pour chaque facture d'achat datée >= 01/01/N+1 :
 * trouver le BR associé et vérifier si sa date est <= 31/12/N (schéma FNP).
 */
function checkCUT002(company: CutoffDocumentSet, missionId: string, licenseId: string): SignalInsert[] {
  const signals: SignalInsert[] = []

  const purchasesAfterClosing = company.invoices.filter(
    (inv) => inv.type === 'achat' && inv.date >= NEXT_YEAR_START && inv.linked_bl_ref
  )

  for (const invoice of purchasesAfterClosing) {
    const br = company.delivery_notes.find((dn) => dn.ref === invoice.linked_bl_ref)
    if (!br) continue

    if (br.date_delivery <= CLOSING_DATE) {
      const gap = daysBetween(br.date_delivery, invoice.date)

      signals.push({
        mission_id: missionId,
        license_id: licenseId,
        type: 'rattachement_temporel',
        description:
          `Facture fournisseur ${invoice.ref} datée du ${fmtDate(invoice.date)} (achat auprès de ${invoice.client_or_supplier}, ` +
          `montant ${fmt(invoice.total_ht)} EUR HT) mais bon de réception ${br.ref} daté du ${fmtDate(br.date_delivery)}. ` +
          `Les marchandises ont été réceptionnées avant la clôture de l'exercice mais la facture n'est parvenue qu'en N+1. ` +
          `Cette situation de charge à payer (FNP) nécessite l'attention du commissaire aux comptes.`,
        source_document: `Bon de réception ${br.ref}`,
        source_page: null,
        source_extract: `BR du ${fmtDate(br.date_delivery)} — Facture du ${fmtDate(invoice.date)} — Réception avant clôture, facturation après`,
        rule_triggered: 'CUT-002',
        rule_description: 'Facture après clôture, livraison/réception avant clôture (FNP)',
        priority: 'high',
        confidence_score: 93,
        explicability: {
          reasoning:
            `Constat factuel : le bon de réception ${br.ref} est daté du ${fmtDate(br.date_delivery)} (avant la clôture du 31/12/2025) ` +
            `tandis que la facture ${invoice.ref} est datée du ${fmtDate(invoice.date)} (après la clôture). ` +
            `L'écart de ${gap} jours entre la réception et la facturation, avec une réception en N et une facturation en N+1, ` +
            `constitue un schéma de facture non parvenue (FNP) nécessitant l'attention du commissaire aux comptes.`,
          documents_compared: [
            { document: `Facture ${invoice.ref}`, element: `Date : ${fmtDate(invoice.date)}, montant : ${fmt(invoice.total_ht)} EUR HT` },
            { document: `Bon de réception ${br.ref}`, element: `Date de réception : ${fmtDate(br.date_delivery)}` },
          ],
          rule_source: 'CUT-002 — Facture après clôture, réception avant clôture / FNP (NEP 500, §A14)',
        },
        human_decision: 'pending',
      })
    }
  }

  return signals
}

/**
 * CUT-003 : Pour les opérations dans la fenêtre de cut-off (±10 jours du 31/12) :
 * si l'écart entre date facture et date BL > cutoff_window_days.
 * Exclut les cas déjà couverts par CUT-001 et CUT-002.
 */
function checkCUT003(company: CutoffDocumentSet, missionId: string, licenseId: string): SignalInsert[] {
  const signals: SignalInsert[] = []
  const windowDays = company.cutoff_window_days || 10

  // Define cutoff window
  const windowStart = '2025-12-21' // 31/12 - 10 days
  const windowEnd = '2026-01-10'   // 31/12 + 10 days

  const invoicesInWindow = company.invoices.filter(
    (inv) => (inv.type === 'vente' || inv.type === 'achat') &&
             inv.date >= windowStart && inv.date <= windowEnd &&
             inv.linked_bl_ref
  )

  for (const invoice of invoicesInWindow) {
    const bl = company.delivery_notes.find((dn) => dn.ref === invoice.linked_bl_ref)
    if (!bl) continue

    const gap = daysBetween(invoice.date, bl.date_delivery)

    // Only flag if gap exceeds the window AND it's not already a CUT-001/CUT-002 case
    const isCUT001 = invoice.type === 'vente' && invoice.date <= CLOSING_DATE && bl.date_delivery >= NEXT_YEAR_START
    const isCUT002 = invoice.type === 'achat' && invoice.date >= NEXT_YEAR_START && bl.date_delivery <= CLOSING_DATE

    if (gap > windowDays && !isCUT001 && !isCUT002) {
      const isVente = invoice.type === 'vente'
      const blLabel = isVente ? 'bon de livraison' : 'bon de réception'

      signals.push({
        mission_id: missionId,
        license_id: licenseId,
        type: 'incoherence_date',
        description:
          `Écart de ${gap} jours entre la facture ${invoice.ref} (${fmtDate(invoice.date)}) et le ${blLabel} ${bl.ref} ` +
          `(${fmtDate(bl.date_delivery)}) pour une opération de ${fmt(invoice.total_ht)} EUR HT avec ${invoice.client_or_supplier}. ` +
          `Cet écart, supérieur à la fenêtre de cut-off de ${windowDays} jours, nécessite l'attention du commissaire aux comptes ` +
          `pour vérifier le rattachement de l'opération à l'exercice.`,
        source_document: `Facture ${invoice.ref}`,
        source_page: null,
        source_extract: `Facture du ${fmtDate(invoice.date)} — ${blLabel.charAt(0).toUpperCase() + blLabel.slice(1)} du ${fmtDate(bl.date_delivery)} — Écart de ${gap} jours`,
        rule_triggered: 'CUT-003',
        rule_description: 'Écart de dates en période de clôture',
        priority: 'medium',
        confidence_score: 80,
        explicability: {
          reasoning:
            `Constat factuel : un écart de ${gap} jours est constaté entre la facture ${invoice.ref} et le ${blLabel} ${bl.ref}. ` +
            `Cet écart dépasse la fenêtre de cut-off paramétrée à ${windowDays} jours. ` +
            `Ce constat nécessite l'attention du commissaire aux comptes.`,
          documents_compared: [
            { document: `Facture ${invoice.ref}`, element: `Date : ${fmtDate(invoice.date)}, montant : ${fmt(invoice.total_ht)} EUR HT` },
            { document: `${blLabel.charAt(0).toUpperCase() + blLabel.slice(1)} ${bl.ref}`, element: `Date : ${fmtDate(bl.date_delivery)}` },
          ],
          rule_source: 'CUT-003 — Écart de dates en période de clôture (NEP 500)',
        },
        human_decision: 'pending',
      })
    }
  }

  return signals
}

/**
 * CUT-004 : Pour chaque facture de vente/achat dans la fenêtre de cut-off
 * sans BL/BR associé, signaler l'absence de justificatif.
 */
function checkCUT004(company: CutoffDocumentSet, missionId: string, licenseId: string): SignalInsert[] {
  const signals: SignalInsert[] = []

  // Fenêtre de cut-off: derniers jours de l'exercice
  const windowStart = '2025-12-21'

  const invoicesWithoutBL = company.invoices.filter(
    (inv) => (inv.type === 'vente' || inv.type === 'achat') &&
             inv.date >= windowStart && inv.date <= CLOSING_DATE &&
             !inv.linked_bl_ref
  )

  for (const invoice of invoicesWithoutBL) {
    const isVente = invoice.type === 'vente'
    const blLabel = isVente ? 'bon de livraison' : 'bon de réception'

    signals.push({
      mission_id: missionId,
      license_id: licenseId,
      type: 'absence_piece',
      description:
        `Facture ${invoice.ref} datée du ${fmtDate(invoice.date)} (${isVente ? 'vente à' : 'achat auprès de'} ${invoice.client_or_supplier}, ` +
        `montant ${fmt(invoice.total_ht)} EUR HT) sans ${blLabel} associé. ` +
        `En l'absence de preuve de ${isVente ? 'livraison' : 'réception'}, il n'est pas possible de vérifier ` +
        `la date effective de transfert de propriété et le rattachement ` +
        `du ${isVente ? 'produit' : 'de la charge'} à l'exercice 2025. ` +
        `Cette situation nécessite l'attention du commissaire aux comptes.`,
      source_document: `Facture ${invoice.ref}`,
      source_page: null,
      source_extract: `Facture du ${fmtDate(invoice.date)}, ${fmt(invoice.total_ht)} EUR HT — Aucun ${blLabel} retrouvé`,
      rule_triggered: 'CUT-004',
      rule_description: 'Opération sans justificatif de date de livraison',
      priority: 'high',
      confidence_score: 90,
      explicability: {
        reasoning:
          `Constat factuel : la facture ${invoice.ref} datée du ${fmtDate(invoice.date)} ` +
          `(${fmt(invoice.total_ht)} EUR HT) ne dispose d'aucun ${blLabel} permettant d'établir ` +
          `la date effective de ${isVente ? 'livraison' : 'réception'}. ` +
          `Sans ce justificatif, le rattachement temporel de l'opération ne peut être vérifié. ` +
          `Ce constat nécessite l'attention du commissaire aux comptes.`,
        documents_compared: [
          { document: `Facture ${invoice.ref}`, element: `Date : ${fmtDate(invoice.date)}, montant : ${fmt(invoice.total_ht)} EUR HT` },
        ],
        rule_source: 'CUT-004 — Opération sans justificatif de date de livraison (NEP 500)',
      },
      human_decision: 'pending',
    })
  }

  return signals
}

/**
 * CUT-005 : Recherche des factures d'avoir datées de N+1 dont la référence
 * renvoie à une facture de vente de N. Compare les montants.
 */
function checkCUT005(company: CutoffDocumentSet, missionId: string, licenseId: string): SignalInsert[] {
  const signals: SignalInsert[] = []

  const avoirs = company.invoices.filter(
    (inv) => inv.type === 'avoir' && inv.date >= NEXT_YEAR_START && inv.linked_invoice
  )

  for (const avoir of avoirs) {
    // Find the original sale invoice
    const originalInvoice = company.invoices.find(
      (inv) => inv.ref === avoir.linked_invoice && inv.type === 'vente' && inv.date <= CLOSING_DATE
    )

    if (!originalInvoice) continue

    const cancelPercent = Math.round((avoir.total_ht / originalInvoice.total_ht) * 100)

    signals.push({
      mission_id: missionId,
      license_id: licenseId,
      type: 'incoherence_montant',
      description:
        `Avoir ${avoir.ref} daté du ${fmtDate(avoir.date)} annulant ${cancelPercent} % de la facture ${originalInvoice.ref} ` +
        `(vente du ${fmtDate(originalInvoice.date)} à ${originalInvoice.client_or_supplier}). ` +
        `Montant de l'avoir : ${fmt(avoir.total_ht)} EUR HT sur un total initial de ${fmt(originalInvoice.total_ht)} EUR HT. ` +
        `L'émission d'un avoir en début N+1 pour une vente de fin N ` +
        `nécessite l'attention du commissaire aux comptes quant au rattachement du produit à l'exercice.`,
      source_document: `Avoir ${avoir.ref}`,
      source_page: null,
      source_extract: `Avoir du ${fmtDate(avoir.date)} — ${fmt(avoir.total_ht)} EUR HT — Référence : ${avoir.linked_invoice} du ${fmtDate(originalInvoice.date)}`,
      rule_triggered: 'CUT-005',
      rule_description: 'Avoir en N+1 annulant une vente de N',
      priority: 'medium',
      confidence_score: 88,
      explicability: {
        reasoning:
          `Constat factuel : l'avoir ${avoir.ref} daté du ${fmtDate(avoir.date)} annule ${cancelPercent} % ` +
          `de la facture ${originalInvoice.ref} du ${fmtDate(originalInvoice.date)} ` +
          `(${fmt(avoir.total_ht)} EUR HT sur ${fmt(originalInvoice.total_ht)} EUR HT). ` +
          `L'émission d'un avoir en N+1 pour une vente enregistrée en N peut remettre en question ` +
          `le rattachement du produit initial. Ce constat nécessite l'attention du commissaire aux comptes.`,
        documents_compared: [
          { document: `Avoir ${avoir.ref}`, element: `Date : ${fmtDate(avoir.date)}, montant : ${fmt(avoir.total_ht)} EUR HT` },
          { document: `Facture ${originalInvoice.ref}`, element: `Date : ${fmtDate(originalInvoice.date)}, montant : ${fmt(originalInvoice.total_ht)} EUR HT` },
        ],
        rule_source: 'CUT-005 — Avoir en N+1 annulant une vente de N (NEP 500)',
      },
      human_decision: 'pending',
    })
  }

  return signals
}

// -----------------------------------------------------------------------------
// Completeness
// -----------------------------------------------------------------------------

function buildCompleteness(company: CutoffDocumentSet, missionId: string, licenseId: string): CompletenessInsert[] {
  const saleInvoices = company.invoices.filter((inv) => inv.type === 'vente')
  const purchaseInvoices = company.invoices.filter((inv) => inv.type === 'achat')
  const avoirs = company.invoices.filter((inv) => inv.type === 'avoir')
  const bls = company.delivery_notes.filter((dn) => dn.type === 'livraison')
  const brs = company.delivery_notes.filter((dn) => dn.type === 'reception')

  return [
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'fec',
      label: 'Fichier des écritures comptables (FEC)',
      required: true,
      status: 'present',
      count: 1,
      note: `FEC contenant ${company.fec_entries.length} lignes d'écritures — Exercice clos le 31/12/2025`,
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'facture_vente',
      label: 'Factures de vente',
      required: true,
      status: saleInvoices.length > 0 ? 'present' : 'missing',
      count: saleInvoices.length,
      note: saleInvoices.length > 0
        ? `${saleInvoices.length} facture(s) de vente autour de la date de clôture`
        : 'Aucune facture de vente fournie',
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'facture_achat',
      label: 'Factures fournisseurs',
      required: true,
      status: purchaseInvoices.length > 0 ? 'present' : 'missing',
      count: purchaseInvoices.length,
      note: purchaseInvoices.length > 0
        ? `${purchaseInvoices.length} facture(s) fournisseur(s) autour de la date de clôture`
        : 'Aucune facture fournisseur fournie',
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'bon_livraison',
      label: 'Bons de livraison',
      required: true,
      status: bls.length > 0 ? 'present' : 'missing',
      count: bls.length,
      note: bls.length > 0
        ? `${bls.length} bon(s) de livraison fourni(s)`
        : 'Aucun bon de livraison fourni',
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'bon_livraison',
      label: 'Bons de réception',
      required: true,
      status: brs.length > 0 ? 'present' : 'missing',
      count: brs.length,
      note: brs.length > 0
        ? `${brs.length} bon(s) de réception fourni(s)`
        : 'Aucun bon de réception fourni',
    },
    ...(avoirs.length > 0
      ? [
          {
            mission_id: missionId,
            license_id: licenseId,
            doc_type: 'facture_vente',
            label: 'Avoirs',
            required: false,
            status: 'present' as const,
            count: avoirs.length,
            note: `${avoirs.length} avoir(s) identifié(s) en début N+1`,
          },
        ]
      : []),
  ]
}
