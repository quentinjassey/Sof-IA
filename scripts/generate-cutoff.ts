// =============================================================================
// SOF'IA — Generation des documents de demonstration pour le scenario Cut-Off
// Entreprise : Rivetin Mecanique Industrielle SAS (Venissieux)
// Usage: npx tsx scripts/generate-cutoff.ts
// =============================================================================

import fs from 'fs'
import path from 'path'
import {
  RIVETIN,
  type CompanyInfo,
  type InvoiceData,
  type InvoiceLine,
  type DeliveryNoteData,
  type TDocumentDefinitions,
  type Content,
  type TableCell,
  fonts,
  fmt,
  fmtInt,
  fmtFec,
  fmtDate,
  toFecDate,
  generatePdfBuffer,
  baseStyles,
  invoiceTableLayout,
  infoTableLayout,
  boxLayout,
  buildCompanyHeader,
  buildClientBox,
  buildBankingBlock,
  buildLegalConditions,
  buildLegalFooter,
} from './pdf-helpers'

// =============================================================================
// Sales Invoices
// =============================================================================

const invoiceFA1244: InvoiceData = {
  ref: 'FA-2025-1244',
  type: 'vente',
  date: '2025-12-22',
  client_or_supplier: 'Precimetal SA',
  client_code: 'C0501',
  address: '27 rue de la Metallurgie',
  address_line2: '69400 Villefranche-sur-Saone',
  siret: '412 789 654 00032',
  tva_intra: 'FR 17 412789654',
  order_ref: 'CMD-PM-2025-0843',
  lines: [
    { ref: 'UC-3410', description: 'Pieces usinees CN tournage — Axes inox A4 dia. 45 mm', detail: 'Lot de 120 pieces, tolerance H7, finition Ra 0.8', quantity: 120, unit: 'pieces', unit_price_ht: 78, total_ht: 9360 },
    { ref: 'UC-3425', description: 'Brides de serrage acier S355 — Fraisage 5 axes', detail: 'Serie 60 pieces, percage et taraudage M10', quantity: 60, unit: 'pieces', unit_price_ht: 145, total_ht: 8700 },
    { ref: 'UC-3440', description: 'Paliers aluminium AU4G — Usinage complet', detail: 'Lot 40 pieces, alesage H6, surfacage', quantity: 40, unit: 'pieces', unit_price_ht: 198, total_ht: 7920 },
  ],
  total_ht: 25980,
  tva_rate: 20,
  tva_amount: 5196,
  total_ttc: 31176,
  payment_terms: '30 jours date de facture',
  payment_mode: 'Virement bancaire',
  due_date: '2026-01-21',
  linked_bl_ref: 'BL-2025-0845',
}

const invoiceFA1245: InvoiceData = {
  ref: 'FA-2025-1245',
  type: 'vente',
  date: '2025-12-26',
  client_or_supplier: 'Hydraulique Systemes SARL',
  client_code: 'C0502',
  address: '12 chemin des Hydrauliciens',
  address_line2: '69800 Saint-Priest',
  siret: '523 891 234 00018',
  tva_intra: 'FR 43 523891234',
  order_ref: 'CMD-HS-2025-0217',
  lines: [
    { ref: 'HY-2010', description: 'Sous-ensemble hydraulique — Bloc distributeur 4 voies', detail: 'Usinage corps fonte, montage joints et raccords', quantity: 8, unit: 'ensembles', unit_price_ht: 1250, total_ht: 10000 },
    { ref: 'HY-2025', description: 'Verins hydrauliques double effet — Course 250 mm', detail: 'Alesage dia. 80 mm, tige chrome dur dia. 45 mm', quantity: 12, unit: 'pieces', unit_price_ht: 685, total_ht: 8220 },
  ],
  total_ht: 18220,
  tva_rate: 20,
  tva_amount: 3644,
  total_ttc: 21864,
  payment_terms: '30 jours fin de mois',
  payment_mode: 'Virement bancaire',
  due_date: '2026-01-31',
  // NO linked BL — intentional (CUT-004)
}

const invoiceFA1246: InvoiceData = {
  ref: 'FA-2025-1246',
  type: 'vente',
  date: '2025-12-28',
  client_or_supplier: 'Precimetal SA',
  client_code: 'C0501',
  address: '27 rue de la Metallurgie',
  address_line2: '69400 Villefranche-sur-Saone',
  siret: '412 789 654 00032',
  tva_intra: 'FR 17 412789654',
  order_ref: 'CMD-PM-2025-0851',
  lines: [
    { ref: 'MS-5100', description: 'Chassis mecano-soude acier S355 — Structure support', detail: 'Soudure TIG/MIG, dimensions 1200x800x600 mm, controle CND', quantity: 4, unit: 'ensembles', unit_price_ht: 3450, total_ht: 13800 },
    { ref: 'MS-5115', description: 'Platines de fixation soudees — Epaisseur 20 mm', detail: 'Acier S355, decoupe laser + soudure, lot de 24', quantity: 24, unit: 'pieces', unit_price_ht: 185, total_ht: 4440 },
    { ref: 'UC-3460', description: 'Entretoises tournees inox A4 — Dia. 30 x L. 80 mm', detail: 'Lot 200 pieces, tolerance h8', quantity: 200, unit: 'pieces', unit_price_ht: 42, total_ht: 8400 },
    { ref: 'UC-3475', description: 'Axes de guidage rectifies — Chrome dur dia. 25 mm', detail: 'Longueur 350 mm, Ra 0.4, lot 50 pieces', quantity: 50, unit: 'pieces', unit_price_ht: 118, total_ht: 5900 },
  ],
  total_ht: 32540,
  tva_rate: 20,
  tva_amount: 6508,
  total_ttc: 39048,
  payment_terms: '30 jours date de facture',
  payment_mode: 'Virement bancaire',
  due_date: '2026-01-27',
  linked_bl_ref: 'BL-2025-0846',
}

const invoiceFA1247: InvoiceData = {
  ref: 'FA-2025-1247',
  type: 'vente',
  date: '2025-12-29',
  client_or_supplier: 'Hydraulique Systemes SARL',
  client_code: 'C0502',
  address: '12 chemin des Hydrauliciens',
  address_line2: '69800 Saint-Priest',
  siret: '523 891 234 00018',
  tva_intra: 'FR 43 523891234',
  order_ref: 'CMD-HS-2025-0224',
  lines: [
    { ref: 'HY-2040', description: 'Distributeurs hydrauliques 3/2 — Corps usine aluminium', detail: 'Lot 6 distributeurs, alesage de precision, test etancheite', quantity: 6, unit: 'pieces', unit_price_ht: 1480, total_ht: 8880 },
    { ref: 'HY-2055', description: 'Raccords haute pression — Filetage BSP 1/2"', detail: 'Acier zingue, lot 80 raccords assortis', quantity: 80, unit: 'pieces', unit_price_ht: 34, total_ht: 2720 },
  ],
  total_ht: 11600,
  tva_rate: 20,
  tva_amount: 2320,
  total_ttc: 13920,
  payment_terms: '30 jours fin de mois',
  payment_mode: 'Virement bancaire',
  due_date: '2026-01-31',
  linked_bl_ref: 'BL-2025-0847',
}

// =============================================================================
// Credit Note (Avoir) — CUT-005: avoir 2026 referencing 2025 sale
// =============================================================================

const avoirAV0012: InvoiceData = {
  ref: 'AV-2026-0012',
  type: 'avoir',
  date: '2026-01-12',
  client_or_supplier: 'Hydraulique Systemes SARL',
  client_code: 'C0502',
  address: '12 chemin des Hydrauliciens',
  address_line2: '69800 Saint-Priest',
  siret: '523 891 234 00018',
  tva_intra: 'FR 43 523891234',
  lines: [
    { ref: 'HY-2010', description: 'Retour sous-ensembles hydrauliques — non-conformite joints', detail: '2 blocs distributeurs avec defaut d\'etancheite', quantity: 2, unit: 'ensembles', unit_price_ht: 1250, total_ht: 2500 },
    { ref: 'HY-2025', description: 'Retour verins hydrauliques — course non conforme', detail: '3 verins hors tolerance, course mesuree 248 mm au lieu de 250 mm', quantity: 3, unit: 'pieces', unit_price_ht: 685, total_ht: 2055 },
  ],
  total_ht: 4555,
  tva_rate: 20,
  tva_amount: 911,
  total_ttc: 5466,
  payment_terms: 'Avoir a imputer',
  payment_mode: 'Imputation sur compte client',
  due_date: '2026-01-12',
  linked_invoice: 'FA-2025-1245',
  note: 'Retour partiel de marchandises — avoir sur facture FA-2025-1245 du 26/12/2025. Non-conformite constatee a la reception.',
}

// =============================================================================
// Purchase Invoices
// =============================================================================

const invoiceFRN0480: InvoiceData = {
  ref: 'FRN-2025-0480',
  type: 'achat',
  date: '2025-12-23',
  client_or_supplier: 'Fonderies du Rhone SA',
  client_code: 'F0301',
  address: '45 route de l\'Industrie',
  address_line2: '69700 Givors',
  siret: '312 654 987 00041',
  tva_intra: 'FR 56 312654987',
  lines: [
    { ref: 'FO-8010', description: 'Bruts de fonderie fonte GS — Corps de verin', detail: 'Lot 30 pieces, fonderie centrifuge, controle US', quantity: 30, unit: 'pieces', unit_price_ht: 285, total_ht: 8550 },
    { ref: 'FO-8025', description: 'Bruts de fonderie aluminium — Corps de distributeur', detail: 'Lot 20 pieces, moulage coquille, X-ray', quantity: 20, unit: 'pieces', unit_price_ht: 195, total_ht: 3900 },
    { ref: 'FO-8040', description: 'Pieces de fonderie bronze — Bagues et douilles', detail: 'Lot 100 pieces, alliage CuSn12, dim. assorties', quantity: 100, unit: 'pieces', unit_price_ht: 42, total_ht: 4200 },
  ],
  total_ht: 16650,
  tva_rate: 20,
  tva_amount: 3330,
  total_ttc: 19980,
  payment_terms: '60 jours date de facture',
  payment_mode: 'Virement bancaire',
  due_date: '2026-02-21',
  linked_bl_ref: 'BR-2025-0480',
}

const invoiceFRN0481: InvoiceData = {
  ref: 'FRN-2025-0481',
  type: 'achat',
  date: '2025-12-30',
  client_or_supplier: 'Aciers Speciaux Lyon SAS',
  client_code: 'F0302',
  address: '8 boulevard de la Siderurgie',
  address_line2: '69330 Meyzieu',
  siret: '423 987 123 00053',
  tva_intra: 'FR 78 423987123',
  lines: [
    { ref: 'AC-9010', description: 'Barres rondes acier S355 — Dia. 45 mm, longueur 3 m', detail: 'Lot 50 barres, certificat matiere 3.1', quantity: 50, unit: 'barres', unit_price_ht: 87, total_ht: 4350 },
    { ref: 'AC-9025', description: 'Toles aluminium AU4G — Epaisseur 20 mm, format 2000x1000', detail: 'Lot 15 toles, qualite aeronautique', quantity: 15, unit: 'toles', unit_price_ht: 310, total_ht: 4650 },
  ],
  total_ht: 9000,
  tva_rate: 20,
  tva_amount: 1800,
  total_ttc: 10800,
  payment_terms: '30 jours date de facture',
  payment_mode: 'Virement bancaire',
  due_date: '2026-01-29',
  linked_bl_ref: 'BR-2025-0481',
}

// =============================================================================
// Delivery Notes (BL)
// =============================================================================

const blBL0845: DeliveryNoteData = {
  ref: 'BL-2025-0845',
  type: 'livraison',
  date_expedition: '2025-12-20',
  date_delivery: '2025-12-22',
  order_ref: 'CMD-PM-2025-0843',
  linked_invoice: 'FA-2025-1244',
  recipient_or_supplier: 'Precimetal SA',
  address: '27 rue de la Metallurgie',
  address_line2: '69400 Villefranche-sur-Saone',
  contact: 'M. Philippe Durand',
  phone: '04 74 62 33 18',
  transporter: 'Geodis Calberson',
  tracking_number: 'GDS-2025-LY-44218',
  weight: '380 kg',
  packaging: '2 palettes',
  items: [
    { ref: 'UC-3410', description: 'Pieces usinees CN tournage — Axes inox A4 dia. 45 mm', quantity: '120', unit: 'pieces' },
    { ref: 'UC-3425', description: 'Brides de serrage acier S355 — Fraisage 5 axes', quantity: '60', unit: 'pieces' },
    { ref: 'UC-3440', description: 'Paliers aluminium AU4G — Usinage complet', quantity: '40', unit: 'pieces' },
  ],
  received_by: 'M. Philippe Durand (responsable reception)',
  observations: 'Marchandise conforme. Controle quantitatif OK, PV de controle dimensionnel fourni.',
}

// BL for FA-2025-1245 intentionally NOT generated → triggers CUT-004

const blBL0846: DeliveryNoteData = {
  ref: 'BL-2025-0846',
  type: 'livraison',
  date_expedition: '2025-12-27',
  date_delivery: '2025-12-28',
  order_ref: 'CMD-PM-2025-0851',
  linked_invoice: 'FA-2025-1246',
  recipient_or_supplier: 'Precimetal SA',
  address: '27 rue de la Metallurgie',
  address_line2: '69400 Villefranche-sur-Saone',
  contact: 'M. Philippe Durand',
  phone: '04 74 62 33 18',
  transporter: 'XPO Logistics',
  tracking_number: 'XPO-2025-FR-87654',
  weight: '1 420 kg',
  packaging: '3 palettes + 1 caisse bois',
  items: [
    { ref: 'MS-5100', description: 'Chassis mecano-soude acier S355 — Structure support', quantity: '4', unit: 'ensembles' },
    { ref: 'MS-5115', description: 'Platines de fixation soudees — Epaisseur 20 mm', quantity: '24', unit: 'pieces' },
    { ref: 'UC-3460', description: 'Entretoises tournees inox A4 — Dia. 30 x L. 80 mm', quantity: '200', unit: 'pieces' },
    { ref: 'UC-3475', description: 'Axes de guidage rectifies — Chrome dur dia. 25 mm', quantity: '50', unit: 'pieces' },
  ],
  received_by: 'M. Philippe Durand (responsable reception)',
  observations: 'Livraison complete, 3 palettes filmees + 1 caisse bois. Controle quantitatif conforme.',
}

const blBL0847: DeliveryNoteData = {
  ref: 'BL-2025-0847',
  type: 'livraison',
  date_expedition: '2025-12-30',
  date_delivery: '2026-01-03', // CUT-001: delivery AFTER year-end
  order_ref: 'CMD-HS-2025-0224',
  linked_invoice: 'FA-2025-1247',
  recipient_or_supplier: 'Hydraulique Systemes SARL',
  address: '12 chemin des Hydrauliciens',
  address_line2: '69800 Saint-Priest',
  contact: 'M. Laurent Fabre',
  phone: '04 78 21 65 43',
  transporter: 'TNT Express',
  tracking_number: 'TNT-2025-FR-32891',
  weight: '195 kg',
  packaging: '2 caisses bois',
  items: [
    { ref: 'HY-2040', description: 'Distributeurs hydrauliques 3/2 — Corps usine aluminium', quantity: '6', unit: 'pieces' },
    { ref: 'HY-2055', description: 'Raccords haute pression — Filetage BSP 1/2"', quantity: '80', unit: 'pieces' },
  ],
  received_by: 'M. Laurent Fabre (responsable atelier montage)',
  observations: 'Livraison differee — fermeture site destinataire du 31/12 au 02/01 inclus.',
}

// =============================================================================
// Reception Notes (BR)
// =============================================================================

const brBR0480: DeliveryNoteData = {
  ref: 'BR-2025-0480',
  type: 'reception',
  date_delivery: '2025-12-23',
  order_ref: 'CDE-FR-2025-1180',
  linked_invoice: 'FRN-2025-0480',
  recipient_or_supplier: 'Fonderies du Rhone SA',
  address: '45 route de l\'Industrie',
  address_line2: '69700 Givors',
  contact: 'Service reception Rivetin — M. Yannick Morel',
  transporter: 'Transporteur fournisseur',
  weight: '850 kg',
  packaging: '2 palettes',
  items: [
    { ref: 'FO-8010', description: 'Bruts de fonderie fonte GS — Corps de verin', quantity: '30', unit: 'pieces' },
    { ref: 'FO-8025', description: 'Bruts de fonderie aluminium — Corps de distributeur', quantity: '20', unit: 'pieces' },
    { ref: 'FO-8040', description: 'Pieces de fonderie bronze — Bagues et douilles', quantity: '100', unit: 'pieces' },
  ],
  received_by: 'M. Yannick Morel (responsable magasin)',
  observations: 'Marchandise conforme au bon de commande. Certificats matiere fournis. RAS.',
}

const brBR0481: DeliveryNoteData = {
  ref: 'BR-2025-0481',
  type: 'reception',
  date_delivery: '2025-12-30',
  order_ref: 'CDE-ASL-2025-1195',
  linked_invoice: 'FRN-2025-0481',
  recipient_or_supplier: 'Aciers Speciaux Lyon SAS',
  address: '8 boulevard de la Siderurgie',
  address_line2: '69330 Meyzieu',
  contact: 'Service reception — M. Yannick Morel',
  transporter: 'Livraison directe fournisseur',
  items: [
    { ref: 'AC-9010', description: 'Barres rondes acier S355 — Dia. 45 mm, longueur 3 m', quantity: '50', unit: 'barres' },
    { ref: 'AC-9025', description: 'Toles aluminium AU4G — Epaisseur 20 mm, format 2000x1000', quantity: '15', unit: 'toles' },
  ],
  received_by: 'M. Yannick Morel (responsable magasin)',
  observations: 'Reception conforme. Certificats matiere 3.1 fournis pour l\'acier et l\'aluminium.',
}

// =============================================================================
// PDF: Invoice / Credit Note / Purchase Invoice
// =============================================================================

function buildInvoicePdf(invoice: InvoiceData): TDocumentDefinitions {
  const isAchat = invoice.type === 'achat'
  const isAvoir = invoice.type === 'avoir'

  const titleText = isAvoir
    ? 'AVOIR'
    : isAchat
      ? 'FACTURE FOURNISSEUR'
      : 'FACTURE DE VENTE'

  const titleColor = isAvoir ? '#b91c1c' : '#2c3e6b'

  // Build line items table
  const headerRow: TableCell[] = [
    { text: 'Ref.', style: 'tableHeader' },
    { text: 'Designation', style: 'tableHeader' },
    { text: 'Qte', style: 'tableHeader', alignment: 'right' },
    { text: 'Unite', style: 'tableHeader' },
    { text: 'P.U. HT', style: 'tableHeader', alignment: 'right' },
    { text: 'Total HT', style: 'tableHeader', alignment: 'right' },
  ]

  const itemRows: TableCell[][] = invoice.lines.map((line) => {
    const descStack: Content[] = [{ text: line.description, style: 'tableCell' }]
    if (line.detail) {
      descStack.push({ text: line.detail, style: 'tableCell', color: '#888888', fontSize: 6.5, italics: true })
    }
    return [
      { text: line.ref, style: 'tableCell', fontSize: 7 },
      { stack: descStack },
      { text: line.quantity.toString(), style: 'tableCellRight' },
      { text: line.unit || 'u.', style: 'tableCell' },
      { text: `${fmt(line.unit_price_ht)} EUR`, style: 'tableCellRight' },
      { text: `${fmt(line.total_ht)} EUR`, style: 'tableCellRight' },
    ]
  })

  // Totals
  const sign = isAvoir ? '-' : ''
  const totalsTable: Content = {
    table: {
      widths: ['*', 120],
      body: [
        [
          { text: 'Total HT', style: 'label', alignment: 'right' },
          { text: `${sign}${fmt(invoice.total_ht)} EUR`, style: 'tableCellBold', alignment: 'right' },
        ],
        [
          { text: `TVA ${invoice.tva_rate}%`, style: 'label', alignment: 'right' },
          { text: `${sign}${fmt(invoice.tva_amount)} EUR`, style: 'tableCellRight' },
        ],
        [
          { text: isAvoir ? 'Net a deduire TTC' : 'Total TTC', style: 'totalRow', alignment: 'right', fontSize: 10 },
          { text: `${sign}${fmt(invoice.total_ttc)} EUR`, style: 'totalRow', alignment: 'right', fontSize: 10 },
        ],
      ],
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
        i === node.table.body.length - 1 || i === node.table.body.length ? 0.8 : 0.3,
      vLineWidth: () => 0,
      hLineColor: (i: number, node: { table: { body: unknown[][] } }) =>
        i >= node.table.body.length - 1 ? '#1a1a2e' : '#eeeeee',
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 8, 0, 0] as [number, number, number, number],
  }

  // Info rows
  const infoRows: TableCell[][] = [
    [
      { text: isAchat ? 'N\u00b0 Facture fournisseur' : 'N\u00b0 Facture', style: 'label' },
      { text: invoice.ref, style: 'value' },
      { text: 'Date', style: 'label' },
      { text: fmtDate(invoice.date), style: 'value' },
    ],
  ]
  if (invoice.order_ref) {
    infoRows.push([
      { text: 'N\u00b0 Commande', style: 'label' },
      { text: invoice.order_ref, style: 'value' },
      { text: '', style: 'value' },
      { text: '', style: 'value' },
    ])
  }
  if (invoice.linked_bl_ref) {
    infoRows.push([
      { text: isAchat ? 'Bon de reception' : 'Bon de livraison', style: 'label' },
      { text: invoice.linked_bl_ref, style: 'value' },
      { text: '', style: 'value' },
      { text: '', style: 'value' },
    ])
  }
  if (invoice.linked_invoice) {
    infoRows.push([
      { text: 'Facture de reference', style: 'label' },
      { text: invoice.linked_invoice, style: 'value' },
      { text: '', style: 'value' },
      { text: '', style: 'value' },
    ])
  }
  infoRows.push([
    { text: 'Echeance', style: 'label' },
    { text: fmtDate(invoice.due_date), style: 'value' },
    { text: 'Reglement', style: 'label' },
    { text: invoice.payment_mode, style: 'value' },
  ])

  // Body
  const body: Content[] = [
    // Company header + client box
    {
      columns: [
        { width: '50%', ...buildCompanyHeader(RIVETIN) as object },
        { width: '50%', ...buildClientBox(invoice, isAchat) as object },
      ],
      columnGap: 20,
      margin: [0, 0, 0, 15] as [number, number, number, number],
    },
    // Title
    { text: titleText, style: 'mainTitle', color: titleColor, margin: [0, 5, 0, 3] as [number, number, number, number] },
    { text: `N\u00b0 ${invoice.ref}  —  ${fmtDate(invoice.date)}`, style: 'subtitle', margin: [0, 0, 0, 12] as [number, number, number, number] },
  ]

  // Note for avoir
  if (isAvoir && invoice.note) {
    body.push({
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'MOTIF DE L\'AVOIR', style: 'label', margin: [8, 5, 8, 3] as [number, number, number, number] },
            { text: invoice.note, style: 'value', margin: [8, 0, 8, 5] as [number, number, number, number] },
          ],
        }]],
      },
      layout: { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => '#e8c4c4', vLineColor: () => '#e8c4c4' },
      margin: [0, 0, 0, 10] as [number, number, number, number],
    } as Content)
  }

  // Info table
  body.push({
    table: { widths: [110, '*', 80, '*'], body: infoRows },
    layout: infoTableLayout,
    margin: [0, 0, 0, 12] as [number, number, number, number],
  } as Content)

  // Line items
  body.push({
    table: {
      headerRows: 1,
      widths: [40, '*', 30, 40, 65, 70],
      body: [headerRow, ...itemRows],
    },
    layout: invoiceTableLayout,
  } as Content)

  // Totals
  body.push(totalsTable)

  // Banking + conditions
  if (!isAvoir) {
    body.push({ text: '', margin: [0, 8, 0, 0] as [number, number, number, number] } as Content)
    body.push(buildBankingBlock(RIVETIN))
    body.push(buildLegalConditions(invoice.payment_terms, invoice.payment_mode))
  }

  // Footer
  body.push(buildLegalFooter(RIVETIN))

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content: body,
    styles: baseStyles,
    defaultStyle: { font: 'Roboto', fontSize: 8 },
  }
}

// =============================================================================
// PDF: Delivery / Reception Note
// =============================================================================

function buildDeliveryNotePdf(note: DeliveryNoteData): TDocumentDefinitions {
  const isReception = note.type === 'reception'
  const titleText = isReception ? 'BON DE RECEPTION' : 'BON DE LIVRAISON'

  // Item table
  const headerRow: TableCell[] = [
    { text: 'Ref.', style: 'tableHeader' },
    { text: 'Designation', style: 'tableHeader' },
    { text: 'Quantite', style: 'tableHeader', alignment: 'right' },
    { text: 'Unite', style: 'tableHeader' },
  ]

  const itemRows: TableCell[][] = note.items.map((item) => [
    { text: item.ref, style: 'tableCell', fontSize: 7 },
    { text: item.description, style: 'tableCell' },
    { text: item.quantity, style: 'tableCellRight' },
    { text: item.unit, style: 'tableCell' },
  ])

  // Recipient / Supplier box
  const recipientLabel = isReception ? 'FOURNISSEUR' : 'DESTINATAIRE'
  const recipientBox: Content = {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: recipientLabel, style: 'label', margin: [8, 6, 8, 3] as [number, number, number, number] },
          { text: note.recipient_or_supplier, style: 'tableCellBold', fontSize: 9, margin: [8, 0, 8, 2] as [number, number, number, number] },
          { text: note.address, style: 'tableCell', margin: [8, 0, 8, 1] as [number, number, number, number] },
          ...(note.address_line2 ? [{ text: note.address_line2, style: 'tableCell', margin: [8, 0, 8, 1] as [number, number, number, number] }] : []),
          { text: `Contact : ${note.contact}`, style: 'tableCell', margin: [8, 0, 8, 1] as [number, number, number, number] },
          ...(note.phone ? [{ text: `Tel. : ${note.phone}`, style: 'tableCell', margin: [8, 0, 8, 6] as [number, number, number, number] }] : []),
        ],
      }]],
    },
    layout: boxLayout,
  }

  // Info rows
  const infoBody: TableCell[][] = [
    [
      { text: 'N\u00b0 Bon', style: 'label' },
      { text: note.ref, style: 'value' },
      { text: 'Facture liee', style: 'label' },
      { text: note.linked_invoice, style: 'value' },
    ],
  ]

  if (note.date_expedition) {
    infoBody.push([
      { text: 'Date expedition', style: 'label' },
      { text: fmtDate(note.date_expedition), style: 'value' },
      { text: isReception ? 'Date reception' : 'Date livraison', style: 'label' },
      { text: fmtDate(note.date_delivery), style: 'value' },
    ])
  } else {
    infoBody.push([
      { text: isReception ? 'Date reception' : 'Date livraison', style: 'label' },
      { text: fmtDate(note.date_delivery), style: 'value' },
      { text: '', style: 'value' },
      { text: '', style: 'value' },
    ])
  }

  if (note.order_ref) {
    infoBody.push([
      { text: 'N\u00b0 Commande', style: 'label' },
      { text: note.order_ref, style: 'value' },
      { text: '', style: 'value' },
      { text: '', style: 'value' },
    ])
  }

  // Transport info
  const transportRows: TableCell[][] = []
  if (note.transporter) {
    transportRows.push([
      { text: 'Transporteur', style: 'label' },
      { text: note.transporter, style: 'value' },
    ])
  }
  if (note.tracking_number) {
    transportRows.push([
      { text: 'N\u00b0 Suivi', style: 'label' },
      { text: note.tracking_number, style: 'value' },
    ])
  }
  if (note.weight) {
    transportRows.push([
      { text: 'Poids', style: 'label' },
      { text: note.weight, style: 'value' },
    ])
  }
  if (note.packaging) {
    transportRows.push([
      { text: 'Conditionnement', style: 'label' },
      { text: note.packaging, style: 'value' },
    ])
  }

  // Body
  const body: Content[] = [
    {
      columns: [
        { width: '50%', ...buildCompanyHeader(RIVETIN) as object },
        { width: '50%', ...recipientBox as object },
      ],
      columnGap: 20,
      margin: [0, 0, 0, 15] as [number, number, number, number],
    },
    { text: titleText, style: 'mainTitle', margin: [0, 5, 0, 3] as [number, number, number, number] },
    { text: `N\u00b0 ${note.ref}`, style: 'subtitle', margin: [0, 0, 0, 12] as [number, number, number, number] },
    // Info
    {
      table: { widths: [100, '*', 100, '*'], body: infoBody },
      layout: infoTableLayout,
      margin: [0, 0, 0, 10] as [number, number, number, number],
    } as Content,
  ]

  // Transport section
  if (transportRows.length > 0) {
    body.push({ text: 'TRANSPORT', style: 'sectionTitle' } as Content)
    body.push({
      table: { widths: [110, '*'], body: transportRows },
      layout: infoTableLayout,
      margin: [0, 0, 0, 10] as [number, number, number, number],
    } as Content)
  }

  // Items
  body.push({ text: isReception ? 'MARCHANDISES RECEPTIONNEES' : 'MARCHANDISES EXPEDIEES', style: 'sectionTitle' } as Content)
  body.push({
    table: {
      headerRows: 1,
      widths: [45, '*', 55, 50],
      body: [headerRow, ...itemRows],
    },
    layout: invoiceTableLayout,
  } as Content)

  // Reception block
  body.push({ text: '', margin: [0, 15, 0, 0] as [number, number, number, number] } as Content)
  body.push({
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: isReception ? 'RECEPTION' : 'RECEPTION PAR LE DESTINATAIRE', style: 'label', margin: [8, 6, 8, 4] as [number, number, number, number] },
          { text: `Receptionne par : ${note.received_by}`, style: 'value', margin: [8, 0, 8, 2] as [number, number, number, number] },
          { text: `Date : ${fmtDate(note.date_delivery)}`, style: 'value', margin: [8, 0, 8, 2] as [number, number, number, number] },
          { text: `Observations : ${note.observations}`, style: 'value', margin: [8, 0, 8, 6] as [number, number, number, number] },
          { text: 'Signature :', style: 'smallLabel', margin: [8, 0, 8, 25] as [number, number, number, number] },
        ],
      }]],
    },
    layout: boxLayout,
  } as Content)

  // Legal footer
  body.push(buildLegalFooter(RIVETIN))

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content: body,
    styles: baseStyles,
    defaultStyle: { font: 'Roboto', fontSize: 8 },
  }
}

// =============================================================================
// FEC Generation (pipe-separated)
// =============================================================================

interface FecLine {
  JournalCode: string
  JournalLib: string
  EcritureNum: string
  EcritureDate: string
  CompteNum: string
  CompteLib: string
  CompAuxNum: string
  CompAuxLib: string
  PieceRef: string
  PieceDate: string
  EcritureLib: string
  Debit: string
  Credit: string
  EcritureLet: string
  DateLet: string
  ValidDate: string
  Montantdevise: string
  Idevise: string
}

function saleFecLines(
  num: string, date: string, auxNum: string, auxLib: string,
  pieceRef: string, lib: string, ht: number, validDate: string,
): FecLine[] {
  const tva = Math.round(ht * 0.2 * 100) / 100
  const ttc = ht + tva
  const fecDate = toFecDate(date)
  const fecValidDate = toFecDate(validDate)
  return [
    { JournalCode: 'VE', JournalLib: 'Ventes', EcritureNum: num, EcritureDate: fecDate, CompteNum: '411000', CompteLib: `Clients — ${auxLib}`, CompAuxNum: auxNum, CompAuxLib: auxLib, PieceRef: pieceRef, PieceDate: fecDate, EcritureLib: lib, Debit: fmtFec(ttc), Credit: fmtFec(0), EcritureLet: '', DateLet: '', ValidDate: fecValidDate, Montantdevise: '', Idevise: '' },
    { JournalCode: 'VE', JournalLib: 'Ventes', EcritureNum: num, EcritureDate: fecDate, CompteNum: '701000', CompteLib: 'Ventes de produits finis', CompAuxNum: '', CompAuxLib: '', PieceRef: pieceRef, PieceDate: fecDate, EcritureLib: lib, Debit: fmtFec(0), Credit: fmtFec(ht), EcritureLet: '', DateLet: '', ValidDate: fecValidDate, Montantdevise: '', Idevise: '' },
    { JournalCode: 'VE', JournalLib: 'Ventes', EcritureNum: num, EcritureDate: fecDate, CompteNum: '445710', CompteLib: 'TVA collectee 20%', CompAuxNum: '', CompAuxLib: '', PieceRef: pieceRef, PieceDate: fecDate, EcritureLib: lib, Debit: fmtFec(0), Credit: fmtFec(tva), EcritureLet: '', DateLet: '', ValidDate: fecValidDate, Montantdevise: '', Idevise: '' },
  ]
}

function purchaseFecLines(
  num: string, date: string, auxNum: string, auxLib: string,
  pieceRef: string, lib: string, ht: number, validDate: string,
): FecLine[] {
  const tva = Math.round(ht * 0.2 * 100) / 100
  const ttc = ht + tva
  const fecDate = toFecDate(date)
  const fecValidDate = toFecDate(validDate)
  return [
    { JournalCode: 'HA', JournalLib: 'Achats', EcritureNum: num, EcritureDate: fecDate, CompteNum: '601000', CompteLib: 'Achats matieres premieres', CompAuxNum: '', CompAuxLib: '', PieceRef: pieceRef, PieceDate: fecDate, EcritureLib: lib, Debit: fmtFec(ht), Credit: fmtFec(0), EcritureLet: '', DateLet: '', ValidDate: fecValidDate, Montantdevise: '', Idevise: '' },
    { JournalCode: 'HA', JournalLib: 'Achats', EcritureNum: num, EcritureDate: fecDate, CompteNum: '445660', CompteLib: 'TVA deductible sur ABS', CompAuxNum: '', CompAuxLib: '', PieceRef: pieceRef, PieceDate: fecDate, EcritureLib: lib, Debit: fmtFec(tva), Credit: fmtFec(0), EcritureLet: '', DateLet: '', ValidDate: fecValidDate, Montantdevise: '', Idevise: '' },
    { JournalCode: 'HA', JournalLib: 'Achats', EcritureNum: num, EcritureDate: fecDate, CompteNum: '401000', CompteLib: `Fournisseurs — ${auxLib}`, CompAuxNum: auxNum, CompAuxLib: auxLib, PieceRef: pieceRef, PieceDate: fecDate, EcritureLib: lib, Debit: fmtFec(0), Credit: fmtFec(ttc), EcritureLet: '', DateLet: '', ValidDate: fecValidDate, Montantdevise: '', Idevise: '' },
  ]
}

function creditNoteFecLines(
  num: string, date: string, auxNum: string, auxLib: string,
  pieceRef: string, lib: string, ht: number, validDate: string,
): FecLine[] {
  const tva = Math.round(ht * 0.2 * 100) / 100
  const ttc = ht + tva
  const fecDate = toFecDate(date)
  const fecValidDate = toFecDate(validDate)
  return [
    { JournalCode: 'VE', JournalLib: 'Ventes', EcritureNum: num, EcritureDate: fecDate, CompteNum: '411000', CompteLib: `Clients — ${auxLib}`, CompAuxNum: auxNum, CompAuxLib: auxLib, PieceRef: pieceRef, PieceDate: fecDate, EcritureLib: lib, Debit: fmtFec(0), Credit: fmtFec(ttc), EcritureLet: '', DateLet: '', ValidDate: fecValidDate, Montantdevise: '', Idevise: '' },
    { JournalCode: 'VE', JournalLib: 'Ventes', EcritureNum: num, EcritureDate: fecDate, CompteNum: '701000', CompteLib: 'Ventes de produits finis', CompAuxNum: '', CompAuxLib: '', PieceRef: pieceRef, PieceDate: fecDate, EcritureLib: lib, Debit: fmtFec(ht), Credit: fmtFec(0), EcritureLet: '', DateLet: '', ValidDate: fecValidDate, Montantdevise: '', Idevise: '' },
    { JournalCode: 'VE', JournalLib: 'Ventes', EcritureNum: num, EcritureDate: fecDate, CompteNum: '445710', CompteLib: 'TVA collectee 20%', CompAuxNum: '', CompAuxLib: '', PieceRef: pieceRef, PieceDate: fecDate, EcritureLib: lib, Debit: fmtFec(tva), Credit: fmtFec(0), EcritureLet: '', DateLet: '', ValidDate: fecValidDate, Montantdevise: '', Idevise: '' },
  ]
}

function generateFecContent(): string {
  const header = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib',
    'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
    'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
  ].join('|')

  const allLines: FecLine[] = [
    // 4 sales
    ...saleFecLines('VE-2025-1244', '2025-12-22', 'C0501', 'Precimetal SA', 'FA-2025-1244', 'Vente pieces usinees CN — Cde CMD-PM-2025-0843', 25980, '2025-12-31'),
    ...saleFecLines('VE-2025-1245', '2025-12-26', 'C0502', 'Hydraulique Systemes SARL', 'FA-2025-1245', 'Vente sous-ensembles hydrauliques — Cde CMD-HS-2025-0217', 18220, '2025-12-31'),
    ...saleFecLines('VE-2025-1246', '2025-12-28', 'C0501', 'Precimetal SA', 'FA-2025-1246', 'Vente chassis mecano-soudes et pieces usinees — Cde CMD-PM-2025-0851', 32540, '2025-12-31'),
    ...saleFecLines('VE-2025-1247', '2025-12-29', 'C0502', 'Hydraulique Systemes SARL', 'FA-2025-1247', 'Vente distributeurs hydrauliques et raccords — Cde CMD-HS-2025-0224', 11600, '2025-12-31'),
    // 2 purchases
    ...purchaseFecLines('HA-2025-0480', '2025-12-23', 'F0301', 'Fonderies du Rhone SA', 'FRN-2025-0480', 'Achat bruts de fonderie — Lot FR-2025-12', 16650, '2025-12-31'),
    ...purchaseFecLines('HA-2025-0481', '2025-12-30', 'F0302', 'Aciers Speciaux Lyon SAS', 'FRN-2025-0481', 'Achat barres acier et toles aluminium — Cde ASL-2025-12', 9000, '2025-12-31'),
    // 1 credit note (N+1)
    ...creditNoteFecLines('VE-2026-0012', '2026-01-12', 'C0502', 'Hydraulique Systemes SARL', 'AV-2026-0012', 'Avoir sur FA-2025-1245 — retour partiel non-conformite', 4555, '2026-01-31'),
  ]

  const dataRows = allLines.map((l) =>
    [l.JournalCode, l.JournalLib, l.EcritureNum, l.EcritureDate, l.CompteNum, l.CompteLib,
      l.CompAuxNum, l.CompAuxLib, l.PieceRef, l.PieceDate, l.EcritureLib, l.Debit, l.Credit,
      l.EcritureLet, l.DateLet, l.ValidDate, l.Montantdevise, l.Idevise].join('|')
  )

  return [header, ...dataRows].join('\n')
}

// =============================================================================
// Main Export
// =============================================================================

export async function generateCutoffDocs(outputDir: string): Promise<{ count: number; outputDir: string }> {
  fs.mkdirSync(outputDir, { recursive: true })
  let count = 0

  // --- FEC ---
  const fecContent = generateFecContent()
  fs.writeFileSync(path.join(outputDir, 'FEC_rivetin_mecanique_2025.txt'), fecContent, 'utf-8')
  count++
  console.log('  [cutoff] FEC_rivetin_mecanique_2025.txt')

  // --- Sales Invoices ---
  const salesInvoices = [invoiceFA1244, invoiceFA1245, invoiceFA1246, invoiceFA1247]
  for (const inv of salesInvoices) {
    const doc = buildInvoicePdf(inv)
    const buf = await generatePdfBuffer(doc)
    const filename = `${inv.ref}.pdf`
    fs.writeFileSync(path.join(outputDir, filename), buf)
    count++
    console.log(`  [cutoff] ${filename}`)
  }

  // --- Credit Note ---
  const avoirDoc = buildInvoicePdf(avoirAV0012)
  const avoirBuf = await generatePdfBuffer(avoirDoc)
  fs.writeFileSync(path.join(outputDir, 'AV-2026-0012.pdf'), avoirBuf)
  count++
  console.log('  [cutoff] AV-2026-0012.pdf')

  // --- Purchase Invoices ---
  const purchaseInvoices = [invoiceFRN0480, invoiceFRN0481]
  for (const inv of purchaseInvoices) {
    const doc = buildInvoicePdf(inv)
    const buf = await generatePdfBuffer(doc)
    const filename = `${inv.ref}.pdf`
    fs.writeFileSync(path.join(outputDir, filename), buf)
    count++
    console.log(`  [cutoff] ${filename}`)
  }

  // --- Delivery Notes (BL) ---
  const deliveryNotes = [blBL0845, blBL0846, blBL0847]
  for (const dn of deliveryNotes) {
    const doc = buildDeliveryNotePdf(dn)
    const buf = await generatePdfBuffer(doc)
    const filename = `${dn.ref}.pdf`
    fs.writeFileSync(path.join(outputDir, filename), buf)
    count++
    console.log(`  [cutoff] ${filename}`)
  }

  // --- Reception Notes (BR) ---
  const receptionNotes = [brBR0480, brBR0481]
  for (const dn of receptionNotes) {
    const doc = buildDeliveryNotePdf(dn)
    const buf = await generatePdfBuffer(doc)
    const filename = `${dn.ref}.pdf`
    fs.writeFileSync(path.join(outputDir, filename), buf)
    count++
    console.log(`  [cutoff] ${filename}`)
  }

  console.log(`  [cutoff] ${count} fichiers generes dans ${outputDir}`)
  return { count, outputDir }
}

// =============================================================================
// CLI entry point
// =============================================================================

if (require.main === module) {
  const outDir = path.join(process.cwd(), 'data', 'cutoff')
  generateCutoffDocs(outDir)
    .then((r) => console.log(`\nTermine : ${r.count} fichiers.`))
    .catch((err) => { console.error('Erreur:', err); process.exit(1) })
}
