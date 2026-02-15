// =============================================================================
// SOF'IA -- Tableau des signaux documentaires (XLSX)
// Generates an Excel workbook with all documentary signals and CAC decisions.
// Uses exceljs for server-side XLSX generation.
// Dependency: exceljs (npm install exceljs)
// =============================================================================

import ExcelJS from 'exceljs'
import type { Signal, Profile, Mission } from '@/types/database'

// -----------------------------------------------------------------------------
// Type labels for display
// -----------------------------------------------------------------------------

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  absence_piece: 'Piece justificative manquante',
  incoherence_date: 'Incoherence de dates',
  incoherence_montant: 'Ecart de montant',
  rupture_chaine: 'Rupture de la chaine documentaire',
  rattachement_temporel: 'Doute sur le rattachement temporel',
  incompletude: 'Information incomplete',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Eleve',
  medium: 'Moyen',
  low: 'Faible',
}

const DECISION_LABELS: Record<string, string> = {
  pending: 'En attente',
  validated: 'Valide',
  rejected: 'Rejete',
  to_investigate: 'A approfondir',
}

const SCENARIO_LABELS: Record<string, string> = {
  sondage_ca: 'Sondage sur le chiffre d\'affaires',
  cutoff: 'Cesure d\'exercice (cut-off)',
  pointage: 'Pointage des etats financiers',
}

// Priority fill colors (ARGB format for ExcelJS)
const PRIORITY_FILL_COLORS: Record<string, string> = {
  high: 'FFFECACA',    // Light red
  medium: 'FFFEF3C7',  // Light orange/yellow
  low: 'FFF1F5F9',     // Light gray
}

// Decision fill colors
const DECISION_FILL_COLORS: Record<string, string> = {
  pending: 'FFFFF7ED',        // Light amber
  validated: 'FFDCFCE7',      // Light green
  rejected: 'FFFEE2E2',       // Light red
  to_investigate: 'FFDBEAFE', // Light blue
}

// -----------------------------------------------------------------------------
// Generator
// -----------------------------------------------------------------------------

export interface SignalsTableGeneratorInput {
  mission: Mission
  profile: Profile
  signals: Signal[]
}

/**
 * Generates an XLSX workbook with two sheets:
 * - Sheet 1: "Signaux" -- All signals with CAC decisions
 * - Sheet 2: "Resume" -- Summary statistics
 * Returns a Buffer containing the XLSX data.
 */
export async function generateSignalsTableXlsx(
  input: SignalsTableGeneratorInput
): Promise<Buffer> {
  const { mission, profile, signals } = input
  const generatedAt = new Date()
  const formattedDate = formatDateFr(generatedAt)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sof\'IA'
  workbook.created = generatedAt

  // =========================================================================
  // Sheet 1: Signaux
  // =========================================================================
  const signalsSheet = workbook.addWorksheet('Signaux', {
    properties: { defaultColWidth: 18 },
  })

  // Header rows (mission info + disclaimer)
  signalsSheet.mergeCells('A1:I1')
  const titleCell = signalsSheet.getCell('A1')
  titleCell.value = 'Sof\'IA \u2014 Tableau des signaux documentaires'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' }

  signalsSheet.mergeCells('A2:I2')
  const infoCell = signalsSheet.getCell('A2')
  infoCell.value = `Mission : ${mission.name} | CAC : ${profile.name}${profile.inscription_cncc ? ` (${profile.inscription_cncc})` : ''} | Cabinet : ${profile.cabinet} | Date : ${formattedDate}`
  infoCell.font = { size: 10, color: { argb: 'FF475569' } }

  signalsSheet.mergeCells('A3:I3')
  const disclaimerCell = signalsSheet.getCell('A3')
  disclaimerCell.value = 'Analyse automatique \u2014 a valider par le commissaire aux comptes. Sof\'IA ne se substitue pas au jugement professionnel.'
  disclaimerCell.font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } }

  // Empty row
  signalsSheet.getRow(4).height = 8

  // Column headers (row 5)
  const headerRow = signalsSheet.getRow(5)
  const headers = [
    'N\u00b0',
    'Type',
    'Document source',
    'Page/Ligne',
    'Regle declenchee',
    'Priorite',
    'Constat',
    'Decision CAC',
    'Commentaire CAC',
  ]

  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E3A5F' } },
      bottom: { style: 'thin', color: { argb: 'FF1E3A5F' } },
      left: { style: 'thin', color: { argb: 'FF1E3A5F' } },
      right: { style: 'thin', color: { argb: 'FF1E3A5F' } },
    }
  })
  headerRow.height = 28

  // Column widths
  signalsSheet.getColumn(1).width = 6    // N
  signalsSheet.getColumn(2).width = 22   // Type
  signalsSheet.getColumn(3).width = 22   // Document source
  signalsSheet.getColumn(4).width = 12   // Page/Ligne
  signalsSheet.getColumn(5).width = 18   // Regle
  signalsSheet.getColumn(6).width = 10   // Priorite
  signalsSheet.getColumn(7).width = 45   // Constat
  signalsSheet.getColumn(8).width = 15   // Decision
  signalsSheet.getColumn(9).width = 30   // Commentaire

  // Signal data rows
  signals.forEach((signal, index) => {
    const rowNumber = index + 6
    const row = signalsSheet.getRow(rowNumber)

    row.getCell(1).value = index + 1
    row.getCell(2).value = SIGNAL_TYPE_LABELS[signal.type] || signal.type
    row.getCell(3).value = signal.source_document || '-'
    row.getCell(4).value = signal.source_page ? `p. ${signal.source_page}` : '-'
    row.getCell(5).value = signal.rule_triggered || '-'
    row.getCell(6).value = PRIORITY_LABELS[signal.priority] || signal.priority
    row.getCell(7).value = signal.description
    row.getCell(8).value = DECISION_LABELS[signal.human_decision] || signal.human_decision
    row.getCell(9).value = signal.human_comment || '-'

    // Apply priority color to the row
    const priorityFill = PRIORITY_FILL_COLORS[signal.priority]
    if (priorityFill) {
      for (let col = 1; col <= 9; col++) {
        const cell = row.getCell(col)
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: priorityFill },
        }
      }
    }

    // Override decision column with decision-specific color
    const decisionFill = DECISION_FILL_COLORS[signal.human_decision]
    if (decisionFill) {
      row.getCell(8).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: decisionFill },
      }
    }

    // Apply borders and formatting
    for (let col = 1; col <= 9; col++) {
      const cell = row.getCell(col)
      cell.font = { size: 9, color: { argb: 'FF1E293B' } }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    }

    // Center-align certain columns
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'top' }
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'top' }
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'top' }
    row.getCell(8).alignment = { horizontal: 'center', vertical: 'top', wrapText: true }

    // Bold the priority cell
    row.getCell(6).font = {
      size: 9,
      bold: true,
      color: { argb: signal.priority === 'high' ? 'FFDC2626' : signal.priority === 'medium' ? 'FFD97706' : 'FF64748B' },
    }
  })

  // =========================================================================
  // Sheet 2: Resume
  // =========================================================================
  const summarySheet = workbook.addWorksheet('Resume')

  // Title
  summarySheet.mergeCells('A1:D1')
  const summaryTitle = summarySheet.getCell('A1')
  summaryTitle.value = 'Resume des signaux documentaires'
  summaryTitle.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }

  // Mission info
  summarySheet.getCell('A3').value = 'Mission :'
  summarySheet.getCell('A3').font = { bold: true, size: 10 }
  summarySheet.getCell('B3').value = mission.name
  summarySheet.getCell('B3').font = { size: 10 }

  summarySheet.getCell('A4').value = 'Scenario :'
  summarySheet.getCell('A4').font = { bold: true, size: 10 }
  summarySheet.getCell('B4').value = SCENARIO_LABELS[mission.scenario] || mission.scenario
  summarySheet.getCell('B4').font = { size: 10 }

  summarySheet.getCell('A5').value = 'Commissaire aux comptes :'
  summarySheet.getCell('A5').font = { bold: true, size: 10 }
  summarySheet.getCell('B5').value = `${profile.name}${profile.inscription_cncc ? ` (${profile.inscription_cncc})` : ''}`
  summarySheet.getCell('B5').font = { size: 10 }

  summarySheet.getCell('A6').value = 'Cabinet :'
  summarySheet.getCell('A6').font = { bold: true, size: 10 }
  summarySheet.getCell('B6').value = profile.cabinet
  summarySheet.getCell('B6').font = { size: 10 }

  summarySheet.getCell('A7').value = 'Date de generation :'
  summarySheet.getCell('A7').font = { bold: true, size: 10 }
  summarySheet.getCell('B7').value = formattedDate
  summarySheet.getCell('B7').font = { size: 10 }

  // Statistics
  const byPriority = {
    high: signals.filter((s) => s.priority === 'high').length,
    medium: signals.filter((s) => s.priority === 'medium').length,
    low: signals.filter((s) => s.priority === 'low').length,
  }
  const byDecision = {
    pending: signals.filter((s) => s.human_decision === 'pending').length,
    validated: signals.filter((s) => s.human_decision === 'validated').length,
    rejected: signals.filter((s) => s.human_decision === 'rejected').length,
    to_investigate: signals.filter((s) => s.human_decision === 'to_investigate').length,
  }

  summarySheet.getCell('A9').value = 'Nombre total de signaux :'
  summarySheet.getCell('A9').font = { bold: true, size: 11 }
  summarySheet.getCell('B9').value = signals.length
  summarySheet.getCell('B9').font = { bold: true, size: 11 }

  // Priority breakdown
  summarySheet.getCell('A11').value = 'Repartition par priorite'
  summarySheet.getCell('A11').font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } }

  summarySheet.getCell('A12').value = 'Eleve'
  summarySheet.getCell('B12').value = byPriority.high
  summarySheet.getCell('A12').font = { color: { argb: 'FFDC2626' }, bold: true }

  summarySheet.getCell('A13').value = 'Moyen'
  summarySheet.getCell('B13').value = byPriority.medium
  summarySheet.getCell('A13').font = { color: { argb: 'FFD97706' }, bold: true }

  summarySheet.getCell('A14').value = 'Faible'
  summarySheet.getCell('B14').value = byPriority.low
  summarySheet.getCell('A14').font = { color: { argb: 'FF64748B' }, bold: true }

  // Decision breakdown
  summarySheet.getCell('A16').value = 'Repartition par decision'
  summarySheet.getCell('A16').font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } }

  summarySheet.getCell('A17').value = 'En attente'
  summarySheet.getCell('B17').value = byDecision.pending
  summarySheet.getCell('A18').value = 'Valides'
  summarySheet.getCell('B18').value = byDecision.validated
  summarySheet.getCell('A19').value = 'Rejetes'
  summarySheet.getCell('B19').value = byDecision.rejected
  summarySheet.getCell('A20').value = 'A approfondir'
  summarySheet.getCell('B20').value = byDecision.to_investigate

  // Column widths for summary
  summarySheet.getColumn(1).width = 30
  summarySheet.getColumn(2).width = 40

  // Disclaimer at bottom
  summarySheet.getCell('A22').value =
    'Analyse automatique \u2014 a valider par le commissaire aux comptes. Sof\'IA ne se substitue pas au jugement professionnel.'
  summarySheet.getCell('A22').font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } }

  // =========================================================================
  // Export to Buffer
  // =========================================================================
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Formats a Date to French format: dd/mm/yyyy a hh:mm
 */
function formatDateFr(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} a ${hours}:${minutes}`
}
