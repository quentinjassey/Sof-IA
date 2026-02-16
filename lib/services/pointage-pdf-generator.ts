// =============================================================================
// SOF'IA -- Generateur PDF pour les etats financiers (scenario Pointage)
// Genere 3 documents PDF : Bilan, Compte de resultat, Annexe
// Utilise pdfmake (meme pattern que checklist-generator.ts)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const PdfPrinter = require('pdfmake/src/printer') as any
import path from 'path'
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'
import type {
  PointageCompany,
  BilanLigne,
} from '@/lib/config/pointage-companies'

// -----------------------------------------------------------------------------
// Fonts (Roboto TTFs extracted from pdfmake vfs_fonts.js)
// -----------------------------------------------------------------------------

const fontDir = path.join(process.cwd(), 'fonts')
const fonts = {
  Roboto: {
    normal: path.join(fontDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf'),
  },
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Formate un nombre avec des espaces insécables comme séparateur de milliers (format français).
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

function generatePdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const printer = new PdfPrinter(fonts)
      const pdfDoc = printer.createPdfKitDocument(docDefinition)
      const chunks: Uint8Array[] = []
      pdfDoc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
      pdfDoc.on('error', reject)
      pdfDoc.end()
    } catch (err) {
      reject(err)
    }
  })
}

function companyHeader(company: PointageCompany): Content {
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: company.name, style: 'companyName' },
              { text: `${company.legal_form} au capital de ${fmt(company.capital_social)} EUR`, style: 'companyInfo' },
              { text: company.address, style: 'companyInfo' },
              { text: `SIRET : ${company.siret} — RCS ${company.rcs}`, style: 'companyInfo' },
              { text: `President : ${company.president}`, style: 'companyInfo' },
            ],
            margin: [10, 8, 10, 8] as [number, number, number, number],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => '#1e3a5f',
      vLineColor: () => '#1e3a5f',
    },
  } as Content
}

const baseStyles = {
  companyName: { fontSize: 14, bold: true, color: '#1e3a5f', alignment: 'center' as const },
  companyInfo: { fontSize: 9, color: '#475569', alignment: 'center' as const, margin: [0, 1, 0, 1] as [number, number, number, number] },
  mainTitle: { fontSize: 14, bold: true, color: '#1e3a5f', alignment: 'center' as const },
  subtitle: { fontSize: 10, color: '#64748b', alignment: 'center' as const },
  sectionTitle: { fontSize: 11, bold: true, color: '#1e3a5f', margin: [0, 10, 0, 5] as [number, number, number, number] },
  tableHeader: { fontSize: 8, bold: true, color: '#ffffff' },
  tableCell: { fontSize: 8, color: '#1e293b' },
  tableCellBold: { fontSize: 8, bold: true, color: '#1e293b' },
  totalRow: { fontSize: 9, bold: true, color: '#1e3a5f' },
  noteTitle: { fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 8, 0, 3] as [number, number, number, number] },
  noteContent: { fontSize: 9, color: '#1e293b', lineHeight: 1.3 },
  disclaimer: { fontSize: 7, color: '#94a3b8', italics: true },
  footerPage: { fontSize: 8, color: '#94a3b8' },
  signatureLine: { fontSize: 9, color: '#475569', italics: true },
}

// -----------------------------------------------------------------------------
// BILAN PDF
// -----------------------------------------------------------------------------

export async function generateBilanPdf(company: PointageCompany): Promise<Buffer> {
  const actif = company.bilan.actif
  const passif = company.bilan.passif

  function actifRow(ligne: BilanLigne, bold = false): TableCell[] {
    const style = bold ? 'tableCellBold' : 'tableCell'
    return [
      { text: ligne.label, style },
      { text: fmt(ligne.brut), style, alignment: 'right' as const },
      { text: fmt(ligne.amort), style, alignment: 'right' as const },
      { text: fmt(ligne.net), style, alignment: 'right' as const },
      { text: fmt(ligne.net_n1), style, alignment: 'right' as const },
    ]
  }

  function passifRow(ligne: BilanLigne, bold = false): TableCell[] {
    const style = bold ? 'tableCellBold' : 'tableCell'
    return [
      { text: ligne.label, style },
      { text: fmt(ligne.net), style, alignment: 'right' as const },
      { text: fmt(ligne.net_n1), style, alignment: 'right' as const },
    ]
  }

  // Calculate totals
  const actifValues = Object.values(actif)
  const totalActifBrut = actifValues.reduce((s, l) => s + l.brut, 0)
  const totalActifAmort = actifValues.reduce((s, l) => s + l.amort, 0)
  const totalActifNet = actifValues.reduce((s, l) => s + l.net, 0)
  const totalActifNetN1 = actifValues.reduce((s, l) => s + l.net_n1, 0)

  const passifValues = Object.values(passif)
  const totalPassifNet = passifValues.reduce((s, l) => s + l.net, 0)
  const totalPassifNetN1 = passifValues.reduce((s, l) => s + l.net_n1, 0)

  const actifTableBody: TableCell[][] = [
    [
      { text: 'ACTIF', style: 'tableHeader' },
      { text: 'Brut', style: 'tableHeader', alignment: 'right' as const },
      { text: 'Amort. / Dep.', style: 'tableHeader', alignment: 'right' as const },
      { text: 'Net N', style: 'tableHeader', alignment: 'right' as const },
      { text: 'Net N-1', style: 'tableHeader', alignment: 'right' as const },
    ],
    actifRow(actif.immobilisations_incorporelles),
    actifRow(actif.immobilisations_corporelles),
    actifRow(actif.immobilisations_financieres),
    actifRow(actif.stocks),
    actifRow(actif.creances_clients),
    actifRow(actif.autres_creances),
    actifRow(actif.disponibilites),
    actifRow(actif.charges_constatees_avance),
    [
      { text: 'TOTAL ACTIF', style: 'totalRow' },
      { text: fmt(totalActifBrut), style: 'totalRow', alignment: 'right' as const },
      { text: fmt(totalActifAmort), style: 'totalRow', alignment: 'right' as const },
      { text: fmt(totalActifNet), style: 'totalRow', alignment: 'right' as const },
      { text: fmt(totalActifNetN1), style: 'totalRow', alignment: 'right' as const },
    ],
  ]

  const passifTableBody: TableCell[][] = [
    [
      { text: 'PASSIF', style: 'tableHeader' },
      { text: 'Montant N', style: 'tableHeader', alignment: 'right' as const },
      { text: 'Montant N-1', style: 'tableHeader', alignment: 'right' as const },
    ],
    passifRow(passif.capital_social),
    passifRow(passif.reserves),
    passifRow(passif.resultat_exercice),
    passifRow(passif.report_nouveau),
    passifRow(passif.provisions_risques),
    passifRow(passif.emprunts_dettes_financieres),
    passifRow(passif.dettes_fournisseurs),
    passifRow(passif.dettes_fiscales_sociales),
    passifRow(passif.autres_dettes),
    passifRow(passif.produits_constates_avance),
    [
      { text: 'TOTAL PASSIF', style: 'totalRow' },
      { text: fmt(totalPassifNet), style: 'totalRow', alignment: 'right' as const },
      { text: fmt(totalPassifNetN1), style: 'totalRow', alignment: 'right' as const },
    ],
  ]

  const tableLayout = {
    hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
      i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
    vLineWidth: () => 0.5,
    hLineColor: (i: number) => (i <= 1 ? '#1e3a5f' : '#cccccc'),
    vLineColor: () => '#cccccc',
    fillColor: (i: number) => (i === 0 ? '#1e3a5f' : i % 2 === 0 ? '#f8f9fa' : null),
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 4,
    paddingBottom: () => 4,
  }

  const docDef: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 70],
    header: {
      columns: [
        { text: company.name, style: 'companyName', fontSize: 10, margin: [40, 20, 0, 0] },
        { text: 'BILAN', alignment: 'right', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 20, 40, 0] },
      ],
    },
    footer: (currentPage: number, pageCount: number): Content => ({
      stack: [
        { text: `Exercice clos le 31/12/2025 — ${company.name}`, style: 'disclaimer', alignment: 'center', margin: [40, 0, 40, 3] },
        { text: `Page ${currentPage} / ${pageCount}`, alignment: 'center', style: 'footerPage' },
      ],
    }),
    content: [
      companyHeader(company),
      { text: '', margin: [0, 12, 0, 0] },
      { text: 'BILAN AU 31 DECEMBRE 2025', style: 'mainTitle' },
      { text: '(en euros)', style: 'subtitle' },
      { text: '', margin: [0, 12, 0, 0] },
      { text: 'ACTIF', style: 'sectionTitle' },
      {
        table: { headerRows: 1, widths: ['*', 70, 70, 70, 70], body: actifTableBody },
        layout: tableLayout,
      } as Content,
      { text: '', margin: [0, 15, 0, 0] },
      { text: 'PASSIF', style: 'sectionTitle' },
      {
        table: { headerRows: 1, widths: ['*', 90, 90], body: passifTableBody },
        layout: tableLayout,
      } as Content,
      { text: '', margin: [0, 20, 0, 0] },
      { text: `Arrete par ${company.president} le 15 mars 2026`, style: 'signatureLine', alignment: 'right' },
    ],
    styles: baseStyles,
    defaultStyle: { font: 'Roboto' },
  }

  return generatePdfBuffer(docDef)
}

// -----------------------------------------------------------------------------
// COMPTE DE RESULTAT PDF
// -----------------------------------------------------------------------------

export async function generateCompteResultatPdf(company: PointageCompany): Promise<Buffer> {
  const cr = company.compte_resultat

  function crRow(ligne: { label: string; montant: number; montant_n1: number }, bold = false): TableCell[] {
    const style = bold ? 'tableCellBold' : 'tableCell'
    return [
      { text: ligne.label, style },
      { text: fmt(ligne.montant), style, alignment: 'right' as const },
      { text: fmt(ligne.montant_n1), style, alignment: 'right' as const },
    ]
  }

  function totalLine(label: string, n: number, n1: number): TableCell[] {
    return [
      { text: label, style: 'totalRow' },
      { text: fmt(n), style: 'totalRow', alignment: 'right' as const },
      { text: fmt(n1), style: 'totalRow', alignment: 'right' as const },
    ]
  }

  const tableBody: TableCell[][] = [
    [
      { text: 'Poste', style: 'tableHeader' },
      { text: 'Exercice N', style: 'tableHeader', alignment: 'right' as const },
      { text: 'Exercice N-1', style: 'tableHeader', alignment: 'right' as const },
    ],
    // Section exploitation
    [{ text: 'PRODUITS D\'EXPLOITATION', style: 'tableCellBold', colSpan: 3 }, {}, {}],
    ...cr.produits_exploitation.map((l) => crRow(l)),
    [{ text: '', colSpan: 3 }, {}, {}],
    [{ text: 'CHARGES D\'EXPLOITATION', style: 'tableCellBold', colSpan: 3 }, {}, {}],
    ...cr.charges_exploitation.map((l) => crRow(l)),
    totalLine('RESULTAT D\'EXPLOITATION', cr.resultat_exploitation, cr.resultat_exploitation_n1),
    [{ text: '', colSpan: 3 }, {}, {}],
    // Section financiere
    [{ text: 'PRODUITS FINANCIERS', style: 'tableCellBold', colSpan: 3 }, {}, {}],
    ...cr.produits_financiers.map((l) => crRow(l)),
    [{ text: 'CHARGES FINANCIERES', style: 'tableCellBold', colSpan: 3 }, {}, {}],
    ...cr.charges_financieres.map((l) => crRow(l)),
    totalLine('RESULTAT FINANCIER', cr.resultat_financier, cr.resultat_financier_n1),
    [{ text: '', colSpan: 3 }, {}, {}],
    // Section exceptionnelle
    [{ text: 'PRODUITS EXCEPTIONNELS', style: 'tableCellBold', colSpan: 3 }, {}, {}],
    ...cr.produits_exceptionnels.map((l) => crRow(l)),
    [{ text: 'CHARGES EXCEPTIONNELLES', style: 'tableCellBold', colSpan: 3 }, {}, {}],
    ...cr.charges_exceptionnelles.map((l) => crRow(l)),
    totalLine('RESULTAT EXCEPTIONNEL', cr.resultat_exceptionnel, cr.resultat_exceptionnel_n1),
    [{ text: '', colSpan: 3 }, {}, {}],
    crRow({ label: 'Impot sur les benefices', montant: cr.impot_benefices, montant_n1: cr.impot_benefices_n1 }),
    [{ text: '', colSpan: 3 }, {}, {}],
    totalLine('RESULTAT NET DE L\'EXERCICE', cr.resultat_net, cr.resultat_net_n1),
  ]

  const tableLayout = {
    hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
      i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.3,
    vLineWidth: () => 0.3,
    hLineColor: (i: number) => (i <= 1 ? '#1e3a5f' : '#e2e8f0'),
    vLineColor: () => '#e2e8f0',
    fillColor: (i: number) => (i === 0 ? '#1e3a5f' : null),
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 3,
    paddingBottom: () => 3,
  }

  const docDef: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 70],
    header: {
      columns: [
        { text: company.name, fontSize: 10, bold: true, color: '#1e3a5f', margin: [40, 20, 0, 0] },
        { text: 'COMPTE DE RESULTAT', alignment: 'right', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 20, 40, 0] },
      ],
    },
    footer: (currentPage: number, pageCount: number): Content => ({
      stack: [
        { text: `Exercice clos le 31/12/2025 — ${company.name}`, style: 'disclaimer', alignment: 'center', margin: [40, 0, 40, 3] },
        { text: `Page ${currentPage} / ${pageCount}`, alignment: 'center', style: 'footerPage' },
      ],
    }),
    content: [
      companyHeader(company),
      { text: '', margin: [0, 12, 0, 0] },
      { text: 'COMPTE DE RESULTAT', style: 'mainTitle' },
      { text: 'Exercice clos le 31 decembre 2025 (en euros)', style: 'subtitle' },
      { text: '', margin: [0, 12, 0, 0] },
      {
        table: { headerRows: 1, widths: ['*', 90, 90], body: tableBody },
        layout: tableLayout,
      } as Content,
      { text: '', margin: [0, 20, 0, 0] },
      { text: `Arrete par ${company.president} le 15 mars 2026`, style: 'signatureLine', alignment: 'right' },
    ],
    styles: baseStyles,
    defaultStyle: { font: 'Roboto' },
  }

  return generatePdfBuffer(docDef)
}

// -----------------------------------------------------------------------------
// ANNEXE PDF
// -----------------------------------------------------------------------------

export async function generateAnnexePdf(company: PointageCompany): Promise<Buffer> {
  const noteContents: Content[] = []
  for (const note of company.annexe) {
    noteContents.push(
      { text: `Note ${note.numero} — ${note.titre}`, style: 'noteTitle' } as Content,
      { text: note.contenu, style: 'noteContent' } as Content,
    )
    if (note.montants) {
      const montantLines = Object.entries(note.montants)
        .map(([k, v]) => `${k.replace(/_/g, ' ')} : ${fmt(v)} EUR`)
        .join('\n')
      noteContents.push({ text: montantLines, style: 'noteContent', margin: [15, 3, 0, 5] as [number, number, number, number] } as Content)
    }
  }

  const docDef: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 70],
    header: {
      columns: [
        { text: company.name, fontSize: 10, bold: true, color: '#1e3a5f', margin: [40, 20, 0, 0] },
        { text: 'ANNEXE AUX COMPTES ANNUELS', alignment: 'right', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 20, 40, 0] },
      ],
    },
    footer: (currentPage: number, pageCount: number): Content => ({
      stack: [
        { text: `Exercice clos le 31/12/2025 — ${company.name}`, style: 'disclaimer', alignment: 'center', margin: [40, 0, 40, 3] },
        { text: `Page ${currentPage} / ${pageCount}`, alignment: 'center', style: 'footerPage' },
      ],
    }),
    content: [
      companyHeader(company),
      { text: '', margin: [0, 12, 0, 0] },
      { text: 'ANNEXE AUX COMPTES ANNUELS', style: 'mainTitle' },
      { text: 'Exercice clos le 31 decembre 2025', style: 'subtitle' },
      { text: '', margin: [0, 8, 0, 0] },
      ...noteContents,
      { text: '', margin: [0, 20, 0, 0] },
      { text: `Arrete par ${company.president} le 15 mars 2026`, style: 'signatureLine', alignment: 'right' },
    ],
    styles: baseStyles,
    defaultStyle: { font: 'Roboto' },
  }

  return generatePdfBuffer(docDef)
}

// -----------------------------------------------------------------------------
// Generate all 3 PDFs
// -----------------------------------------------------------------------------

export async function generateAllPointagePdfs(company: PointageCompany): Promise<{
  bilan: Buffer
  cr: Buffer
  annexe: Buffer
}> {
  const [bilan, cr, annexe] = await Promise.all([
    generateBilanPdf(company),
    generateCompteResultatPdf(company),
    generateAnnexePdf(company),
  ])
  return { bilan, cr, annexe }
}
