// =============================================================================
// SOF'IA -- Deliverable Generator Service (Orchestrator)
// Coordinates generation of all 4 deliverables:
//   1. Check-list de completude documentaire (PDF)
//   2. Tableau des signaux documentaires (XLSX)
//   3. Synthese de pre-analyse (PDF)
//   4. Journal de tracabilite (PDF)
//
// This service fetches data from Supabase, delegates to individual generators,
// uploads results to Supabase Storage, and records deliverable metadata.
//
// Used by:
//   - POST /api/missions/[id]/deliverables (generate all)
//   - POST /api/missions/[id]/deliverables/regenerate (regenerate specific types)
//
// All deliverables include:
//   - CAC identity (name, CNCC number, cabinet)
//   - Date of generation
//   - Mandatory disclaimer
//   - Professional French language (no forbidden vocabulary)
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js'
import type {
  Deliverable,
  DeliverableType,
  DeliverableFormat,
  DeliverableInsert,
  Profile,
  Mission,
  Signal,
  Completeness,
  Trace,
} from '@/types/database'
import { generateChecklistPdf } from './generators/checklist-generator'
import { generateSignalsTableXlsx } from './generators/signals-table-generator'
import { generateSynthesisPdf } from './generators/synthesis-generator'
import { generateJournalPdf } from './generators/journal-generator'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Definition of a single deliverable type with metadata */
interface DeliverableDefinition {
  type: DeliverableType
  format: DeliverableFormat
  title: string
  filename: string
  contentType: string
}

/** Data required for deliverable generation */
interface DeliverableData {
  mission: Mission
  profile: Profile
  signals: Signal[]
  completeness: Completeness[]
  traces: Trace[]
}

/** Result of generating a single deliverable (internal) */
interface GeneratedDeliverable {
  definition: DeliverableDefinition
  buffer: Buffer
  contentJson: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// Deliverable definitions
// -----------------------------------------------------------------------------

const DELIVERABLE_DEFINITIONS: DeliverableDefinition[] = [
  {
    type: 'checklist_completude',
    format: 'pdf',
    title: 'Check-list de completude documentaire',
    filename: 'checklist_completude.pdf',
    contentType: 'application/pdf',
  },
  {
    type: 'tableau_signaux',
    format: 'xlsx',
    title: 'Tableau des signaux documentaires',
    filename: 'tableau_signaux.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    type: 'synthese_preanalyse',
    format: 'pdf',
    title: 'Synthese de pre-analyse documentaire',
    filename: 'synthese_preanalyse.pdf',
    contentType: 'application/pdf',
  },
  {
    type: 'journal_tracabilite',
    format: 'pdf',
    title: 'Journal de tracabilite',
    filename: 'journal_tracabilite.pdf',
    contentType: 'application/pdf',
  },
]

// -----------------------------------------------------------------------------
// Main Orchestrator
// -----------------------------------------------------------------------------

/**
 * Generates all 4 deliverables for a mission.
 *
 * Steps:
 *   1. Fetches mission, profile, signals, completeness, and traces from Supabase
 *   2. Generates each deliverable file (PDF/XLSX)
 *   3. Uploads files to Supabase Storage (deliverables/{mission_id}/)
 *   4. Upserts deliverable metadata in the deliverables table
 *   5. Returns the updated deliverable records
 *
 * @param supabase - Server-side Supabase client (service role)
 * @param missionId - Mission UUID
 * @param licenseId - License UUID (for data isolation)
 * @returns Array of deliverable records
 */
export async function generateAllDeliverables(
  supabase: SupabaseClient,
  missionId: string,
  licenseId: string
): Promise<Deliverable[]> {
  // Fetch all required data
  const data = await fetchDeliverableData(supabase, missionId, licenseId)

  // Generate all deliverables
  const results: Deliverable[] = []
  for (const definition of DELIVERABLE_DEFINITIONS) {
    const deliverable = await generateSingleDeliverable(
      supabase,
      missionId,
      definition,
      data
    )
    results.push(deliverable)
  }

  return results
}

/**
 * Regenerates specific deliverable types (or all if types not specified).
 *
 * @param supabase - Server-side Supabase client (service role)
 * @param missionId - Mission UUID
 * @param licenseId - License UUID
 * @param types - Optional array of deliverable types to regenerate (all if omitted)
 * @returns Array of regenerated deliverable records
 */
export async function regenerateDeliverables(
  supabase: SupabaseClient,
  missionId: string,
  licenseId: string,
  types?: DeliverableType[]
): Promise<Deliverable[]> {
  // Determine which deliverables to regenerate
  const definitions = types
    ? DELIVERABLE_DEFINITIONS.filter((d) => types.includes(d.type))
    : DELIVERABLE_DEFINITIONS

  if (definitions.length === 0) {
    return []
  }

  // Fetch all required data
  const data = await fetchDeliverableData(supabase, missionId, licenseId)

  // Regenerate selected deliverables
  const results: Deliverable[] = []
  for (const definition of definitions) {
    const deliverable = await generateSingleDeliverable(
      supabase,
      missionId,
      definition,
      data
    )
    results.push(deliverable)
  }

  return results
}

// -----------------------------------------------------------------------------
// Data Fetching
// -----------------------------------------------------------------------------

/**
 * Fetches all data required for deliverable generation from Supabase.
 * Throws descriptive errors if critical data is missing.
 */
async function fetchDeliverableData(
  supabase: SupabaseClient,
  missionId: string,
  licenseId: string
): Promise<DeliverableData> {
  // Fetch mission
  const { data: mission, error: missionError } = await supabase
    .from('missions')
    .select('*')
    .eq('id', missionId)
    .eq('license_id', licenseId)
    .single()

  if (missionError || !mission) {
    throw new Error(`Mission introuvable (id: ${missionId})`)
  }

  // Fetch profile for the license
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('license_id', licenseId)
    .single()

  if (profileError || !profile) {
    throw new Error(
      'Profil CAC introuvable. Veuillez configurer votre profil avant de generer les livrables.'
    )
  }

  // Fetch signals for the mission
  const { data: signals, error: signalsError } = await supabase
    .from('signals')
    .select('*')
    .eq('mission_id', missionId)
    .order('priority', { ascending: false })

  if (signalsError) {
    throw new Error(`Erreur lors de la recuperation des signaux : ${signalsError.message}`)
  }

  // Fetch completeness entries
  const { data: completeness, error: completenessError } = await supabase
    .from('completeness')
    .select('*')
    .eq('mission_id', missionId)

  if (completenessError) {
    throw new Error(
      `Erreur lors de la recuperation de la completude : ${completenessError.message}`
    )
  }

  // Fetch traces
  const { data: traces, error: tracesError } = await supabase
    .from('traces')
    .select('*')
    .eq('mission_id', missionId)
    .order('timestamp', { ascending: true })

  if (tracesError) {
    throw new Error(`Erreur lors de la recuperation des traces : ${tracesError.message}`)
  }

  return {
    mission: mission as Mission,
    profile: profile as Profile,
    signals: (signals || []) as Signal[],
    completeness: (completeness || []) as Completeness[],
    traces: (traces || []) as Trace[],
  }
}

// -----------------------------------------------------------------------------
// Single Deliverable Generation
// -----------------------------------------------------------------------------

/**
 * Generates a single deliverable: creates the file, uploads to Storage,
 * and upserts the metadata record.
 */
async function generateSingleDeliverable(
  supabase: SupabaseClient,
  missionId: string,
  definition: DeliverableDefinition,
  data: DeliverableData
): Promise<Deliverable> {
  // Generate the file buffer
  const generated = await generateFileBuffer(definition, data)

  // Upload to Supabase Storage
  const storagePath = `${missionId}/${definition.filename}`

  const { error: uploadError } = await supabase.storage
    .from('deliverables')
    .upload(storagePath, generated.buffer, {
      contentType: definition.contentType,
      upsert: true,
    })

  if (uploadError) {
    throw new Error(
      `Erreur lors de l'upload du livrable ${definition.title} : ${uploadError.message}`
    )
  }

  // Check if a record already exists for this deliverable type
  const { data: existing } = await supabase
    .from('deliverables')
    .select('id')
    .eq('mission_id', missionId)
    .eq('type', definition.type)
    .single()

  const now = new Date().toISOString()

  if (existing) {
    // Update existing record
    const { data: updated, error: updateError } = await supabase
      .from('deliverables')
      .update({
        title: definition.title,
        generated_at: now,
        content_json: generated.contentJson,
        storage_path: storagePath,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(
        `Erreur lors de la mise a jour du livrable ${definition.title} : ${updateError.message}`
      )
    }

    return updated as Deliverable
  } else {
    // Insert new record
    const insertData: DeliverableInsert = {
      mission_id: missionId,
      type: definition.type,
      format: definition.format,
      title: definition.title,
      generated_at: now,
      content_json: generated.contentJson,
      storage_path: storagePath,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('deliverables')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      throw new Error(
        `Erreur lors de l'insertion du livrable ${definition.title} : ${insertError.message}`
      )
    }

    return inserted as Deliverable
  }
}

/**
 * Generates the file buffer for a specific deliverable type.
 * Delegates to the appropriate generator.
 */
async function generateFileBuffer(
  definition: DeliverableDefinition,
  data: DeliverableData
): Promise<GeneratedDeliverable> {
  const { mission, profile, signals, completeness, traces } = data

  switch (definition.type) {
    case 'checklist_completude': {
      const buffer = await generateChecklistPdf({ mission, profile, completeness })
      return {
        definition,
        buffer,
        contentJson: {
          type: 'checklist_completude',
          completeness_count: completeness.length,
          required_present: completeness.filter(
            (c) => c.required && c.status === 'present'
          ).length,
          required_total: completeness.filter((c) => c.required).length,
        },
      }
    }

    case 'tableau_signaux': {
      const buffer = await generateSignalsTableXlsx({ mission, profile, signals })
      return {
        definition,
        buffer,
        contentJson: {
          type: 'tableau_signaux',
          signals_count: signals.length,
          by_priority: {
            high: signals.filter((s) => s.priority === 'high').length,
            medium: signals.filter((s) => s.priority === 'medium').length,
            low: signals.filter((s) => s.priority === 'low').length,
          },
          by_decision: {
            pending: signals.filter((s) => s.human_decision === 'pending').length,
            validated: signals.filter((s) => s.human_decision === 'validated').length,
            rejected: signals.filter((s) => s.human_decision === 'rejected').length,
            to_investigate: signals.filter((s) => s.human_decision === 'to_investigate').length,
          },
        },
      }
    }

    case 'synthese_preanalyse': {
      const buffer = await generateSynthesisPdf({ mission, profile, signals, completeness })
      return {
        definition,
        buffer,
        contentJson: {
          type: 'synthese_preanalyse',
          signals_count: signals.length,
          documents_count: completeness.reduce((sum, c) => sum + c.count, 0),
        },
      }
    }

    case 'journal_tracabilite': {
      const buffer = await generateJournalPdf({ mission, profile, traces })
      return {
        definition,
        buffer,
        contentJson: {
          type: 'journal_tracabilite',
          traces_count: traces.length,
          sofia_actions: traces.filter((t) => t.actor === 'sofia').length,
          user_actions: traces.filter((t) => t.actor === 'user').length,
        },
      }
    }

    default:
      throw new Error(`Type de livrable inconnu : ${definition.type}`)
  }
}
