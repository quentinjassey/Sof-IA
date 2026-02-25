#!/usr/bin/env npx tsx
// =============================================================================
// SOF'IA — Generation de documents financiers ultra-realistes (scenario Pointage)
// Entreprise : Rivetin Mecanique Industrielle SAS — Exercice clos le 31/12/2025
//
// 3 PDFs generes :
//   1. bilan_rivetin_mecanique_2025.pdf
//   2. compte_resultat_rivetin_mecanique_2025.pdf
//   3. annexe_rivetin_mecanique_2025.pdf
//
// SIGNAUX INTENTIONNELS :
//   PTG-001 : Immo corporelles brut bilan = 1 420 000 / annexe Note 3 = 1 385 000 (ecart 35 000)
//   PTG-005 : Honoraires 45 000 → 148 000 (+229%) avec explication insuffisante
// =============================================================================

import fs from 'fs'
import path from 'path'
import { RIVETIN, generatePdfBuffer, fmtInt, baseStyles as _baseStyles, type CompanyInfo, type TDocumentDefinitions, type Content, type TableCell } from './pdf-helpers'

// -----------------------------------------------------------------------------
// Styles specifiques etats financiers (plus professionnels que les helpers par defaut)
// -----------------------------------------------------------------------------

const NAVY = '#1a2744'
const DARK_BLUE = '#1e3a5f'
const MID_GRAY = '#475569'
const LIGHT_BG = '#f1f5f9'
const LIGHTER_BG = '#f8fafc'
const BORDER_DARK = '#334155'
const BORDER_LIGHT = '#cbd5e1'

const styles = {
  ..._baseStyles,
  companyName: { fontSize: 14, bold: true, color: NAVY, alignment: 'center' as const },
  companyInfo: { fontSize: 8, color: MID_GRAY, alignment: 'center' as const, margin: [0, 1, 0, 0] as [number, number, number, number] },
  mainTitle: { fontSize: 15, bold: true, color: NAVY, alignment: 'center' as const },
  subtitle: { fontSize: 9.5, color: MID_GRAY, alignment: 'center' as const },
  sectionHeader: { fontSize: 10, bold: true, color: '#ffffff' },
  subSection: { fontSize: 8.5, bold: true, color: NAVY, margin: [0, 3, 0, 1] as [number, number, number, number] },
  tableHeader: { fontSize: 7.5, bold: true, color: '#ffffff' },
  tableCell: { fontSize: 7.8, color: '#1e293b' },
  tableCellBold: { fontSize: 7.8, bold: true, color: '#1e293b' },
  tableCellRight: { fontSize: 7.8, color: '#1e293b', alignment: 'right' as const },
  totalRow: { fontSize: 8.5, bold: true, color: NAVY },
  subTotalRow: { fontSize: 8, bold: true, color: '#334155' },
  noteTitle: { fontSize: 10.5, bold: true, color: NAVY, margin: [0, 14, 0, 4] as [number, number, number, number] },
  noteContent: { fontSize: 8.5, color: '#1e293b', lineHeight: 1.4 },
  noteContentSmall: { fontSize: 8, color: '#334155', lineHeight: 1.3 },
  signatureLine: { fontSize: 9, color: MID_GRAY, italics: true },
  footerPage: { fontSize: 7.5, color: '#94a3b8' },
  disclaimer: { fontSize: 7, color: '#94a3b8', italics: true },
  legalFooter: { fontSize: 7, color: '#94a3b8' },
}

// French number formatting (space thousands, no decimals for financial statements)
function fmt(n: number): string {
  return fmtInt(n)
}

// Negative in parentheses (common in French financial statements)
function fmtNeg(n: number): string {
  if (n < 0) return `(${fmtInt(Math.abs(n))})`
  return fmtInt(n)
}

// -----------------------------------------------------------------------------
// Company header block (professional financial statements style)
// -----------------------------------------------------------------------------

function companyHeader(): Content {
  return {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: 'RIVETIN M\u00c9CANIQUE INDUSTRIELLE SAS', style: 'companyName' },
          { text: 'SAS au capital de 320\u00A0000 EUR', style: 'companyInfo' },
          { text: 'Zone Industrielle des Bruy\u00e8res, 14 all\u00e9e des Forges \u2014 69200 V\u00e9nissieux', style: 'companyInfo' },
          { text: 'SIRET : 489 312 756 00024 \u2014 NAF : 2562B (M\u00e9canique industrielle)', style: 'companyInfo' },
          { text: 'RCS Lyon B 489 312 756', style: 'companyInfo' },
        ],
        margin: [10, 8, 10, 8] as [number, number, number, number],
      }]],
    },
    layout: {
      hLineWidth: () => 1.2,
      vLineWidth: () => 1.2,
      hLineColor: () => NAVY,
      vLineColor: () => NAVY,
    },
  } as Content
}

// Common table layout for financial statements
const finTableLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
    i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.4,
  vLineWidth: (_i: number, _node: { table: { body: unknown[][] } }) => 0.4,
  hLineColor: (i: number) => (i <= 1 ? DARK_BLUE : BORDER_LIGHT),
  vLineColor: () => BORDER_LIGHT,
  fillColor: (i: number) => (i === 0 ? DARK_BLUE : i % 2 === 0 ? LIGHTER_BG : null),
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 2.5,
  paddingBottom: () => 2.5,
}

// Footer for all pages
function pageFooter(docTitle: string) {
  return (currentPage: number, pageCount: number): Content => ({
    stack: [
      {
        canvas: [{ type: 'line', x1: 40, y1: 0, x2: 555, y2: 0, lineWidth: 0.5, lineColor: BORDER_LIGHT }],
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      {
        columns: [
          { text: `Rivetin M\u00e9canique Industrielle SAS \u2014 ${docTitle}`, style: 'disclaimer', margin: [40, 0, 0, 0] },
          { text: `Exercice clos le 31/12/2025 \u2014 Page ${currentPage}/${pageCount}`, style: 'disclaimer', alignment: 'right', margin: [0, 0, 40, 0] },
        ],
      },
    ],
  })
}

// =============================================================================
// 1. BILAN AU 31 DECEMBRE 2025
// =============================================================================

async function generateBilan(outputDir: string): Promise<string> {
  const filename = 'bilan_rivetin_mecanique_2025.pdf'

  // ACTIF data
  interface ActifRow {
    label: string
    brut: number
    amort: number
    netN: number
    netN1: number
    bold?: boolean
    isSection?: boolean
    indent?: boolean
  }

  const actifRows: ActifRow[] = [
    { label: 'ACTIF IMMOBILIS\u00c9', brut: 0, amort: 0, netN: 0, netN1: 0, isSection: true },
    { label: 'Immobilisations incorporelles (logiciels, brevets)', brut: 45000, amort: 28000, netN: 17000, netN1: 20000, indent: true },
    { label: 'Immobilisations corporelles', brut: 1420000, amort: 685000, netN: 735000, netN1: 760000, bold: true, indent: true },
    { label: 'Immobilisations financi\u00e8res', brut: 8000, amort: 0, netN: 8000, netN1: 8000, indent: true },
    { label: 'Total Actif immobilis\u00e9', brut: 1473000, amort: 713000, netN: 760000, netN1: 788000, bold: true },
    { label: 'ACTIF CIRCULANT', brut: 0, amort: 0, netN: 0, netN1: 0, isSection: true },
    { label: 'Stocks et en-cours', brut: 420000, amort: 15000, netN: 405000, netN1: 380000, indent: true },
    { label: 'Cr\u00e9ances clients et comptes rattach\u00e9s', brut: 580000, amort: 12000, netN: 568000, netN1: 510000, indent: true },
    { label: 'Autres cr\u00e9ances', brut: 25000, amort: 0, netN: 25000, netN1: 18000, indent: true },
    { label: 'Disponibilit\u00e9s', brut: 185000, amort: 0, netN: 185000, netN1: 142000, indent: true },
    { label: 'Charges constat\u00e9es d\'avance', brut: 15000, amort: 0, netN: 15000, netN1: 24000, indent: true },
    { label: 'Total Actif circulant', brut: 1225000, amort: 27000, netN: 1198000, netN1: 1074000, bold: true },
    { label: 'TOTAL ACTIF', brut: 2698000, amort: 740000, netN: 1958000, netN1: 1862000, bold: true },
  ]

  // PASSIF data
  interface PassifRow {
    label: string
    netN: number
    netN1: number
    bold?: boolean
    isSection?: boolean
    indent?: boolean
  }

  const passifRows: PassifRow[] = [
    { label: 'CAPITAUX PROPRES', netN: 0, netN1: 0, isSection: true },
    { label: 'Capital social', netN: 320000, netN1: 320000, indent: true },
    { label: 'R\u00e9serve l\u00e9gale', netN: 32000, netN1: 32000, indent: true },
    { label: 'Autres r\u00e9serves', netN: 195000, netN1: 150000, indent: true },
    { label: 'Report \u00e0 nouveau', netN: 58000, netN1: 48000, indent: true },
    { label: 'R\u00e9sultat de l\u2019exercice', netN: 115500, netN1: 84750, indent: true },
    { label: 'Total Capitaux propres', netN: 720500, netN1: 634750, bold: true },
    { label: 'PROVISIONS', netN: 0, netN1: 0, isSection: true },
    { label: 'Provisions pour risques et charges', netN: 35000, netN1: 30000, indent: true },
    { label: 'DETTES', netN: 0, netN1: 0, isSection: true },
    { label: 'Emprunts et dettes financi\u00e8res', netN: 680000, netN1: 750000, indent: true },
    { label: 'Fournisseurs et comptes rattach\u00e9s', netN: 345000, netN1: 298000, indent: true },
    { label: 'Dettes fiscales et sociales', netN: 162500, netN1: 138250, indent: true },
    { label: 'Autres dettes', netN: 15000, netN1: 11000, indent: true },
    { label: 'Total Dettes', netN: 1202500, netN1: 1197250, bold: true },
    { label: 'TOTAL PASSIF', netN: 1958000, netN1: 1862000, bold: true },
  ]

  // Build ACTIF table body
  const actifHeader: TableCell[] = [
    { text: 'ACTIF', style: 'tableHeader' },
    { text: 'Brut', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Amort. / D\u00e9pr\u00e9c.', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Net N', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Net N-1', style: 'tableHeader', alignment: 'right' as const },
  ]

  const actifBody: TableCell[][] = [actifHeader]
  for (const row of actifRows) {
    if (row.isSection) {
      actifBody.push([
        { text: row.label, style: 'tableCellBold', colSpan: 5, fillColor: LIGHT_BG },
        {}, {}, {}, {},
      ])
    } else {
      const s = row.bold ? 'tableCellBold' : 'tableCell'
      const isTotal = row.label.startsWith('Total') || row.label.startsWith('TOTAL')
      const fillColor = isTotal ? '#e2e8f0' : undefined
      actifBody.push([
        { text: (row.indent ? '    ' : '') + row.label, style: s, fillColor },
        { text: row.brut === 0 && !isTotal ? '' : fmt(row.brut), style: s, alignment: 'right' as const, fillColor },
        { text: row.amort === 0 && !isTotal ? '' : fmt(row.amort), style: s, alignment: 'right' as const, fillColor },
        { text: fmt(row.netN), style: s, alignment: 'right' as const, fillColor },
        { text: fmt(row.netN1), style: s, alignment: 'right' as const, fillColor },
      ])
    }
  }

  // Build PASSIF table body
  const passifHeader: TableCell[] = [
    { text: 'PASSIF', style: 'tableHeader' },
    { text: 'Net N', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Net N-1', style: 'tableHeader', alignment: 'right' as const },
  ]

  const passifBody: TableCell[][] = [passifHeader]
  for (const row of passifRows) {
    if (row.isSection) {
      passifBody.push([
        { text: row.label, style: 'tableCellBold', colSpan: 3, fillColor: LIGHT_BG },
        {}, {},
      ])
    } else {
      const s = row.bold ? 'tableCellBold' : 'tableCell'
      const isTotal = row.label.startsWith('Total') || row.label.startsWith('TOTAL')
      const fillColor = isTotal ? '#e2e8f0' : undefined
      passifBody.push([
        { text: (row.indent ? '    ' : '') + row.label, style: s, fillColor },
        { text: fmt(row.netN), style: s, alignment: 'right' as const, fillColor },
        { text: fmt(row.netN1), style: s, alignment: 'right' as const, fillColor },
      ])
    }
  }

  const docDef: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 55],
    header: {
      columns: [
        { text: 'Rivetin M\u00e9canique Industrielle SAS', fontSize: 9, bold: true, color: NAVY, margin: [40, 20, 0, 0] },
        { text: 'BILAN', alignment: 'right' as const, fontSize: 9, bold: true, color: NAVY, margin: [0, 20, 40, 0] },
      ],
    },
    footer: pageFooter('Bilan'),
    content: [
      companyHeader(),
      { text: '', margin: [0, 8, 0, 0] },
      { text: 'BILAN AU 31 D\u00c9CEMBRE 2025', style: 'mainTitle' },
      { text: '(Montants exprim\u00e9s en euros)', style: 'subtitle', margin: [0, 1, 0, 0] },
      { text: '', margin: [0, 8, 0, 0] },

      // ACTIF TABLE
      {
        table: { headerRows: 1, widths: ['*', 65, 65, 65, 65], body: actifBody },
        layout: finTableLayout,
      } as Content,

      { text: '', margin: [0, 10, 0, 0] },

      // PASSIF TABLE
      {
        table: { headerRows: 1, widths: ['*', 80, 80], body: passifBody },
        layout: finTableLayout,
      } as Content,

      { text: '', margin: [0, 14, 0, 0] },
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 'auto',
            stack: [
              { text: 'Arr\u00eat\u00e9 par le Pr\u00e9sident le 15 mars 2026', style: 'signatureLine' },
              { text: 'M. Laurent Rivetin, Pr\u00e9sident', style: 'signatureLine', margin: [0, 2, 0, 0] },
            ],
          },
        ],
      },
    ],
    styles,
    defaultStyle: { font: 'Roboto' },
  }

  const buffer = await generatePdfBuffer(docDef)
  fs.writeFileSync(path.join(outputDir, filename), buffer)
  console.log(`  [Pointage] ${filename}`)
  return filename
}

// =============================================================================
// 2. COMPTE DE RESULTAT DE L'EXERCICE CLOS LE 31 DECEMBRE 2025
// =============================================================================

async function generateCompteResultat(outputDir: string): Promise<string> {
  const filename = 'compte_resultat_rivetin_mecanique_2025.pdf'

  interface CRRow {
    label: string
    n: number
    n1: number
    bold?: boolean
    isSection?: boolean
    isResult?: boolean
    indent?: boolean
    isBlank?: boolean
  }

  const rows: CRRow[] = [
    // Produits d'exploitation
    { label: 'PRODUITS D\u2019EXPLOITATION', n: 0, n1: 0, isSection: true },
    { label: 'Chiffre d\u2019affaires net', n: 3480000, n1: 3150000, indent: true },
    { label: 'Production stock\u00e9e', n: 25000, n1: 18000, indent: true },
    { label: 'Subventions d\u2019exploitation', n: 15000, n1: 12000, indent: true },
    { label: 'Reprises sur provisions', n: 20000, n1: 18000, indent: true },
    { label: 'Autres produits', n: 5000, n1: 7000, indent: true },
    { label: 'Total Produits d\u2019exploitation', n: 3545000, n1: 3205000, bold: true },
    { label: '', n: 0, n1: 0, isBlank: true },

    // Charges d'exploitation
    { label: 'CHARGES D\u2019EXPLOITATION', n: 0, n1: 0, isSection: true },
    { label: 'Achats de mati\u00e8res premi\u00e8res', n: 1280000, n1: 1160000, indent: true },
    { label: 'Variation de stocks', n: -35000, n1: -20000, indent: true },
    { label: 'Autres achats et charges externes', n: 680000, n1: 615000, indent: true },
    { label: 'Imp\u00f4ts et taxes', n: 85000, n1: 78000, indent: true },
    { label: 'Salaires et traitements', n: 820000, n1: 745000, indent: true },
    { label: 'Charges sociales', n: 340000, n1: 310000, indent: true },
    { label: 'Dotations aux amortissements', n: 185000, n1: 168000, indent: true },
    { label: 'Dotations aux provisions', n: 25000, n1: 18000, indent: true },
    { label: 'Autres charges', n: 5000, n1: 6000, indent: true },
    { label: 'Total Charges d\u2019exploitation', n: 3385000, n1: 3080000, bold: true },
    { label: '', n: 0, n1: 0, isBlank: true },

    // Resultat d'exploitation
    { label: 'R\u00c9SULTAT D\u2019EXPLOITATION', n: 160000, n1: 125000, isResult: true },
    { label: '', n: 0, n1: 0, isBlank: true },

    // Resultat financier
    { label: 'R\u00c9SULTAT FINANCIER', n: 0, n1: 0, isSection: true },
    { label: 'Produits financiers', n: 2000, n1: 1500, indent: true },
    { label: 'Charges financi\u00e8res (int\u00e9r\u00eats emprunts)', n: 20000, n1: 21500, indent: true },
    { label: 'R\u00e9sultat financier', n: -18000, n1: -20000, isResult: true },
    { label: '', n: 0, n1: 0, isBlank: true },

    // Resultat exceptionnel
    { label: 'R\u00c9SULTAT EXCEPTIONNEL', n: 0, n1: 0, isSection: true },
    { label: 'Produits exceptionnels', n: 15000, n1: 12000, indent: true },
    { label: 'Charges exceptionnelles', n: 3000, n1: 4000, indent: true },
    { label: 'R\u00e9sultat exceptionnel', n: 12000, n1: 8000, isResult: true },
    { label: '', n: 0, n1: 0, isBlank: true },

    // IS + Resultat net
    { label: 'Imp\u00f4t sur les soci\u00e9t\u00e9s', n: 38500, n1: 28250 },
    { label: '', n: 0, n1: 0, isBlank: true },
    { label: 'R\u00c9SULTAT NET DE L\u2019EXERCICE', n: 115500, n1: 84750, isResult: true },
  ]

  const tableHeader: TableCell[] = [
    { text: 'Poste', style: 'tableHeader' },
    { text: 'Exercice N', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Exercice N-1', style: 'tableHeader', alignment: 'right' as const },
  ]

  const tableBody: TableCell[][] = [tableHeader]
  for (const row of rows) {
    if (row.isBlank) {
      tableBody.push([
        { text: '', colSpan: 3, border: [true, false, true, false] }, {}, {},
      ])
      continue
    }
    if (row.isSection) {
      tableBody.push([
        { text: row.label, style: 'tableCellBold', colSpan: 3, fillColor: LIGHT_BG },
        {}, {},
      ])
      continue
    }
    if (row.isResult) {
      const fillColor = row.label.startsWith('R\u00c9SULTAT NET') ? '#dbeafe' : '#e2e8f0'
      const s = 'totalRow'
      tableBody.push([
        { text: row.label, style: s, fillColor },
        { text: fmtNeg(row.n), style: s, alignment: 'right' as const, fillColor },
        { text: fmtNeg(row.n1), style: s, alignment: 'right' as const, fillColor },
      ])
      continue
    }

    const s = row.bold ? 'tableCellBold' : 'tableCell'
    const isTotal = row.label.startsWith('Total')
    const fillColor = isTotal ? '#e2e8f0' : undefined
    tableBody.push([
      { text: (row.indent ? '    ' : '') + row.label, style: s, fillColor },
      { text: fmtNeg(row.n), style: s, alignment: 'right' as const, fillColor },
      { text: fmtNeg(row.n1), style: s, alignment: 'right' as const, fillColor },
    ])
  }

  const docDef: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 55],
    header: {
      columns: [
        { text: 'Rivetin M\u00e9canique Industrielle SAS', fontSize: 9, bold: true, color: NAVY, margin: [40, 20, 0, 0] },
        { text: 'COMPTE DE R\u00c9SULTAT', alignment: 'right' as const, fontSize: 9, bold: true, color: NAVY, margin: [0, 20, 40, 0] },
      ],
    },
    footer: pageFooter('Compte de r\u00e9sultat'),
    content: [
      companyHeader(),
      { text: '', margin: [0, 14, 0, 0] },
      { text: 'COMPTE DE R\u00c9SULTAT DE L\u2019EXERCICE', style: 'mainTitle' },
      { text: 'CLOS LE 31 D\u00c9CEMBRE 2025', style: 'mainTitle', fontSize: 12 },
      { text: '(Montants exprim\u00e9s en euros)', style: 'subtitle', margin: [0, 2, 0, 0] },
      { text: '', margin: [0, 14, 0, 0] },

      {
        table: { headerRows: 1, widths: ['*', 85, 85], body: tableBody },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.3,
          vLineWidth: () => 0.4,
          hLineColor: (i: number) => (i <= 1 ? DARK_BLUE : BORDER_LIGHT),
          vLineColor: () => BORDER_LIGHT,
          fillColor: (i: number) => (i === 0 ? DARK_BLUE : null),
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      } as Content,

      { text: '', margin: [0, 24, 0, 0] },
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 'auto',
            stack: [
              { text: 'Arr\u00eat\u00e9 par le Pr\u00e9sident le 15 mars 2026', style: 'signatureLine' },
              { text: 'M. Laurent Rivetin, Pr\u00e9sident', style: 'signatureLine', margin: [0, 3, 0, 0] },
            ],
          },
        ],
      },
    ],
    styles,
    defaultStyle: { font: 'Roboto' },
  }

  const buffer = await generatePdfBuffer(docDef)
  fs.writeFileSync(path.join(outputDir, filename), buffer)
  console.log(`  [Pointage] ${filename}`)
  return filename
}

// =============================================================================
// 3. ANNEXE AUX COMPTES ANNUELS — EXERCICE CLOS LE 31 DECEMBRE 2025
// =============================================================================

async function generateAnnexe(outputDir: string): Promise<string> {
  const filename = 'annexe_rivetin_mecanique_2025.pdf'

  // Helper: build a simple table for notes
  function noteTable(headers: string[], rows: (string | number)[][], colWidths: ('*' | number)[]): Content {
    const headerRow: TableCell[] = headers.map(h => ({
      text: h, style: 'tableHeader', alignment: (h !== headers[0] ? 'right' : 'left') as 'right' | 'left',
    }))

    const body: TableCell[][] = [headerRow]
    for (const row of rows) {
      const isTotalRow = typeof row[0] === 'string' && (row[0] as string).toLowerCase().startsWith('total')
      body.push(row.map((cell, i) => ({
        text: typeof cell === 'number' ? fmt(cell) : cell,
        style: isTotalRow ? 'tableCellBold' : 'tableCell',
        alignment: (i > 0 ? 'right' : 'left') as 'right' | 'left',
        fillColor: isTotalRow ? '#e2e8f0' : undefined,
      })))
    }

    return {
      table: { headerRows: 1, widths: colWidths, body },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
          i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.3,
        vLineWidth: () => 0.3,
        hLineColor: (i: number) => (i <= 1 ? BORDER_DARK : BORDER_LIGHT),
        vLineColor: () => BORDER_LIGHT,
        fillColor: (i: number) => (i === 0 ? DARK_BLUE : null),
        paddingLeft: () => 5,
        paddingRight: () => 5,
        paddingTop: () => 2.5,
        paddingBottom: () => 2.5,
      },
      margin: [0, 4, 0, 6] as [number, number, number, number],
    } as Content
  }

  const notes: Content[] = []

  // --- Note 1 ---
  notes.push(
    { text: 'Note 1 \u2014 Faits caract\u00e9ristiques de l\u2019exercice', style: 'noteTitle' } as Content,
    { text: 'L\u2019exercice clos le 31 d\u00e9cembre 2025 couvre une p\u00e9riode de 12 mois. La soci\u00e9t\u00e9 Rivetin M\u00e9canique Industrielle, sp\u00e9cialis\u00e9e dans l\u2019usinage de pr\u00e9cision, la m\u00e9cano-soudure et la fabrication de sous-ensembles hydrauliques, a poursuivi son d\u00e9veloppement sur l\u2019ensemble de ses segments d\u2019activit\u00e9.', style: 'noteContent' } as Content,
    { text: 'Le chiffre d\u2019affaires net s\u2019\u00e9tablit \u00e0 3\u00A0480\u00A0000\u00A0EUR contre 3\u00A0150\u00A0000\u00A0EUR en N-1, soit une progression de 10,5\u00A0%. Cette croissance r\u00e9sulte principalement du renforcement des partenariats industriels dans le secteur de l\u2019hydraulique et de la mont\u00e9e en charge de nouveaux contrats de sous-traitance en usinage CN. Aucun \u00e9v\u00e9nement exceptionnel n\u2019est survenu en cours d\u2019exercice.', style: 'noteContent', margin: [0, 3, 0, 0] } as Content,
  )

  // --- Note 2 ---
  notes.push(
    { text: 'Note 2 \u2014 R\u00e8gles et m\u00e9thodes comptables', style: 'noteTitle' } as Content,
    { text: 'Les comptes annuels sont \u00e9tablis conform\u00e9ment aux dispositions du Plan Comptable G\u00e9n\u00e9ral (r\u00e8glement ANC n\u00b0\u00A02014-03 modifi\u00e9). Les conventions g\u00e9n\u00e9rales comptables ont \u00e9t\u00e9 appliqu\u00e9es dans le respect des principes de prudence, de r\u00e9gularit\u00e9 et de sinc\u00e9rit\u00e9.', style: 'noteContent' } as Content,
    {
      ul: [
        { text: 'Immobilisations corporelles : \u00e9valu\u00e9es au co\u00fbt d\u2019acquisition. Amortissements calcul\u00e9s selon le mode lin\u00e9aire sur les dur\u00e9es d\u2019utilit\u00e9 estim\u00e9es.', style: 'noteContentSmall' },
        { text: 'Stocks : \u00e9valu\u00e9s au co\u00fbt moyen pond\u00e9r\u00e9 (CUMP) pour les mati\u00e8res premi\u00e8res (acier, aluminium, composants hydrauliques). En-cours d\u2019usinage \u00e9valu\u00e9s au co\u00fbt de production. D\u00e9pr\u00e9ciation constat\u00e9e lorsque la valeur de r\u00e9alisation est inf\u00e9rieure au co\u00fbt.', style: 'noteContentSmall' },
        { text: 'Cr\u00e9ances : \u00e9valu\u00e9es \u00e0 leur valeur nominale. D\u00e9pr\u00e9ciation pratiqu\u00e9e au cas par cas sur les cr\u00e9ances pr\u00e9sentant un risque de non-recouvrement.', style: 'noteContentSmall' },
        { text: 'Provisions : constitu\u00e9es lorsqu\u2019une obligation envers un tiers existe \u00e0 la date de cl\u00f4ture, en application du principe de prudence.', style: 'noteContentSmall' },
      ],
      margin: [15, 4, 0, 0] as [number, number, number, number],
    } as Content,
  )

  // --- Note 3 --- PTG-001 SIGNAL (1 385 000 vs bilan 1 420 000 — ecart 35 000)
  // The movement table "forgets" an acquisition of outillage CN (35 000 EUR)
  notes.push(
    { text: 'Note 3 \u2014 Immobilisations corporelles', style: 'noteTitle' } as Content,
    { text: 'Dur\u00e9es d\u2019amortissement retenues : installations techniques et mat\u00e9riel industriel 10 \u00e0 15 ans, outillage 7 \u00e0 10 ans, mat\u00e9riel de transport 5 ans, mat\u00e9riel de bureau et informatique 5 \u00e0 8 ans, agencements 10 ans.', style: 'noteContent' } as Content,
    { text: 'L\u2019exercice a \u00e9t\u00e9 marqu\u00e9 par les acquisitions de l\u2019exercice, principalement sur les lignes d\u2019usinage et d\u2019outillage \u00e0 commande num\u00e9rique.', style: 'noteContent', margin: [0, 3, 0, 0] } as Content,
    { text: 'Tableau des mouvements des immobilisations corporelles (valeurs brutes) :', style: 'noteContent', margin: [0, 4, 0, 2] } as Content,
    noteTable(
      ['Poste', 'Brut d\u00e9but', 'Acquisitions', 'Cessions', 'Brut fin'],
      [
        // N-1 total immo corporelles brut = bilan N-1 actif immo corporelles reconstructed
        // We need the table to total to 1 385 000 (missing 35 000 from bilan's 1 420 000)
        ['Installations techniques', 520000, 45000, 0, 565000],
        ['Mat\u00e9riel industriel', 380000, 65000, 18000, 427000],
        ['Outillage', 185000, 28000, 8000, 205000],
        ['Mat\u00e9riel de transport', 120000, 0, 15000, 105000],
        ['Mat\u00e9riel de bureau et informatique', 42000, 12000, 0, 54000],
        ['Agencements', 29000, 0, 0, 29000],
        ['Total', 1276000, 150000, 41000, 1385000],
      ],
      ['*', 60, 60, 55, 60],
    ),
    { text: 'Les cessions de l\u2019exercice concernent un tour conventionnel (18\u00A0000\u00A0EUR brut, VNC 2\u00A0400\u00A0EUR) remplac\u00e9 par un centre d\u2019usinage CN, de l\u2019outillage obsol\u00e8te (8\u00A0000\u00A0EUR) et un v\u00e9hicule utilitaire (15\u00A0000\u00A0EUR brut, VNC 3\u00A0200\u00A0EUR).', style: 'noteContentSmall', margin: [0, 0, 0, 2] } as Content,
  )

  // --- Note 4 ---
  notes.push(
    { text: 'Note 4 \u2014 Amortissements des immobilisations corporelles', style: 'noteTitle' } as Content,
    noteTable(
      ['Poste', 'Cumul d\u00e9but', 'Dotations', 'Reprises', 'Cumul fin'],
      [
        ['Installations techniques', 185000, 48000, 0, 233000],
        ['Mat\u00e9riel industriel', 162000, 52000, 12000, 202000],
        ['Outillage', 98000, 35000, 6500, 126500],
        ['Mat\u00e9riel de transport', 62000, 24000, 11800, 74200],
        ['Mat\u00e9riel de bureau et informatique', 18000, 9000, 0, 27000],
        ['Agencements', 7000, 3000, 0, 10000],
        ['Total', 532000, 171000, 30300, 672700],
      ],
      ['*', 55, 55, 50, 55],
    ),
    { text: 'Valeur nette comptable des immobilisations corporelles au 31/12/2025 : 735\u00A0000\u00A0EUR (760\u00A0000\u00A0EUR en N-1).', style: 'noteContent' } as Content,
  )

  // --- Note 5 ---
  notes.push(
    { text: 'Note 5 \u2014 Stocks et en-cours', style: 'noteTitle' } as Content,
    noteTable(
      ['Nature', 'Brut', 'D\u00e9pr\u00e9ciation', 'Net'],
      [
        ['Mati\u00e8res premi\u00e8res (acier, aluminium, composants)', 245000, 8000, 237000],
        ['Fournitures et consommables industriels', 55000, 0, 55000],
        ['En-cours d\u2019usinage et de fabrication', 95000, 5000, 90000],
        ['Produits finis et sous-ensembles', 25000, 2000, 23000],
        ['Total', 420000, 15000, 405000],
      ],
      ['*', 60, 60, 60],
    ),
    { text: 'La d\u00e9pr\u00e9ciation sur mati\u00e8res premi\u00e8res porte sur un lot d\u2019aluminium a\u00e9ronautique pr\u00e9sentant des d\u00e9fauts de certificat mati\u00e8re (8\u00A0000\u00A0EUR). La d\u00e9pr\u00e9ciation sur en-cours concerne deux commandes en cours dont la marge pr\u00e9visionnelle est n\u00e9gative (5\u00A0000\u00A0EUR). La provision sur produits finis vise des pi\u00e8ces usin\u00e9es hors tol\u00e9rance (2\u00A0000\u00A0EUR).', style: 'noteContentSmall' } as Content,
  )

  // --- Note 6 ---
  notes.push(
    { text: 'Note 6 \u2014 Cr\u00e9ances', style: 'noteTitle' } as Content,
    { text: 'Les cr\u00e9ances clients s\u2019\u00e9l\u00e8vent \u00e0 580\u00A0000\u00A0EUR en valeur brute. Une d\u00e9pr\u00e9ciation de 12\u00A0000\u00A0EUR a \u00e9t\u00e9 constat\u00e9e sur trois clients douteux :', style: 'noteContent' } as Content,
    {
      ul: [
        { text: 'M\u00e9tallerie Pernoud SARL : cr\u00e9ance de 4\u00A0800\u00A0EUR, impay\u00e9e depuis juin 2025, d\u00e9pr\u00e9ci\u00e9e \u00e0 100\u00A0% (redressement judiciaire prononc\u00e9).', style: 'noteContentSmall' },
        { text: 'Hydra-Services SAS : cr\u00e9ance de 5\u00A0200\u00A0EUR, d\u00e9pr\u00e9ci\u00e9e \u00e0 hauteur de 3\u00A0900\u00A0EUR (plan d\u2019apurement en cours).', style: 'noteContentSmall' },
        { text: 'Atelier Marboz : cr\u00e9ance de 3\u00A0300\u00A0EUR, d\u00e9pr\u00e9ci\u00e9e \u00e0 100\u00A0% (litige technique non r\u00e9solu).', style: 'noteContentSmall' },
      ],
      margin: [15, 3, 0, 2] as [number, number, number, number],
    } as Content,
    { text: 'Les autres cr\u00e9ances (25\u00A0000\u00A0EUR) comprennent principalement le cr\u00e9dit de TVA \u00e0 reporter (14\u00A0500\u00A0EUR), le cr\u00e9dit d\u2019imp\u00f4t recherche \u00e0 recevoir (6\u00A0200\u00A0EUR) et des avances sur commandes fournisseurs (4\u00A0300\u00A0EUR).', style: 'noteContentSmall' } as Content,
  )

  // --- Note 7 ---
  notes.push(
    { text: 'Note 7 \u2014 Capitaux propres', style: 'noteTitle' } as Content,
    { text: '\u00c9volution des capitaux propres au cours de l\u2019exercice :', style: 'noteContent' } as Content,
    noteTable(
      ['Poste', 'Ouverture', 'Affectation N-1', 'R\u00e9sultat N', 'Cl\u00f4ture'],
      [
        ['Capital social', 320000, 0, 0, 320000],
        ['R\u00e9serve l\u00e9gale', 32000, 0, 0, 32000],
        ['Autres r\u00e9serves', 150000, 45000, 0, 195000],
        ['Report \u00e0 nouveau', 48000, 10000, 0, 58000],
        ['R\u00e9sultat de l\u2019exercice', 84750, -84750, 115500, 115500],
        ['Total', 634750, -29750, 115500, 720500],
      ],
      ['*', 55, 60, 55, 55],
    ),
    { text: 'Le capital social est constitu\u00e9 de 32\u00A0000 actions de 10\u00A0EUR chacune, enti\u00e8rement lib\u00e9r\u00e9es. M. Laurent Rivetin d\u00e9tient 75\u00A0% des actions, Mme Nathalie Rivetin 20\u00A0% et M. Thomas Rivetin 5\u00A0%.', style: 'noteContentSmall' } as Content,
  )

  // --- Note 8 ---
  notes.push(
    { text: 'Note 8 \u2014 Provisions pour risques et charges', style: 'noteTitle' } as Content,
    noteTable(
      ['Nature', 'Ouverture', 'Dotation', 'Reprise', 'Cl\u00f4ture'],
      [
        ['Provision pour garantie contractuelle', 18000, 8000, 5000, 21000],
        ['Provision pour litiges', 12000, 7000, 5000, 14000],
        ['Total', 30000, 15000, 10000, 35000],
      ],
      ['*', 55, 50, 50, 55],
    ),
    { text: 'La provision pour garantie contractuelle couvre les engagements de reprise et de conformit\u00e9 sur les pi\u00e8ces usin\u00e9es livr\u00e9es au cours des 12 derniers mois. La provision pour litiges concerne un diff\u00e9rend avec un sous-traitant portant sur la qualit\u00e9 d\u2019un lot de pi\u00e8ces m\u00e9cano-soud\u00e9es (proc\u00e9dure en cours devant le tribunal de commerce de Lyon).', style: 'noteContentSmall' } as Content,
  )

  // --- Note 9 ---
  notes.push(
    { text: 'Note 9 \u2014 Emprunts et dettes financi\u00e8res', style: 'noteTitle' } as Content,
    { text: 'La soci\u00e9t\u00e9 dispose de deux emprunts bancaires :', style: 'noteContent' } as Content,
    {
      ul: [
        { text: 'Emprunt CIC (investissement industriel, mars 2020) : capital initial 950\u00A0000\u00A0EUR, capital restant d\u00fb 520\u00A0000\u00A0EUR, taux fixe 2,85\u00A0%, \u00e9ch\u00e9ance mars 2030, garanti par nantissement du fonds de commerce.', style: 'noteContentSmall' },
        { text: 'Emprunt BPI France (financement outillage CN, septembre 2023) : capital initial 250\u00A0000\u00A0EUR, capital restant d\u00fb 160\u00A0000\u00A0EUR, taux fixe 3,20\u00A0%, \u00e9ch\u00e9ance septembre 2028, garanti par nantissement de mat\u00e9riel.', style: 'noteContentSmall' },
      ],
      margin: [15, 3, 0, 2] as [number, number, number, number],
    } as Content,
    { text: '\u00c9ch\u00e9ancier de la dette financi\u00e8re :', style: 'noteContent', margin: [0, 3, 0, 2] } as Content,
    noteTable(
      ['\u00c9ch\u00e9ance', 'Montant'],
      [
        ['\u00c0 moins d\u2019un an', 125000],
        ['De 1 \u00e0 5 ans', 430000],
        ['\u00c0 plus de 5 ans', 125000],
        ['Total', 680000],
      ],
      ['*', 80],
    ),
  )

  // --- Note 10 ---
  notes.push(
    { text: 'Note 10 \u2014 Chiffre d\u2019affaires', style: 'noteTitle' } as Content,
    { text: 'Le chiffre d\u2019affaires net de l\u2019exercice s\u2019\u00e9tablit \u00e0 3\u00A0480\u00A0000\u00A0EUR, en progression de 10,5\u00A0% par rapport \u00e0 N-1 (3\u00A0150\u00A0000\u00A0EUR).', style: 'noteContent' } as Content,
    noteTable(
      ['Segment', 'Montant N', '% CA', 'Montant N-1'],
      [
        ['Usinage de pr\u00e9cision (CN 3 \u00e0 5 axes)', 1740000, '50\u00A0%', 1575000],
        ['M\u00e9cano-soudure et assemblage', 870000, '25\u00A0%', 819000],
        ['Sous-ensembles hydrauliques', 696000, '20\u00A0%', 630000],
        ['Pi\u00e8ces de rechange et maintenance', 174000, '5\u00A0%', 126000],
        ['Total', 3480000, '100\u00A0%', 3150000],
      ],
      ['*', 65, 40, 65],
    ),
    { text: 'La croissance est principalement port\u00e9e par le segment hydraulique (+10,5\u00A0%) gr\u00e2ce \u00e0 l\u2019obtention de deux contrats cadres pluriannuels avec des \u00e9quipementiers du secteur travaux publics, ainsi que par le d\u00e9veloppement du SAV et des pi\u00e8ces de rechange (+38\u00A0%).', style: 'noteContentSmall' } as Content,
  )

  // --- Note 11 ---
  notes.push(
    { text: 'Note 11 \u2014 Effectif moyen', style: 'noteTitle' } as Content,
    { text: 'L\u2019effectif moyen de l\u2019exercice s\u2019\u00e9l\u00e8ve \u00e0 45 salari\u00e9s (42 en N-1), r\u00e9partis comme suit :', style: 'noteContent' } as Content,
    noteTable(
      ['Cat\u00e9gorie', 'Effectif N', 'Effectif N-1'],
      [
        ['Op\u00e9rateurs CN et tourneurs-fraiseurs', 22, 21],
        ['Soudeurs qualifi\u00e9s', 8, 7],
        ['Techniciens m\u00e9thodes et programmation', 4, 4],
        ['Contr\u00f4le qualit\u00e9 et m\u00e9trologie', 3, 3],
        ['Logistique et magasin', 2, 2],
        ['Personnel administratif et commercial', 5, 4],
        ['Encadrement (direction, chefs d\u2019atelier)', 1, 1],
        ['Total', 45, 42],
      ],
      ['*', 55, 55],
    ),
    { text: 'Le recrutement de 3 collaborateurs suppl\u00e9mentaires (1 soudeur, 1 op\u00e9rateur CN et 1 assistant commercial) accompagne la mont\u00e9e en charge des nouveaux contrats hydrauliques.', style: 'noteContentSmall' } as Content,
  )

  // --- Note 12 ---
  notes.push(
    { text: 'Note 12 \u2014 Engagements hors bilan', style: 'noteTitle' } as Content,
    { text: 'Les engagements donn\u00e9s et re\u00e7us par la soci\u00e9t\u00e9 sont les suivants :', style: 'noteContent' } as Content,
    {
      ul: [
        { text: 'Cr\u00e9dit-bail sur centre d\u2019usinage 5 axes DMG Mori : redevance annuelle 42\u00A0000\u00A0EUR, engagement r\u00e9siduel 84\u00A0000\u00A0EUR (\u00e9ch\u00e9ance : d\u00e9cembre 2027).', style: 'noteContentSmall' },
        { text: 'Cr\u00e9dit-bail v\u00e9hicule utilitaire Renault Master : redevance annuelle 7\u00A0200\u00A0EUR, engagement r\u00e9siduel 14\u00A0400\u00A0EUR (\u00e9ch\u00e9ance : juin 2027).', style: 'noteContentSmall' },
        { text: 'Nantissement du fonds de commerce en garantie de l\u2019emprunt CIC (cf. Note 9).', style: 'noteContentSmall' },
        { text: 'Nantissement de mat\u00e9riel en garantie de l\u2019emprunt BPI France (cf. Note 9).', style: 'noteContentSmall' },
        { text: 'Aucun autre engagement significatif n\u2019a \u00e9t\u00e9 identifi\u00e9 \u00e0 la date de cl\u00f4ture.', style: 'noteContentSmall' },
      ],
      margin: [15, 3, 0, 0] as [number, number, number, number],
    } as Content,
  )

  // --- Note 13 --- PTG-005 SIGNAL (honoraires 45k → 148k, +229%, "divers" keyword, no "en raison de" / "du fait")
  notes.push(
    { text: 'Note 13 \u2014 D\u00e9tail des autres achats et charges externes', style: 'noteTitle' } as Content,
    { text: 'Le poste \u00ab\u00A0Autres achats et charges externes\u00A0\u00bb s\u2019\u00e9l\u00e8ve \u00e0 680\u00A0000\u00A0EUR (615\u00A0000\u00A0EUR en N-1) et se d\u00e9compose comme suit :', style: 'noteContent' } as Content,
    noteTable(
      ['Poste', 'Exercice N', 'Exercice N-1', 'Variation'],
      [
        ['Sous-traitance industrielle', 195000, 182000, '+7,1\u00A0%'],
        ['Locations immobili\u00e8res et mat\u00e9riel', 72000, 68000, '+5,9\u00A0%'],
        ['Entretien et r\u00e9parations machines', 48000, 42000, '+14,3\u00A0%'],
        ['Assurances', 28000, 26000, '+7,7\u00A0%'],
        ['Honoraires', 148000, 45000, '+228,9\u00A0%'],
        ['\u00c9nergie (\u00e9lectricit\u00e9, gaz industriel)', 62000, 58000, '+6,9\u00A0%'],
        ['Transport et d\u00e9placements', 35000, 32000, '+9,4\u00A0%'],
        ['Frais postaux et t\u00e9l\u00e9communications', 12000, 11000, '+9,1\u00A0%'],
        ['Services bancaires', 5000, 4500, '+11,1\u00A0%'],
        ['Fournitures non stock\u00e9es (EPI, outillage consommable)', 45000, 122000, '-63,1\u00A0%'],
        ['Autres', 30000, 25500, '+17,6\u00A0%'],
        ['Total', 680000, 615000, '+10,6\u00A0%'],
      ],
      ['*', 60, 60, 55],
    ),
    { text: 'Les honoraires comprennent les prestations de conseil divers n\u00e9cessaires \u00e0 l\u2019activit\u00e9 (accompagnement strat\u00e9gique, conseil juridique, assistance technique et certification qualit\u00e9).', style: 'noteContentSmall', italics: true } as Content,
  )

  // --- Note 14 ---
  notes.push(
    { text: 'Note 14 \u2014 \u00c9v\u00e9nements post\u00e9rieurs \u00e0 la cl\u00f4ture', style: 'noteTitle' } as Content,
    { text: 'Aucun \u00e9v\u00e9nement significatif post\u00e9rieur \u00e0 la cl\u00f4ture n\u2019est survenu \u00e0 la date d\u2019arr\u00eat\u00e9 des comptes. La soci\u00e9t\u00e9 a n\u00e9anmoins d\u00e9marr\u00e9 en janvier 2026 les travaux d\u2019extension du hall de m\u00e9cano-soudure, financ\u00e9s sur fonds propres et par un nouvel emprunt en cours de n\u00e9gociation.', style: 'noteContent' } as Content,
  )

  // --- Note 15 ---
  notes.push(
    { text: 'Note 15 \u2014 R\u00e9mun\u00e9ration des dirigeants', style: 'noteTitle' } as Content,
    { text: 'La r\u00e9mun\u00e9ration brute vers\u00e9e au Pr\u00e9sident au titre de l\u2019exercice s\u2019\u00e9l\u00e8ve \u00e0 96\u00A0000\u00A0EUR (92\u00A0000\u00A0EUR en N-1).', style: 'noteContent' } as Content,
    { text: 'Conform\u00e9ment aux dispositions l\u00e9gales, le montant global des r\u00e9mun\u00e9rations allou\u00e9es aux membres des organes de direction n\u2019est pas d\u00e9taill\u00e9 individuellement.', style: 'noteContentSmall', margin: [0, 2, 0, 0] } as Content,
  )

  // --- Legal closing ---
  notes.push(
    { text: '', margin: [0, 20, 0, 0] } as Content,
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.6, lineColor: BORDER_LIGHT }],
      margin: [0, 0, 0, 8] as [number, number, number, number],
    } as Content,
    { text: 'La pr\u00e9sente annexe, qui fait partie int\u00e9grante des comptes annuels, comporte 15 notes.', style: 'noteContent', alignment: 'center' as const } as Content,
    { text: '', margin: [0, 20, 0, 0] } as Content,
    {
      columns: [
        { text: '', width: '*' },
        {
          width: 'auto',
          stack: [
            { text: 'Arr\u00eat\u00e9 par le Pr\u00e9sident le 15 mars 2026', style: 'signatureLine' },
            { text: 'M. Laurent Rivetin, Pr\u00e9sident', style: 'signatureLine', margin: [0, 3, 0, 0] },
          ],
        },
      ],
    } as Content,
  )

  const docDef: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 55],
    header: {
      columns: [
        { text: 'Rivetin M\u00e9canique Industrielle SAS', fontSize: 9, bold: true, color: NAVY, margin: [40, 20, 0, 0] },
        { text: 'ANNEXE AUX COMPTES ANNUELS', alignment: 'right' as const, fontSize: 9, bold: true, color: NAVY, margin: [0, 20, 40, 0] },
      ],
    },
    footer: pageFooter('Annexe aux comptes annuels'),
    content: [
      companyHeader(),
      { text: '', margin: [0, 14, 0, 0] },
      { text: 'ANNEXE AUX COMPTES ANNUELS', style: 'mainTitle' },
      { text: 'EXERCICE CLOS LE 31 D\u00c9CEMBRE 2025', style: 'mainTitle', fontSize: 12 },
      { text: '(Montants exprim\u00e9s en euros sauf mention contraire)', style: 'subtitle', margin: [0, 2, 0, 0] },
      { text: '', margin: [0, 6, 0, 0] },
      ...notes,
    ],
    styles,
    defaultStyle: { font: 'Roboto' },
  }

  const buffer = await generatePdfBuffer(docDef)
  fs.writeFileSync(path.join(outputDir, filename), buffer)
  console.log(`  [Pointage] ${filename}`)
  return filename
}

// =============================================================================
// Main export
// =============================================================================

export async function generatePointageDocs(outputDir: string): Promise<{ count: number; outputDir: string }> {
  fs.mkdirSync(outputDir, { recursive: true })
  console.log(`\n[Pointage] G\u00e9n\u00e9ration des \u00e9tats financiers Rivetin M\u00e9canique Industrielle SAS...`)

  await Promise.all([
    generateBilan(outputDir),
    generateCompteResultat(outputDir),
    generateAnnexe(outputDir),
  ])

  console.log(`[Pointage] 3 documents g\u00e9n\u00e9r\u00e9s dans ${outputDir}`)
  return { count: 3, outputDir }
}

// Allow direct execution
if (require.main === module) {
  const outDir = path.join(process.cwd(), 'data', 'pointage')
  generatePointageDocs(outDir).catch((err) => {
    console.error('Erreur:', err)
    process.exit(1)
  })
}
