// app/api/missions/[id]/documents/completeness/route.ts
// GET: Get completeness data (expected vs received documents)
// Compares uploaded documents against the expected-documents config for the mission's scenario.

import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  requireSession,
  requireMissionOwnership,
  errorResponse,
  successResponse,
} from '@/lib/auth/helpers'
import {
  getExpectedDocuments,
  type ScenarioType,
  type DocumentType,
} from '@/lib/config/expected-documents'

// ---------------------------------------------------------------
// GET /api/missions/[id]/documents/completeness
// ---------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: missionId } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  let mission
  try {
    mission = await requireMissionOwnership(missionId, session.license_id)
  } catch (response) {
    return response as Response
  }

  const supabase = createServerSupabaseClient()

  // Get all documents for this mission
  const { data: documents, error } = await supabase
    .from('documents')
    .select('type, filename')
    .eq('mission_id', missionId)

  if (error) {
    return errorResponse(
      'Erreur lors de la recuperation des documents.',
      'INTERNAL_ERROR',
      500
    )
  }

  const docsList = documents ?? []

  // Get the expected documents for the mission's scenario
  const scenarioType = mission.scenario as ScenarioType
  const expectedDocs = getExpectedDocuments(scenarioType)

  // Count documents by type
  const docCountByType: Record<string, number> = {}
  for (const doc of docsList) {
    docCountByType[doc.type] = (docCountByType[doc.type] || 0) + 1
  }

  // Build completeness entries by comparing expected vs received
  const completenessEntries = expectedDocs.map((expected) => {
    const count = docCountByType[expected.type] || 0
    let status: 'present' | 'missing' | 'incomplete'

    if (count === 0) {
      status = 'missing'
    } else {
      // For types that could have multiple documents (factures, BL),
      // we consider them present. The 'incomplete' status is set
      // by N8N analysis when it detects missing supporting docs.
      status = 'present'
    }

    return {
      type: expected.type,
      label: expected.label,
      required: expected.required,
      status,
      count,
      note: count === 0 && expected.required
        ? 'Document requis non fourni'
        : count === 0 && !expected.required
          ? 'Document optionnel non fourni'
          : undefined,
    }
  })

  // Also check if there are documents of type 'autre' that don't match any expected type
  const expectedTypes = new Set<string>(expectedDocs.map((d) => d.type))
  const unexpectedTypes = Object.keys(docCountByType).filter(
    (t) => !expectedTypes.has(t)
  )

  for (const unexpectedType of unexpectedTypes) {
    // Only include if there are actually documents of this type
    if (docCountByType[unexpectedType] > 0) {
      completenessEntries.push({
        type: unexpectedType as DocumentType,
        label: unexpectedType === 'autre' ? 'Autre document' : unexpectedType,
        required: false,
        status: 'present' as const,
        count: docCountByType[unexpectedType],
        note: 'Document supplementaire (non attendu pour ce scenario)',
      })
    }
  }

  // Compute summary statistics
  const totalRequired = completenessEntries.filter((e) => e.required).length
  const requiredPresent = completenessEntries.filter(
    (e) => e.required && e.status === 'present'
  ).length
  const completenessPercent =
    totalRequired > 0 ? Math.round((requiredPresent / totalRequired) * 100) : 100

  return successResponse({
    entries: completenessEntries,
    summary: {
      total_expected: expectedDocs.length,
      total_uploaded: docsList.length,
      required_total: totalRequired,
      required_present: requiredPresent,
      completeness_percent: completenessPercent,
      all_required_present: requiredPresent === totalRequired,
    },
  })
}
