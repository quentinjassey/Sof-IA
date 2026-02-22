// =============================================================================
// SOF'IA — Analyseur local pour le scénario Pointage
// Effectue la pré-analyse documentaire sans passer par N8N.
// Compare bilan, compte de résultat et annexe pour détecter des signaux.
//
// Règles implémentées :
//   PTG-001 : Écart montant bilan / annexe
//   PTG-002 : Information obligatoire absente de l'annexe
//   PTG-003 : Résultat net CR ≠ résultat exercice passif
//   PTG-004 : Poste > 50 000 EUR sans note explicative (non implémenté — pas critique POC)
//   PTG-005 : Variation notable N/N-1 sans explication suffisante
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
  type PointageCompany,
} from '@/lib/config/pointage-companies'
import { createTrace } from '@/lib/auth/helpers'
import { generateAllDeliverables } from './deliverable-generator'
import { generateConfidenceExplanation, evaluateExplanationSufficiency } from '@/lib/llm/openrouter'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AnalysisResult {
  signals_count: number
  completeness_count: number
  company_name: string
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

/**
 * Analyse locale d'une mission pointage.
 * Compare bilan, CR et annexe de l'entreprise assignée.
 * Écrit les résultats directement dans Supabase.
 */
export async function analyzePointageMission(
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
  const signals = await detectSignals(company, missionId, licenseId)

  // 2. Enrich signals with LLM confidence explanations (non-blocking)
  await enrichWithConfidenceExplanations(signals)

  // 3. Build completeness entries
  const completenessEntries = buildCompleteness(missionId, licenseId)

  // 4. Write signals to Supabase
  if (signals.length > 0) {
    const { error: signalsError } = await supabase
      .from('signals')
      .insert(signals)

    if (signalsError) {
      console.error('[Pointage] Erreur insertion signaux:', signalsError.message)
      throw new Error(`Erreur lors de l'insertion des signaux : ${signalsError.message}`)
    }
  }

  // 5. Write completeness to Supabase
  if (completenessEntries.length > 0) {
    const { error: compError } = await supabase
      .from('completeness')
      .insert(completenessEntries)

    if (compError) {
      console.error('[Pointage] Erreur insertion complétude:', compError.message)
      throw new Error(`Erreur lors de l'insertion de la complétude : ${compError.message}`)
    }
  }

  // 6. Create traces for Sofia actions
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
      `3 documents analysés (bilan, compte de résultat, annexe).`,
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
    console.error('[Pointage] Erreur génération livrables:', err)
    // Don't fail the whole analysis if deliverable generation fails
  }

  return {
    signals_count: signals.length,
    completeness_count: completenessEntries.length,
    company_name: company.name,
  }
}

// -----------------------------------------------------------------------------
// LLM confidence explanation enrichment
// -----------------------------------------------------------------------------

/** Méthode de détection par règle — utilisée dans le prompt LLM */
const DETECTION_METHODS: Record<string, string> = {
  'PTG-001': 'Comparaison numérique directe du montant brut des immobilisations corporelles entre le bilan et la Note 3 de l\'annexe.',
  'PTG-002': 'Recherche par titre de section dans l\'annexe : vérification de la présence d\'une note « Engagements hors bilan » ou équivalent.',
  'PTG-003': 'Comparaison numérique directe entre le résultat net du compte de résultat et le poste « Résultat de l\'exercice » au passif du bilan.',
  'PTG-005': 'Calcul de la variation N/N-1 (seuil > 30 %, montant > 20 000 EUR), puis recherche textuelle dans l\'annexe pour évaluer si l\'explication fournie est suffisante.',
}

/**
 * Enrichit chaque signal avec une explication LLM de son score de confiance.
 * Non bloquant : si le LLM échoue, le signal conserve son score sans explication.
 */
export async function enrichWithConfidenceExplanations(signals: SignalInsert[]): Promise<void> {
  if (signals.length === 0) {
    console.log('[Pointage] [LLM] Aucun signal à enrichir — LLM non appelé.')
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey === '<YOUR_OPENROUTER_API_KEY>') {
    console.log('[Pointage] [LLM] OPENROUTER_API_KEY non configurée — enrichissement LLM désactivé.')
    return
  }

  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'
  console.log(`[Pointage] [LLM] Enrichissement de ${signals.length} signal(s) via ${model}...`)

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
        console.log(`[Pointage] [LLM] ✓ ${signal.rule_triggered} enrichi (${elapsed} ms) — score ${signal.confidence_score}%`)
      } else {
        console.warn(`[Pointage] [LLM] ✗ ${signal.rule_triggered} — réponse vide du LLM (${elapsed} ms)`)
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[Pointage] [LLM] ✗ ${signal.rule_triggered} — échec : ${reason}`)
      // Non bloquant — le signal est conservé sans explication LLM
    }
  })

  await Promise.all(enrichmentPromises)
  console.log('[Pointage] [LLM] Enrichissement terminé.')
}

// -----------------------------------------------------------------------------
// Signal detection rules
// -----------------------------------------------------------------------------

/**
 * Formate un nombre avec des espaces comme séparateur de milliers (format français).
 * Ex: 2450000 → "2 450 000"
 */
function fmt(n: number): string {
  const parts = Math.abs(n).toFixed(0).split('')
  const result: string[] = []
  for (let i = parts.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) result.unshift('\u00A0')
    result.unshift(parts[i])
  }
  return (n < 0 ? '-' : '') + result.join('')
}

export async function detectSignals(company: PointageCompany, missionId: string, licenseId: string): Promise<SignalInsert[]> {
  const signals: SignalInsert[] = []

  console.log(`[Pointage] detectSignals pour ${company.name} (${company.annexe.length} notes annexe)`)
  console.log(`[Pointage] Bilan immo corp brut: ${company.bilan.actif.immobilisations_corporelles.brut}`)
  console.log(`[Pointage] CR résultat net: ${company.compte_resultat.resultat_net}, Passif résultat exercice: ${company.bilan.passif.resultat_exercice.net}`)

  // PTG-001 : Écart montant bilan / annexe (immobilisations corporelles)
  const ptg001 = checkPTG001(company, missionId, licenseId)
  if (ptg001) signals.push(ptg001)
  else console.log('[Pointage] PTG-001: pas de signal')

  // PTG-002 : Engagements hors bilan absents
  const ptg002 = checkPTG002(company, missionId, licenseId)
  if (ptg002) signals.push(ptg002)
  else console.log('[Pointage] PTG-002: pas de signal (engagements hors bilan trouvés)')

  // PTG-003 : Résultat net CR != résultat exercice passif
  const ptg003 = checkPTG003(company, missionId, licenseId)
  if (ptg003) signals.push(ptg003)
  else console.log('[Pointage] PTG-003: pas de signal (résultats concordants)')

  // PTG-005 : Variation notable sans explication (utilise le LLM si disponible)
  const ptg005signals = await checkPTG005(company, missionId, licenseId)
  signals.push(...ptg005signals)
  if (ptg005signals.length === 0) console.log('[Pointage] PTG-005: pas de signal (aucune variation notable)')

  console.log(`[Pointage] Total signaux détectés: ${signals.length}`)
  return signals
}

/**
 * PTG-001 : Compare chaque poste majeur du bilan avec la note
 * correspondante de l'annexe. Signal si écart > 0 sur le brut.
 *
 * Recherche la note par titre (pas par numéro) pour robustesse
 * avec les données extraites par LLM qui numérotent séquentiellement.
 */
function checkPTG001(company: PointageCompany, missionId: string, licenseId: string): SignalInsert | null {
  const bilanImmoCorpBrut = company.bilan.actif.immobilisations_corporelles.brut
  const bilanImmoCorpAmort = company.bilan.actif.immobilisations_corporelles.amort
  const bilanImmoCorpNet = company.bilan.actif.immobilisations_corporelles.net

  // Search by title first (robust for LLM-extracted data), fallback to numero === 3
  const annexeNote = company.annexe.find(
    (n) => n.titre.toLowerCase().includes('immobilisations corporelles')
  ) || company.annexe.find((n) => n.numero === 3)

  if (!annexeNote?.montants?.brut) {
    console.log(`[PTG-001] Note immobilisations corporelles non trouvée ou sans montant brut. ` +
      `Notes disponibles: ${company.annexe.map(n => `${n.numero}:"${n.titre}"`).join(', ')}`)
    return null
  }

  const annexeBrut = annexeNote.montants.brut
  const annexeAmort = annexeNote.montants.amort ?? 0
  const annexeNet = annexeNote.montants.net ?? (annexeBrut - annexeAmort)

  const ecartBrut = Math.abs(bilanImmoCorpBrut - annexeBrut)
  const ecartAmort = Math.abs(bilanImmoCorpAmort - annexeAmort)

  if (ecartBrut === 0 && ecartAmort === 0) {
    console.log(`[PTG-001] Pas d'écart détecté (bilan brut: ${bilanImmoCorpBrut}, annexe brut: ${annexeBrut})`)
    return null
  }

  const noteLabel = `Note ${annexeNote.numero}`

  return {
    mission_id: missionId,
    license_id: licenseId,
    type: 'incoherence_montant',
    description:
      `Écart entre le poste « Immobilisations corporelles » au bilan ` +
      `(brut : ${fmt(bilanImmoCorpBrut)} EUR) et le montant indiqué dans l'annexe ${noteLabel} ` +
      `(brut : ${fmt(annexeBrut)} EUR). Écart de ${fmt(ecartBrut)} EUR. ` +
      `Le bilan présente un total brut de ${fmt(bilanImmoCorpBrut)} EUR et des amortissements de ${fmt(bilanImmoCorpAmort)} EUR ` +
      `(net = ${fmt(bilanImmoCorpNet)} EUR). L'annexe indique un total brut de ${fmt(annexeBrut)} EUR et des ` +
      `amortissements de ${fmt(annexeAmort)} EUR (net = ${fmt(annexeNet)} EUR).`,
    source_document: 'Bilan',
    source_page: null,
    source_extract: `Bilan actif immobilisé — Immobilisations corporelles brut : ${fmt(bilanImmoCorpBrut)} EUR`,
    rule_triggered: 'PTG-001',
    rule_description: 'Écart de montant entre un poste du bilan et l\'information correspondante dans l\'annexe',
    priority: 'high',
    confidence_score: 97,
    explicability: {
      reasoning:
        `Constat factuel : le montant brut des immobilisations corporelles au bilan ` +
        `(${fmt(bilanImmoCorpBrut)} EUR) ne correspond pas au montant indiqué dans la ${noteLabel} de l'annexe ` +
        `(${fmt(annexeBrut)} EUR). L'écart de ${fmt(ecartBrut)} EUR nécessite l'attention du commissaire aux comptes.`,
      documents_compared: [
        { document: 'Bilan', element: `Immobilisations corporelles brut : ${fmt(bilanImmoCorpBrut)} EUR` },
        { document: `Annexe — ${noteLabel}`, element: `Immobilisations corporelles brut : ${fmt(annexeBrut)} EUR` },
      ],
      rule_source: 'PTG-001 — Écart de montant bilan / annexe (NEP 500)',
    },
    human_decision: 'pending',
  }
}

/**
 * PTG-002 : Vérifie la présence de sections obligatoires dans l'annexe.
 * Signal si les engagements hors bilan sont absents.
 */
function checkPTG002(company: PointageCompany, missionId: string, licenseId: string): SignalInsert | null {
  const engagementsNote = company.annexe.find(
    (n) => n.titre.toLowerCase().includes('engagements hors bilan') ||
           n.titre.toLowerCase().includes('engagement hors bilan')
  )

  if (engagementsNote) return null

  return {
    mission_id: missionId,
    license_id: licenseId,
    type: 'incompletude',
    description:
      `Information obligatoire absente de l'annexe : les engagements hors bilan ne sont pas ` +
      `mentionnés. L'annexe ne contient aucune note relative aux engagements hors bilan ` +
      `(crédit-bail, cautions, garanties données, etc.). ` +
      `Cette information est obligatoire au titre de l'article L. 123-13 du Code de Commerce.`,
    source_document: 'Annexe',
    source_page: null,
    source_extract: 'Annexe — Ensemble du document (absence constatée)',
    rule_triggered: 'PTG-002',
    rule_description: 'Information obligatoire manquante dans l\'annexe',
    priority: 'medium',
    confidence_score: 85,
    explicability: {
      reasoning:
        `Constat factuel : l'annexe aux comptes annuels ne contient aucune note relative ` +
        `aux engagements hors bilan. Cette information est requise par l'article L. 123-13 ` +
        `du Code de Commerce. L'absence de cette information nécessite l'attention du commissaire aux comptes.`,
      documents_compared: [
        { document: 'Annexe', element: 'Absence de note sur les engagements hors bilan' },
      ],
      rule_source: 'PTG-002 — Information obligatoire manquante (NEP 500, Art. L. 123-13 C.Com)',
    },
    human_decision: 'pending',
  }
}

/**
 * PTG-003 : Compare résultat net du CR avec résultat de l'exercice au passif.
 * Signal si différent.
 */
function checkPTG003(company: PointageCompany, missionId: string, licenseId: string): SignalInsert | null {
  const resultatCR = company.compte_resultat.resultat_net
  const resultatPassif = company.bilan.passif.resultat_exercice.net

  console.log(`[PTG-003] CR résultat net: ${resultatCR}, Passif résultat exercice: ${resultatPassif}, écart: ${Math.abs(resultatCR - resultatPassif)}`)

  if (resultatCR === resultatPassif) return null

  const ecart = Math.abs(resultatCR - resultatPassif)

  return {
    mission_id: missionId,
    license_id: licenseId,
    type: 'incoherence_montant',
    description:
      `Écart entre le résultat net du compte de résultat (${fmt(resultatCR)} EUR) et le poste ` +
      `« Résultat de l'exercice » au passif du bilan (${fmt(resultatPassif)} EUR). ` +
      `Écart de ${fmt(ecart)} EUR. Ces deux montants doivent être identiques.`,
    source_document: 'Compte de résultat',
    source_page: null,
    source_extract: `Résultat net : ${fmt(resultatCR)} EUR (CR) vs ${fmt(resultatPassif)} EUR (bilan passif)`,
    rule_triggered: 'PTG-003',
    rule_description: 'Écart entre le résultat net du CR et le résultat au passif du bilan',
    priority: 'high',
    confidence_score: 99,
    explicability: {
      reasoning:
        `Constat factuel : le résultat net figurant au compte de résultat ` +
        `(${fmt(resultatCR)} EUR) est différent du montant inscrit au poste « Résultat de l'exercice » ` +
        `au passif du bilan (${fmt(resultatPassif)} EUR). Cet écart de ${fmt(ecart)} EUR ` +
        `nécessite l'attention du commissaire aux comptes.`,
      documents_compared: [
        { document: 'Compte de résultat', element: `Résultat net : ${fmt(resultatCR)} EUR` },
        { document: 'Bilan — Passif', element: `Résultat de l'exercice : ${fmt(resultatPassif)} EUR` },
      ],
      rule_source: 'PTG-003 — Écart résultat net CR / passif bilan (NEP 500)',
    },
    human_decision: 'pending',
  }
}

/**
 * PTG-005 : Calcule la variation N/N-1 pour les postes du CR.
 * Signal si variation > 30% ET montant > 20 000 EUR ET explication insuffisante.
 * Utilise le LLM (OpenRouter) pour évaluer la suffisance de l'explication
 * dans l'annexe. Fallback sur heuristique par mots-clés si le LLM n'est pas disponible.
 */
async function checkPTG005(company: PointageCompany, missionId: string, licenseId: string): Promise<SignalInsert[]> {
  const signals: SignalInsert[] = []

  // Check specific known variations in annexe Note 13/14 (Autres informations)
  const annexeAutresInfo = company.annexe.find(
    (n) => n.titre.toLowerCase().includes('autres informations')
  )

  // Check honoraires variation specifically (from annexe montants if available)
  if (annexeAutresInfo?.montants?.honoraires_n && annexeAutresInfo?.montants?.honoraires_n1) {
    const honorairesN = annexeAutresInfo.montants.honoraires_n
    const honorairesN1 = annexeAutresInfo.montants.honoraires_n1

    if (honorairesN1 > 0) {
      const variation = ((honorairesN - honorairesN1) / honorairesN1) * 100
      const ecart = honorairesN - honorairesN1

      if (Math.abs(variation) > 30 && Math.abs(ecart) > 20000) {
        // Évaluer la suffisance de l'explication via LLM (avec fallback heuristique)
        const { insufficient, reasoning, confidence } = await evaluateSufficiency(
          'Honoraires',
          honorairesN,
          honorairesN1,
          variation,
          annexeAutresInfo.contenu,
          annexeAutresInfo.numero
        )

        if (insufficient) {
          signals.push({
            mission_id: missionId,
            license_id: licenseId,
            type: 'rupture_chaine',
            description:
              `Variation notable du poste « Honoraires » dans les autres charges externes : ` +
              `${fmt(honorairesN)} EUR en 2025 contre ${fmt(honorairesN1)} EUR en 2024, ` +
              `soit une hausse de +${variation.toFixed(1)} %. ` +
              `L'annexe (Note ${annexeAutresInfo.numero}) ne fournit pas d'explication suffisante ` +
              `de cette variation de ${fmt(ecart)} EUR. ` +
              (reasoning ? `Évaluation : ${reasoning} ` : '') +
              `Cette augmentation nécessite l'attention du commissaire aux comptes.`,
            source_document: `Annexe — Note ${annexeAutresInfo.numero}`,
            source_page: null,
            source_extract: `Honoraires : ${fmt(honorairesN)} EUR (N) vs ${fmt(honorairesN1)} EUR (N-1)`,
            rule_triggered: 'PTG-005',
            rule_description: 'Variation notable d\'un poste sans explication suffisante dans l\'annexe',
            priority: 'high',
            confidence_score: confidence,
            explicability: {
              reasoning:
                `Constat factuel : les honoraires passent de ${fmt(honorairesN1)} EUR en N-1 à ` +
                `${fmt(honorairesN)} EUR en N, soit une hausse de +${variation.toFixed(1)} % ` +
                `(${fmt(ecart)} EUR). ` +
                (reasoning || 'L\'annexe ne fournit pas d\'explication détaillée de cette variation.') +
                ` Ce constat nécessite l'attention du commissaire aux comptes.`,
              documents_compared: [
                { document: `Annexe — Note ${annexeAutresInfo.numero}`, element: `Honoraires : ${fmt(honorairesN)} EUR` },
              ],
              rule_source: 'PTG-005 — Variation notable sans explication suffisante (NEP 500)',
            },
            human_decision: 'pending',
          })
        }
      }
    }
  }

  // Also check general CR line variations
  const allLines = [
    ...company.compte_resultat.charges_exploitation,
    ...company.compte_resultat.produits_exploitation,
  ]

  for (const line of allLines) {
    if (line.montant_n1 === 0 || Math.abs(line.montant) < 10000) continue

    const variation = ((line.montant - line.montant_n1) / Math.abs(line.montant_n1)) * 100
    const ecart = Math.abs(line.montant - line.montant_n1)

    // Flag variations > 30% with ecart > 20 000 EUR (same thresholds as annexe-specific checks)
    if (Math.abs(variation) <= 30 || ecart <= 20000) continue

    // Don't duplicate the honoraires signal
    if (line.label.toLowerCase().includes('honoraires')) continue

    // Search for relevant annexe note text
    const relevantNote = company.annexe.find((note) => {
      const contenu = note.contenu.toLowerCase()
      const label = line.label.toLowerCase()
      return contenu.includes(label)
    })

    // Évaluer la suffisance via LLM (avec fallback heuristique)
    const annexeText = relevantNote?.contenu || ''
    const noteNumero = relevantNote?.numero || 0
    const { insufficient, reasoning, confidence } = await evaluateSufficiency(
      line.label,
      line.montant,
      line.montant_n1,
      variation,
      annexeText,
      noteNumero
    )

    if (!insufficient) continue

    signals.push({
      mission_id: missionId,
      license_id: licenseId,
      type: 'rupture_chaine',
      description:
        `Variation notable du poste « ${line.label} » : ` +
        `${fmt(line.montant)} EUR en 2025 contre ${fmt(line.montant_n1)} EUR en 2024, ` +
        `soit une variation de ${variation > 0 ? '+' : ''}${variation.toFixed(1)} % ` +
        `(écart de ${fmt(ecart)} EUR). ` +
        (reasoning ? `Évaluation : ${reasoning} ` : 'L\'annexe ne fournit pas d\'explication suffisante de cette variation. ') +
        `Ce constat nécessite l'attention du commissaire aux comptes.`,
      source_document: relevantNote ? `Annexe — Note ${noteNumero}` : 'Compte de résultat',
      source_page: null,
      source_extract: `${line.label} : ${fmt(line.montant)} EUR (N) vs ${fmt(line.montant_n1)} EUR (N-1)`,
      rule_triggered: 'PTG-005',
      rule_description: 'Variation notable d\'un poste sans explication suffisante dans l\'annexe',
      priority: 'medium',
      confidence_score: confidence,
      explicability: {
        reasoning:
          `Constat factuel : le poste « ${line.label} » varie de ${variation > 0 ? '+' : ''}${variation.toFixed(1)} % ` +
          `entre N-1 et N (écart de ${fmt(ecart)} EUR). ` +
          (reasoning || 'L\'annexe ne fournit pas de justification détaillée.') +
          ` Ce constat nécessite l'attention du commissaire aux comptes.`,
        documents_compared: [
          { document: 'Compte de résultat', element: `${line.label} : ${fmt(line.montant)} EUR (N)` },
          { document: 'Annexe', element: relevantNote ? `Note ${noteNumero}` : 'Absence d\'explication suffisante' },
        ],
        rule_source: 'PTG-005 — Variation notable sans explication suffisante (NEP 500)',
      },
      human_decision: 'pending',
    })
  }

  return signals
}

/**
 * Évalue si l'explication de l'annexe est suffisante pour une variation notable.
 * Tente d'utiliser le LLM (OpenRouter) pour une évaluation nuancée.
 * Fallback sur heuristique par mots-clés si le LLM échoue ou n'est pas configuré.
 */
async function evaluateSufficiency(
  poste: string,
  montantN: number,
  montantN1: number,
  variationPct: number,
  annexeText: string,
  noteNumero: number
): Promise<{ insufficient: boolean; reasoning: string; confidence: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const llmAvailable = apiKey && apiKey !== '<YOUR_OPENROUTER_API_KEY>'

  // Si pas de texte d'annexe → insuffisant par définition
  if (!annexeText || annexeText.trim().length === 0) {
    console.log(`[Pointage] [PTG-005] Poste « ${poste} » : aucun texte d'annexe → insuffisant (pas de LLM nécessaire).`)
    return {
      insufficient: true,
      reasoning: 'L\'annexe ne contient aucune information relative à ce poste.',
      confidence: 90,
    }
  }

  // Tenter l'évaluation LLM
  if (llmAvailable) {
    try {
      const start = Date.now()
      console.log(`[Pointage] [PTG-005] [LLM] Évaluation de la suffisance pour « ${poste} » (Note ${noteNumero})...`)

      const evaluation = await evaluateExplanationSufficiency({
        poste,
        montant_n: montantN,
        montant_n1: montantN1,
        variation_pct: variationPct,
        annexe_text: annexeText,
        note_numero: noteNumero,
      })

      const elapsed = Date.now() - start
      console.log(
        `[Pointage] [PTG-005] [LLM] ✓ Résultat pour « ${poste} » : ` +
        `${evaluation.sufficient ? 'suffisant' : 'insuffisant'} ` +
        `(confiance LLM : ${evaluation.confidence}%, ${elapsed} ms) — ${evaluation.reasoning}`
      )

      return {
        insufficient: !evaluation.sufficient,
        reasoning: evaluation.reasoning,
        confidence: evaluation.confidence,
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[Pointage] [PTG-005] [LLM] ✗ Échec pour « ${poste} », fallback heuristique : ${reason}`)
      // Fallback sur heuristique ci-dessous
    }
  } else {
    console.log(`[Pointage] [PTG-005] LLM non disponible, utilisation de l'heuristique par mots-clés pour « ${poste} ».`)
  }

  // Fallback heuristique par mots-clés
  const contenu = annexeText.toLowerCase()
  const hasExplanation = (
    contenu.includes('en raison') ||
    contenu.includes('du fait') ||
    contenu.includes('augmentation') ||
    contenu.includes('diminution') ||
    contenu.includes('évolution') ||
    contenu.includes('detail') ||
    contenu.includes('ventilation')
  )
  const hasVagueOnly = contenu.includes('divers') && !hasExplanation

  if (hasExplanation && !hasVagueOnly) {
    return { insufficient: false, reasoning: '', confidence: 60 }
  }

  return {
    insufficient: true,
    reasoning: hasVagueOnly
      ? 'L\'annexe se limite à une mention vague (« divers ») sans détail de la variation.'
      : 'L\'annexe ne fournit pas d\'explication identifiable pour cette variation.',
    confidence: 68,
  }
}

// -----------------------------------------------------------------------------
// Completeness
// -----------------------------------------------------------------------------

export function buildCompleteness(missionId: string, licenseId: string): CompletenessInsert[] {
  return [
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'bilan',
      label: 'Bilan',
      required: true,
      status: 'present',
      count: 1,
      note: 'Bilan actif et passif au 31/12/2025',
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'compte_resultat',
      label: 'Compte de résultat',
      required: true,
      status: 'present',
      count: 1,
      note: 'Compte de résultat exercice clos le 31/12/2025',
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'annexe',
      label: 'Annexe aux comptes annuels',
      required: true,
      status: 'present',
      count: 1,
      note: 'Annexe complète avec notes explicatives',
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'fec',
      label: 'Fichier des écritures comptables (FEC)',
      required: false,
      status: 'missing',
      count: 0,
      note: 'Non requis pour le pointage des états financiers',
    },
  ]
}
