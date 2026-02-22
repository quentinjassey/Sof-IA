// =============================================================================
// SOF'IA — Analyseur pointage pour vrais PDFs
// Orchestrateur du flow "vrais documents" :
//   1. Télécharger + extraire le texte des PDFs
//   2. Détecter si PDF combiné ou séparés
//   3. Appeler le LLM extractor pour structurer les données
//   4. Appliquer les règles PTG (réutilise pointage-analyzer.ts)
//   5. Écrire signaux + complétude + traces dans Supabase
//   6. Générer les livrables
//
// VOCABULAIRE OBLIGATOIRE :
// - « signal documentaire » (jamais « anomalie »)
// - « constat factuel » (jamais « conclusion »)
// - « nécessite l'attention du CAC » (jamais « significatif »)
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js'
import type { SignalInsert, CompletenessInsert } from '@/types/database'
import { createTrace } from '@/lib/auth/helpers'
import { generateAllDeliverables } from './deliverable-generator'
import {
  extractAllMissionPdfs,
  splitCombinedFinancialStatements,
  type ExtractedPdf,
} from './pdf-text-extractor'
import { extractPointageCompanyFromPdfs } from './pointage-llm-extractor'
import {
  detectSignals,
  enrichWithConfidenceExplanations,
} from './pointage-analyzer'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RealAnalysisResult {
  signals_count: number
  completeness_count: number
  company_name: string
}

// Demo filename patterns — used to distinguish demo docs from real uploads
const DEMO_FILENAME_PATTERNS = [
  /^bilan_[a-z_]+_\d{4}\.pdf$/i,
  /^compte_resultat_[a-z_]+_\d{4}\.pdf$/i,
  /^annexe_[a-z_]+_\d{4}\.pdf$/i,
  /^comptes_annuels_[a-z_]+_\d{4}\.pdf$/i,
]

// -----------------------------------------------------------------------------
// Detection: real PDFs vs demo
// -----------------------------------------------------------------------------

/**
 * Vérifie si les documents d'une mission sont de vrais PDFs (vs docs démo).
 * Heuristique : les docs démo suivent le pattern `bilan_{company_id}_2025.pdf`.
 */
export async function hasRealPdfUploads(
  supabase: SupabaseClient,
  missionId: string
): Promise<boolean> {
  const { data: documents } = await supabase
    .from('documents')
    .select('filename')
    .eq('mission_id', missionId)

  if (!documents || documents.length === 0) return false

  const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']

  // If at least one document is an image or a non-demo PDF, it's a real upload
  return documents.some((doc) => {
    const filename = doc.filename.toLowerCase()
    const isImage = IMAGE_EXTENSIONS.some(ext => filename.endsWith(ext))
    const isNonDemoPdf = filename.endsWith('.pdf') &&
      !DEMO_FILENAME_PATTERNS.some((pattern) => pattern.test(filename))
    return isImage || isNonDemoPdf
  })
}

// -----------------------------------------------------------------------------
// PDF classification: separate vs combined
// -----------------------------------------------------------------------------

interface ClassifiedPdfs {
  bilanText: string
  crText: string
  annexeText: string
  allText: string
  isCombined: boolean
}

/**
 * Classifie les PDFs extraits : séparés (3 fichiers) ou combiné (1 fichier).
 */
function classifyPdfs(pdfs: ExtractedPdf[]): ClassifiedPdfs {
  const allText = pdfs.map((p) => p.text).join('\n\n--- DOCUMENT SUIVANT ---\n\n')

  // Try to identify separate documents by filename
  const bilanPdf = pdfs.find((p) =>
    /bilan/i.test(p.filename) && !/annexe/i.test(p.filename) && !/resultat/i.test(p.filename)
  )
  const crPdf = pdfs.find((p) =>
    /r[eé]sultat|compte.*r[eé]sultat|cr[_\s]/i.test(p.filename)
  )
  const annexePdf = pdfs.find((p) =>
    /annexe/i.test(p.filename)
  )

  // Case 1: 3 separate PDFs clearly identified
  if (bilanPdf && crPdf && annexePdf) {
    console.log('[Real Analyzer] 3 PDFs séparés détectés (bilan, CR, annexe).')
    return {
      bilanText: bilanPdf.text,
      crText: crPdf.text,
      annexeText: annexePdf.text,
      allText,
      isCombined: false,
    }
  }

  // Case 2: Single PDF (combined) or unclear filenames
  if (pdfs.length === 1) {
    console.log('[Real Analyzer] PDF combiné détecté (1 seul fichier). Découpage par sections...')
    const sections = splitCombinedFinancialStatements(pdfs[0].text)
    return {
      bilanText: sections.bilan,
      crText: sections.compte_resultat,
      annexeText: sections.annexe,
      allText: pdfs[0].text,
      isCombined: true,
    }
  }

  // Case 3: Multiple PDFs but can't clearly identify roles
  // Try to split by content analysis
  console.log(`[Real Analyzer] ${pdfs.length} PDFs sans identification claire. Analyse du contenu...`)

  // Try content-based identification
  let bestBilan = pdfs[0]
  let bestCR = pdfs[0]
  let bestAnnexe = pdfs.length > 1 ? pdfs[pdfs.length - 1] : pdfs[0]

  for (const pdf of pdfs) {
    const text = pdf.text.slice(0, 2000).toLowerCase()
    if (text.includes('bilan') && text.includes('actif')) bestBilan = pdf
    if (text.includes('compte de résultat') || text.includes('compte de resultat')) bestCR = pdf
    if (text.includes('annexe') && (text.includes('notes') || text.includes('règles'))) bestAnnexe = pdf
  }

  // If we still have the same PDF for all three, treat as combined
  if (bestBilan === bestCR && bestCR === bestAnnexe) {
    console.log('[Real Analyzer] Pas de distinction claire — traitement comme PDF combiné.')
    const sections = splitCombinedFinancialStatements(allText)
    return {
      bilanText: sections.bilan,
      crText: sections.compte_resultat,
      annexeText: sections.annexe,
      allText,
      isCombined: true,
    }
  }

  return {
    bilanText: bestBilan.text,
    crText: bestCR.text,
    annexeText: bestAnnexe.text,
    allText,
    isCombined: false,
  }
}

// -----------------------------------------------------------------------------
// Build completeness for real PDFs
// -----------------------------------------------------------------------------

function buildRealCompleteness(
  missionId: string,
  licenseId: string,
  pdfs: ExtractedPdf[],
  classified: ClassifiedPdfs
): CompletenessInsert[] {
  const hasBilan = pdfs.some((p) => /bilan/i.test(p.filename)) || classified.bilanText.length > 200
  const hasCR = pdfs.some((p) => /r[eé]sultat/i.test(p.filename)) || classified.crText.length > 200
  const hasAnnexe = pdfs.some((p) => /annexe/i.test(p.filename)) || classified.annexeText.length > 200

  return [
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'bilan',
      label: 'Bilan',
      required: true,
      status: hasBilan ? 'present' : 'missing',
      count: hasBilan ? 1 : 0,
      note: hasBilan
        ? `Bilan actif et passif extrait des documents uploadés`
        : 'Bilan non identifié dans les documents uploadés',
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'compte_resultat',
      label: 'Compte de résultat',
      required: true,
      status: hasCR ? 'present' : 'missing',
      count: hasCR ? 1 : 0,
      note: hasCR
        ? `Compte de résultat extrait des documents uploadés`
        : 'Compte de résultat non identifié dans les documents uploadés',
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      doc_type: 'annexe',
      label: 'Annexe aux comptes annuels',
      required: true,
      status: hasAnnexe ? 'present' : 'missing',
      count: hasAnnexe ? 1 : 0,
      note: hasAnnexe
        ? `Annexe extraite des documents uploadés`
        : 'Annexe non identifiée dans les documents uploadés',
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

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

/**
 * Analyse de vrais PDFs de comptes annuels pour le scénario pointage.
 * Flow complet : extraction texte → LLM structuration → règles PTG → Supabase.
 */
export async function analyzePointageFromRealPdfs(
  supabase: SupabaseClient,
  missionId: string,
  licenseId: string,
  projectId?: string | null
): Promise<RealAnalysisResult> {
  console.log(`[Real Analyzer] Début de l'analyse pour mission ${missionId}`)

  // 1. Extract text from all PDFs
  const pdfs = await extractAllMissionPdfs(supabase, missionId, projectId)

  if (pdfs.length === 0) {
    throw new Error('Aucun PDF exploitable trouvé pour cette mission.')
  }

  // Check if we got meaningful text
  const totalTextLength = pdfs.reduce((sum, p) => sum + p.text.length, 0)
  if (totalTextLength < 100) {
    throw new Error(
      'Les documents uploades ne contiennent pas suffisamment de texte exploitable, ' +
      'meme apres tentative de reconnaissance optique (OCR). ' +
      'Verifiez la qualite des documents.'
    )
  }

  console.log(`[Real Analyzer] ${pdfs.length} PDF(s) extraits, ${totalTextLength} caractères au total.`)

  // 2. Classify and split PDFs
  const classified = classifyPdfs(pdfs)

  // 3. Create trace: extraction started
  const ocrCount = pdfs.filter(p => p.extractionMethod === 'vision_ocr' || p.extractionMethod === 'direct_image').length
  const traceDetails = `Texte extrait de ${pdfs.length} document(s) (${totalTextLength} caractères). ` +
    `Mode : ${classified.isCombined ? 'PDF combiné découpé en sections' : 'documents séparés'}.` +
    (ocrCount > 0 ? ` ${ocrCount} document(s) traité(s) par reconnaissance optique (OCR).` : '')

  await createTrace({
    mission_id: missionId,
    license_id: licenseId,
    actor: 'sofia',
    actor_name: 'Sof\'IA',
    action: 'pdf_extracted',
    target_type: 'mission',
    target_id: missionId,
    details: traceDetails,
  })

  // 4. Extract structured data via LLM
  let company
  try {
    company = await extractPointageCompanyFromPdfs(
      classified.bilanText,
      classified.crText,
      classified.annexeText,
      classified.allText
    )
    console.log(`[Real Analyzer] Données structurées extraites pour : ${company.name}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Real Analyzer] Erreur extraction LLM : ${msg}`)
    throw new Error(`Erreur lors de l'extraction des données par l'IA : ${msg}`)
  }

  // 5. Detect signals using existing PTG rules
  const signals = await detectSignals(company, missionId, licenseId)

  // 6. Enrich signals with confidence explanations
  await enrichWithConfidenceExplanations(signals)

  // 7. Build completeness entries
  const completenessEntries = buildRealCompleteness(missionId, licenseId, pdfs, classified)

  // 8. Write signals to Supabase
  if (signals.length > 0) {
    const { error: signalsError } = await supabase
      .from('signals')
      .insert(signals)

    if (signalsError) {
      console.error('[Real Analyzer] Erreur insertion signaux:', signalsError.message)
      throw new Error(`Erreur lors de l'insertion des signaux : ${signalsError.message}`)
    }
  }

  // 9. Write completeness to Supabase
  if (completenessEntries.length > 0) {
    const { error: compError } = await supabase
      .from('completeness')
      .insert(completenessEntries)

    if (compError) {
      console.error('[Real Analyzer] Erreur insertion complétude:', compError.message)
      throw new Error(`Erreur lors de l'insertion de la complétude : ${compError.message}`)
    }
  }

  // 10. Create traces
  await createTrace({
    mission_id: missionId,
    license_id: licenseId,
    actor: 'sofia',
    actor_name: 'Sof\'IA',
    action: 'analysis_completed',
    target_type: 'mission',
    target_id: missionId,
    details: `Pré-analyse documentaire terminée pour ${company.name} (documents réels). ` +
      `${signals.length} signal(s) documentaire(s) détecté(s). ` +
      `${pdfs.length} document(s) PDF analysé(s) via extraction de texte et structuration par IA.`,
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

  // 11. Update mission status to 'analyzed'
  await supabase
    .from('missions')
    .update({
      status: 'analyzed',
      analysis_id: missionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', missionId)

  // 12. Generate deliverables
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
    console.error('[Real Analyzer] Erreur génération livrables:', err)
    // Don't fail the whole analysis if deliverable generation fails
  }

  return {
    signals_count: signals.length,
    completeness_count: completenessEntries.length,
    company_name: company.name,
  }
}
