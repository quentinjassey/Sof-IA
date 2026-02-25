// =============================================================================
// SOF'IA -- Tableau de rapprochement et justification du CA (XLSX)
// Generates an Excel workbook with per-entry reconciliation and CA coverage.
// Only generated for sondage_ca scenario.
// =============================================================================

import ExcelJS from 'exceljs'
import type { Profile, Mission, Ecriture, Rapprochement } from '@/types/database'

const SCENARIO_LABELS: Record<string, string> = {
  sondage_ca: 'Sondage sur le chiffre d\'affaires',
  cutoff: 'Cesure d\'exercice (cut-off)',
  pointage: 'Pointage des etats financiers',
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  exact: 'Justifie',
  partial: 'Partiel',
  missing: 'Non justifie',
}

const MATCH_FILL_COLORS: Record<string, string> = {
  exact: 'FFDCFCE7',    // Light green
  partial: 'FFFEF3C7',  // Light yellow
  missing: 'FFFECACA',  // Light red
}

export interface ReconciliationTableInput {
  mission: Mission
  profile: Profile
  ecritures: Ecriture[]
  rapprochements: Rapprochement[]
  caTotal: number | null
}

interface ReconRow {
  pieceRef: string
  libelle: string
  dateEcriture: string | null
  debit: number
  credit: number
  montantAbs: number
  isAvoir: boolean
  factureTrouvee: boolean
  montantFactureTtc: number | null
  ecartPct: number | null
  blTrouve: boolean
  dateLivraison: string | null
  matchType: string
  nbSignaux: number
}

export async function generateReconciliationTableXlsx(
  input: ReconciliationTableInput
): Promise<Buffer> {
  const { mission, profile, ecritures, rapprochements, caTotal } = input
  const generatedAt = new Date()
  const formattedDate = formatDateFr(generatedAt)

  const rows = buildReconciliationRows(ecritures, rapprochements)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sof\'IA'
  workbook.created = generatedAt

  // =========================================================================
  // Sheet 1: Rapprochement
  // =========================================================================
  const sheet = workbook.addWorksheet('Rapprochement', {
    properties: { defaultColWidth: 16 },
  })

  // Title
  sheet.mergeCells('A1:L1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'Sof\'IA \u2014 Tableau de rapprochement et justification des montants'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' }

  // Info
  sheet.mergeCells('A2:L2')
  const infoCell = sheet.getCell('A2')
  infoCell.value = `Mission : ${mission.name} | CAC : ${profile.name}${profile.inscription_cncc ? ` (${profile.inscription_cncc})` : ''} | Cabinet : ${profile.cabinet} | Date : ${formattedDate}`
  infoCell.font = { size: 10, color: { argb: 'FF475569' } }

  // Disclaimer
  sheet.mergeCells('A3:L3')
  const disclaimerCell = sheet.getCell('A3')
  disclaimerCell.value = 'Analyse automatique \u2014 a valider par le commissaire aux comptes. Sof\'IA ne se substitue pas au jugement professionnel.'
  disclaimerCell.font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } }

  sheet.getRow(4).height = 8

  // Column headers
  const headers = [
    'Ref. piece',
    'Libelle',
    'Date ecriture',
    'Debit (EUR)',
    'Credit (EUR)',
    'Type',
    'Facture',
    'Montant facture TTC',
    'Ecart (%)',
    'BL',
    'Date livraison',
    'Statut',
  ]

  const headerRow = sheet.getRow(5)
  headers.forEach((header, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = thinBorder('FF1E3A5F')
  })
  headerRow.height = 28

  sheet.getColumn(1).width = 16
  sheet.getColumn(2).width = 35
  sheet.getColumn(3).width = 14
  sheet.getColumn(4).width = 14
  sheet.getColumn(5).width = 14
  sheet.getColumn(6).width = 10
  sheet.getColumn(7).width = 10
  sheet.getColumn(8).width = 18
  sheet.getColumn(9).width = 10
  sheet.getColumn(10).width = 8
  sheet.getColumn(11).width = 14
  sheet.getColumn(12).width = 14

  // Data rows
  rows.forEach((r, idx) => {
    const rowNum = idx + 6
    const row = sheet.getRow(rowNum)

    row.getCell(1).value = r.pieceRef
    row.getCell(2).value = r.libelle
    row.getCell(3).value = r.dateEcriture || '-'
    row.getCell(4).value = r.debit > 0 ? r.debit : null
    row.getCell(5).value = r.credit > 0 ? r.credit : null
    row.getCell(6).value = r.isAvoir ? 'Avoir' : 'Facture'
    row.getCell(7).value = r.factureTrouvee ? 'Oui' : 'Non'
    row.getCell(8).value = r.montantFactureTtc != null ? r.montantFactureTtc : '-'
    row.getCell(9).value = r.ecartPct != null ? `${r.ecartPct.toFixed(1)}%` : '-'
    row.getCell(10).value = r.blTrouve ? 'Oui' : 'Non'
    row.getCell(11).value = r.dateLivraison || '-'
    row.getCell(12).value = MATCH_TYPE_LABELS[r.matchType] || r.matchType

    // Row fill based on match status
    const fillColor = MATCH_FILL_COLORS[r.matchType]
    if (fillColor) {
      for (let col = 1; col <= 12; col++) {
        row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
      }
    }

    // Cell formatting
    for (let col = 1; col <= 12; col++) {
      const cell = row.getCell(col)
      cell.font = { size: 9, color: { argb: 'FF1E293B' } }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = thinBorder('FFE2E8F0')
    }

    // Amounts: right-align, number format
    for (const col of [4, 5, 8]) {
      const cell = row.getCell(col)
      cell.alignment = { horizontal: 'right', vertical: 'top' }
      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00'
      }
    }

    // Center-align columns
    for (const col of [3, 6, 7, 9, 10, 11, 12]) {
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'top' }
    }

    // Bold status
    row.getCell(12).font = {
      size: 9,
      bold: true,
      color: { argb: r.matchType === 'exact' ? 'FF16A34A' : r.matchType === 'missing' ? 'FFDC2626' : 'FFD97706' },
    }
  })

  // Totals row
  const totalsRowNum = rows.length + 6
  const totalsRow = sheet.getRow(totalsRowNum)

  totalsRow.getCell(1).value = 'TOTAL'
  totalsRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E3A5F' } }

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const totalFacture = rows.reduce((s, r) => s + (r.montantFactureTtc ?? 0), 0)

  totalsRow.getCell(4).value = totalDebit > 0 ? totalDebit : null
  totalsRow.getCell(5).value = totalCredit > 0 ? totalCredit : null
  totalsRow.getCell(8).value = totalFacture > 0 ? totalFacture : null

  for (const col of [4, 5, 8]) {
    const cell = totalsRow.getCell(col)
    cell.font = { bold: true, size: 10 }
    cell.numFmt = '#,##0.00'
    cell.alignment = { horizontal: 'right', vertical: 'top' }
  }

  for (let col = 1; col <= 12; col++) {
    totalsRow.getCell(col).border = {
      top: { style: 'medium', color: { argb: 'FF1E3A5F' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A5F' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }
  }

  // =========================================================================
  // Sheet 2: Couverture CA
  // =========================================================================
  const coverageSheet = workbook.addWorksheet('Couverture CA')

  coverageSheet.mergeCells('A1:D1')
  coverageSheet.getCell('A1').value = 'Couverture du chiffre d\'affaires'
  coverageSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }

  // Mission info
  const infoRows: [string, string][] = [
    ['Mission :', mission.name],
    ['Scenario :', SCENARIO_LABELS[mission.scenario] || mission.scenario],
    ['Commissaire aux comptes :', `${profile.name}${profile.inscription_cncc ? ` (${profile.inscription_cncc})` : ''}`],
    ['Cabinet :', profile.cabinet],
    ['Date de generation :', formattedDate],
  ]

  infoRows.forEach(([label, value], i) => {
    const r = i + 3
    coverageSheet.getCell(`A${r}`).value = label
    coverageSheet.getCell(`A${r}`).font = { bold: true, size: 10 }
    coverageSheet.getCell(`B${r}`).value = value
    coverageSheet.getCell(`B${r}`).font = { size: 10 }
  })

  // Coverage stats
  const totalTested = rows.reduce((s, r) => s + r.montantAbs, 0)
  const invoiceCount = rows.filter((r) => !r.isAvoir).length
  const avoirCount = rows.filter((r) => r.isAvoir).length
  const justifiedCount = rows.filter((r) => r.matchType === 'exact').length
  const partialCount = rows.filter((r) => r.matchType === 'partial').length
  const missingCount = rows.filter((r) => r.matchType === 'missing').length
  const coveragePct = caTotal && caTotal > 0
    ? Math.round(totalTested / caTotal * 10000) / 100
    : null

  let statsRow = 9
  const addStat = (label: string, value: string | number, opts?: { bold?: boolean; color?: string }) => {
    coverageSheet.getCell(`A${statsRow}`).value = label
    coverageSheet.getCell(`A${statsRow}`).font = { bold: true, size: 10 }
    coverageSheet.getCell(`B${statsRow}`).value = value
    coverageSheet.getCell(`B${statsRow}`).font = {
      size: 10,
      bold: opts?.bold,
      color: opts?.color ? { argb: opts.color } : undefined,
    }
    if (typeof value === 'number') {
      coverageSheet.getCell(`B${statsRow}`).numFmt = '#,##0.00'
    }
    statsRow++
  }

  addStat('Pieces testees :', `${rows.length} (dont ${invoiceCount} facture${invoiceCount > 1 ? 's' : ''} et ${avoirCount} avoir${avoirCount > 1 ? 's' : ''})`)
  addStat('Montant total teste (valeur absolue) :', totalTested, { bold: true })
  if (caTotal != null && caTotal > 0) {
    addStat('Chiffre d\'affaires total (FEC) :', caTotal, { bold: true })
    addStat('Taux de couverture :', `${coveragePct}%`, { bold: true, color: 'FF1E3A5F' })
  }

  statsRow++
  coverageSheet.getCell(`A${statsRow}`).value = 'Resultat du rapprochement'
  coverageSheet.getCell(`A${statsRow}`).font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } }
  statsRow++

  addStat('Pieces justifiees (facture + BL) :', justifiedCount, { color: 'FF16A34A' })
  addStat('Pieces partiellement justifiees :', partialCount, { color: 'FFD97706' })
  addStat('Pieces non justifiees :', missingCount, { color: 'FFDC2626' })

  coverageSheet.getColumn(1).width = 35
  coverageSheet.getColumn(2).width = 50

  // Disclaimer
  statsRow += 2
  coverageSheet.getCell(`A${statsRow}`).value =
    'Analyse automatique \u2014 a valider par le commissaire aux comptes. Sof\'IA ne se substitue pas au jugement professionnel.'
  coverageSheet.getCell(`A${statsRow}`).font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } }

  // =========================================================================
  // Export
  // =========================================================================
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildReconciliationRows(
  ecritures: Ecriture[],
  rapprochements: Rapprochement[]
): ReconRow[] {
  const rapprochementByEcritureId = new Map<string, Rapprochement>()
  for (const rap of rapprochements) {
    rapprochementByEcritureId.set(rap.ecriture_id, rap)
  }

  return ecritures.map((e) => {
    const rap = rapprochementByEcritureId.get(e.id)
    const md = (rap?.match_details ?? {}) as Record<string, unknown>

    const debit = Number(e.debit) || 0
    const credit = Number(e.credit) || 0
    const montantAbs = debit + credit
    const isAvoir = Boolean(md.is_avoir) || credit > 0
    const factureTrouvee = Boolean(md.facture_trouvee)
    const blTrouve = Boolean(md.bl_trouve)
    const montantFactureTtc = md.montant_facture_ttc != null ? Number(md.montant_facture_ttc) : null

    let ecartPct: number | null = null
    if (montantFactureTtc != null && montantAbs > 0) {
      ecartPct = Math.abs(montantFactureTtc - montantAbs) / montantAbs * 100
      if (ecartPct < 0.01) ecartPct = 0
    }

    return {
      pieceRef: e.piece_ref || '-',
      libelle: e.ecriture_lib || '-',
      dateEcriture: e.ecriture_date,
      debit,
      credit,
      montantAbs,
      isAvoir,
      factureTrouvee,
      montantFactureTtc,
      ecartPct,
      blTrouve,
      dateLivraison: md.date_livraison as string | null ?? null,
      matchType: rap?.match_type || 'missing',
      nbSignaux: Number(md.nb_signaux) || 0,
    }
  })
}

function thinBorder(color: string): Partial<ExcelJS.Borders> {
  const style: ExcelJS.Border = { style: 'thin', color: { argb: color } }
  return { top: style, bottom: style, left: style, right: style }
}

function formatDateFr(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} a ${hours}:${minutes}`
}
