// =============================================================================
// SOF'IA -- Donnees des entreprises fictives pour le scenario Cut-Off
// 4 entreprises : 3 propres + 1 avec incoherences (Rhone Equipements SA)
//
// VOCABULAIRE OBLIGATOIRE :
// - "signal documentaire" (jamais "anomalie")
// - "constat factuel" (jamais "conclusion")
// - "necessite l'attention du CAC" (jamais "significatif")
// =============================================================================

import type { SignalType, SignalPriority } from './signal-rules'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FecEntry {
  journal_code: string
  journal_lib: string
  ecriture_num: string
  ecriture_date: string
  compte_num: string
  compte_lib: string
  comp_aux_num: string | null
  comp_aux_lib: string | null
  piece_ref: string
  piece_date: string
  ecriture_lib: string
  debit: number
  credit: number
  valid_date: string | null
}

export interface InvoiceLine {
  description: string
  quantity: number
  unit_price_ht: number
  total_ht: number
}

export interface CutoffInvoice {
  ref: string
  type: 'vente' | 'achat' | 'avoir'
  date: string
  client_or_supplier: string
  client_code: string
  address: string
  siret: string
  lines: InvoiceLine[]
  total_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  payment_terms: string
  due_date: string
  linked_bl_ref: string | null
  linked_invoice: string | null
  note: string | null
}

export interface DeliveryNote {
  ref: string
  type: 'livraison' | 'reception'
  date_expedition: string | null
  date_delivery: string
  order_ref: string
  linked_invoice: string
  recipient_or_supplier: string
  contact: string
  items_description: string
  quantity: string
  received_by: string
  observations: string
}

export interface ExpectedCutoffSignal {
  signal_id: string
  rule_triggered: string
  type: SignalType
  description: string
  priority: SignalPriority
  source_document: string
  compared_documents: string[]
  source_extract: string
  invoice_ref?: string
  bl_ref?: string
  amount?: number
  date_gap_days?: number
}

export interface CutoffCompany {
  id: string
  name: string
  legal_form: string
  address: string
  siret: string
  tva_intra: string
  rcs: string
  capital_social: number
  fiscal_year_end: string
  cutoff_window_days: number
  fec_entries: FecEntry[]
  invoices: CutoffInvoice[]
  delivery_notes: DeliveryNote[]
  expected_signals: ExpectedCutoffSignal[]
  is_faulty: boolean
}

// -----------------------------------------------------------------------------
// Helpers FEC
// -----------------------------------------------------------------------------

/** Ligne de vente : debit client TTC, credit ventes HT, credit TVA collectee */
function saleFec(
  num: string, date: string, clientNum: string, clientLib: string,
  auxNum: string, auxLib: string, pieceRef: string, lib: string,
  ht: number, validDate: string | null
): FecEntry[] {
  const tva = Math.round(ht * 0.2 * 100) / 100
  const ttc = ht + tva
  return [
    { journal_code: 'VE', journal_lib: 'Ventes', ecriture_num: num, ecriture_date: date, compte_num: clientNum, compte_lib: `Clients - ${clientLib}`, comp_aux_num: auxNum, comp_aux_lib: auxLib, piece_ref: pieceRef, piece_date: date, ecriture_lib: lib, debit: ttc, credit: 0, valid_date: validDate },
    { journal_code: 'VE', journal_lib: 'Ventes', ecriture_num: num, ecriture_date: date, compte_num: '701000', compte_lib: 'Ventes de produits finis', comp_aux_num: null, comp_aux_lib: null, piece_ref: pieceRef, piece_date: date, ecriture_lib: lib, debit: 0, credit: ht, valid_date: validDate },
    { journal_code: 'VE', journal_lib: 'Ventes', ecriture_num: num, ecriture_date: date, compte_num: '445710', compte_lib: 'TVA collectee 20%', comp_aux_num: null, comp_aux_lib: null, piece_ref: pieceRef, piece_date: date, ecriture_lib: lib, debit: 0, credit: tva, valid_date: validDate },
  ]
}

/** Ligne d'achat : debit achats HT, debit TVA deductible, credit fournisseur TTC */
function purchaseFec(
  num: string, date: string, frnNum: string, frnLib: string,
  auxNum: string, auxLib: string, pieceRef: string, lib: string,
  ht: number, validDate: string | null
): FecEntry[] {
  const tva = Math.round(ht * 0.2 * 100) / 100
  const ttc = ht + tva
  return [
    { journal_code: 'HA', journal_lib: 'Achats', ecriture_num: num, ecriture_date: date, compte_num: '607000', compte_lib: 'Achats de marchandises', comp_aux_num: null, comp_aux_lib: null, piece_ref: pieceRef, piece_date: date, ecriture_lib: lib, debit: ht, credit: 0, valid_date: validDate },
    { journal_code: 'HA', journal_lib: 'Achats', ecriture_num: num, ecriture_date: date, compte_num: '445660', compte_lib: 'TVA deductible sur ABS', comp_aux_num: null, comp_aux_lib: null, piece_ref: pieceRef, piece_date: date, ecriture_lib: lib, debit: tva, credit: 0, valid_date: validDate },
    { journal_code: 'HA', journal_lib: 'Achats', ecriture_num: num, ecriture_date: date, compte_num: frnNum, compte_lib: `Fournisseurs - ${frnLib}`, comp_aux_num: auxNum, comp_aux_lib: auxLib, piece_ref: pieceRef, piece_date: date, ecriture_lib: lib, debit: 0, credit: ttc, valid_date: validDate },
  ]
}

/** Ligne d'avoir : debit ventes HT, debit TVA collectee, credit client TTC */
function creditNoteFec(
  num: string, date: string, clientNum: string, clientLib: string,
  auxNum: string, auxLib: string, pieceRef: string, lib: string,
  ht: number, validDate: string | null
): FecEntry[] {
  const tva = Math.round(ht * 0.2 * 100) / 100
  const ttc = ht + tva
  return [
    { journal_code: 'VE', journal_lib: 'Ventes', ecriture_num: num, ecriture_date: date, compte_num: '701000', compte_lib: 'Ventes de produits finis', comp_aux_num: null, comp_aux_lib: null, piece_ref: pieceRef, piece_date: date, ecriture_lib: lib, debit: ht, credit: 0, valid_date: validDate },
    { journal_code: 'VE', journal_lib: 'Ventes', ecriture_num: num, ecriture_date: date, compte_num: '445710', compte_lib: 'TVA collectee 20%', comp_aux_num: null, comp_aux_lib: null, piece_ref: pieceRef, piece_date: date, ecriture_lib: lib, debit: tva, credit: 0, valid_date: validDate },
    { journal_code: 'VE', journal_lib: 'Ventes', ecriture_num: num, ecriture_date: date, compte_num: clientNum, compte_lib: `Clients - ${clientLib}`, comp_aux_num: auxNum, comp_aux_lib: auxLib, piece_ref: pieceRef, piece_date: date, ecriture_lib: lib, debit: 0, credit: ttc, valid_date: validDate },
  ]
}

/** Cree une facture standard */
function makeInvoice(
  ref: string, type: 'vente' | 'achat' | 'avoir', date: string,
  clientOrSupplier: string, clientCode: string, address: string, siret: string,
  lines: InvoiceLine[], paymentTerms: string, dueDate: string,
  linkedBlRef: string | null, linkedInvoice: string | null, note: string | null
): CutoffInvoice {
  const total_ht = lines.reduce((s, l) => s + l.total_ht, 0)
  const tva_amount = Math.round(total_ht * 0.2 * 100) / 100
  return {
    ref, type, date, client_or_supplier: clientOrSupplier, client_code: clientCode,
    address, siret, lines, total_ht, tva_rate: 20, tva_amount,
    total_ttc: total_ht + tva_amount, payment_terms: paymentTerms,
    due_date: dueDate, linked_bl_ref: linkedBlRef, linked_invoice: linkedInvoice, note,
  }
}

/** Cree un bon de livraison / reception */
function makeBL(
  ref: string, type: 'livraison' | 'reception', dateExp: string | null,
  dateDelivery: string, orderRef: string, linkedInvoice: string,
  recipientOrSupplier: string, contact: string, itemsDesc: string,
  quantity: string, receivedBy: string, observations: string
): DeliveryNote {
  return {
    ref, type, date_expedition: dateExp, date_delivery: dateDelivery,
    order_ref: orderRef, linked_invoice: linkedInvoice,
    recipient_or_supplier: recipientOrSupplier, contact,
    items_description: itemsDesc, quantity, received_by: receivedBy, observations,
  }
}

// -----------------------------------------------------------------------------
// Entreprise 1 : ACME Distribution SAS (propre)
// Basee sur le FEC de data/cutoff/FEC_ACME_2025_cutoff.txt
// -----------------------------------------------------------------------------

const acmeDistributionCutoff: CutoffCompany = {
  id: 'acme_distribution_cutoff',
  name: 'ACME Distribution SAS',
  legal_form: 'SAS',
  address: '45 rue de la Republique, 69002 Lyon',
  siret: '412 345 678 00012',
  tva_intra: 'FR 12 412345678',
  rcs: 'Lyon B 412 345 678',
  capital_social: 200000,
  fiscal_year_end: '2025-12-31',
  cutoff_window_days: 10,
  fec_entries: [
    // VE-2025-1201 : Fontaine Logistique — 18/12/2025 — 30 000 HT
    ...saleFec('VE-2025-1201', '2025-12-18', '411010', 'SA Fontaine Logistique', 'CLI010', 'SA Fontaine Logistique', 'FAC-2025-1180', 'Vente equipements Fontaine - Cde FL-890', 30000, '2025-12-31'),
    // VE-2025-1202 : Mercier & Cie — 22/12/2025 — 12 000 HT
    ...saleFec('VE-2025-1202', '2025-12-22', '411011', 'SARL Mercier & Cie', 'CLI011', 'SARL Mercier & Cie', 'FAC-2025-1181', 'Vente materiel Mercier - Commande MC-445', 12000, '2025-12-31'),
    // VE-2025-1203 : Lambert Industrie — 29/12/2025 — 44 000 HT
    ...saleFec('VE-2025-1203', '2025-12-29', '411012', 'Ets Lambert Industrie', 'CLI012', 'Ets Lambert Industrie', 'FAC-2025-1182', 'Vente produits Lambert - Lot LI-2025-78', 44000, '2025-12-31'),
    // VE-2025-1204 : Perrin Solutions — 30/12/2025 — 16 000 HT
    ...saleFec('VE-2025-1204', '2025-12-30', '411013', 'SAS Perrin Solutions', 'CLI013', 'SAS Perrin Solutions', 'FAC-2025-1183', 'Vente services Perrin - Contrat PS-2025', 16000, '2025-12-31'),
    // VE-2025-1205 : Groupe Tissot — 31/12/2025 — 20 000 HT
    ...saleFec('VE-2025-1205', '2025-12-31', '411014', 'Groupe Tissot SA', 'CLI014', 'Groupe Tissot SA', 'FAC-2025-1184', 'Vente fin d\'exercice Tissot - Ref. GT-DEC25', 20000, '2025-12-31'),
    // HA-2025-0901 : Dupre Materiaux — 20/12/2025 — 18 500 HT
    ...purchaseFec('HA-2025-0901', '2025-12-20', '401001', 'Dupre Materiaux SAS', 'FRN001', 'Dupre Materiaux SAS', 'FRN-2025-0487', 'Achat marchandises Fournisseur Dupre', 18500, '2025-12-31'),
    // HA-2025-0902 : Garnier Industries — 28/12/2025 — 9 200 HT
    ...purchaseFec('HA-2025-0902', '2025-12-28', '401002', 'Garnier Industries SARL', 'FRN002', 'Garnier Industries SARL', 'FRN-2025-0488', 'Achat matieres premieres Fournisseur Garnier', 9200, '2025-12-31'),
    // HA-2025-0903 : Blanc Composants — 02/01/2026 — 7 800 HT (facture et BR en N+1, propre)
    ...purchaseFec('HA-2025-0903', '2026-01-02', '401003', 'Blanc Composants SA', 'FRN003', 'Blanc Composants SA', 'FRN-2025-0489', 'Achat pieces detachees Fournisseur Blanc', 7800, '2026-01-15'),
  ],
  invoices: [
    makeInvoice('FAC-2025-1180', 'vente', '2025-12-18', 'SA Fontaine Logistique', 'CLI010', '28 rue du Commerce, 69003 Lyon', '321 654 987 00015', [{ description: 'Equipements industriels lot FL-890', quantity: 10, unit_price_ht: 3000, total_ht: 30000 }], 'Reglement a 30 jours', '2026-01-17', 'BL-2025-0780', null, null),
    makeInvoice('FAC-2025-1181', 'vente', '2025-12-22', 'SARL Mercier & Cie', 'CLI011', '15 place Bellecour, 69002 Lyon', '432 765 098 00028', [{ description: 'Materiel de bureau commande MC-445', quantity: 24, unit_price_ht: 500, total_ht: 12000 }], 'Reglement a 30 jours', '2026-01-21', 'BL-2025-0781', null, null),
    makeInvoice('FAC-2025-1182', 'vente', '2025-12-29', 'Ets Lambert Industrie', 'CLI012', '7 avenue Jean Jaures, 69007 Lyon', '543 876 109 00031', [{ description: 'Produits finis lot LI-2025-78', quantity: 20, unit_price_ht: 2200, total_ht: 44000 }], 'Reglement a 45 jours', '2026-02-12', 'BL-2025-0782', null, null),
    makeInvoice('FAC-2025-1183', 'vente', '2025-12-30', 'SAS Perrin Solutions', 'CLI013', '22 cours Vitton, 69006 Lyon', '654 987 210 00044', [{ description: 'Prestation de services contrat PS-2025', quantity: 1, unit_price_ht: 16000, total_ht: 16000 }], 'Reglement a 30 jours', '2026-01-29', 'BL-2025-0783', null, null),
    makeInvoice('FAC-2025-1184', 'vente', '2025-12-31', 'Groupe Tissot SA', 'CLI014', '3 rue Edouard Herriot, 69001 Lyon', '765 098 321 00057', [{ description: 'Equipements de fin d\'exercice ref GT-DEC25', quantity: 8, unit_price_ht: 2500, total_ht: 20000 }], 'Reglement a 30 jours', '2026-01-30', 'BL-2025-0784', null, null),
    makeInvoice('FRN-2025-0487', 'achat', '2025-12-20', 'Dupre Materiaux SAS', 'FRN001', '40 boulevard de la Part-Dieu, 69003 Lyon', '876 109 432 00060', [{ description: 'Marchandises diverses lot DM-2025-12', quantity: 50, unit_price_ht: 370, total_ht: 18500 }], 'Reglement a 60 jours', '2026-02-18', 'BR-2025-0450', null, null),
    makeInvoice('FRN-2025-0488', 'achat', '2025-12-28', 'Garnier Industries SARL', 'FRN002', '5 impasse des Ateliers, 69100 Villeurbanne', '987 210 543 00073', [{ description: 'Matieres premieres ref GI-2025-MP', quantity: 20, unit_price_ht: 460, total_ht: 9200 }], 'Reglement a 45 jours', '2026-02-11', 'BR-2025-0451', null, null),
    makeInvoice('FRN-2025-0489', 'achat', '2026-01-02', 'Blanc Composants SA', 'FRN003', '18 rue de la Soie, 69004 Lyon', '098 321 654 00086', [{ description: 'Pieces detachees ref BC-2026-01', quantity: 30, unit_price_ht: 260, total_ht: 7800 }], 'Reglement a 30 jours', '2026-02-01', 'BR-2026-0001', null, null),
  ],
  delivery_notes: [
    makeBL('BL-2025-0780', 'livraison', '2025-12-17', '2025-12-18', 'Cde FL-890', 'FAC-2025-1180', 'SA Fontaine Logistique', 'M. Fontaine', 'Equipements industriels lot FL-890', '10 unites', 'M. Durand (magasinier)', 'Livraison conforme'),
    makeBL('BL-2025-0781', 'livraison', '2025-12-21', '2025-12-22', 'MC-445', 'FAC-2025-1181', 'SARL Mercier & Cie', 'Mme Mercier', 'Materiel de bureau commande MC-445', '24 unites', 'M. Bernard (reception)', 'RAS'),
    makeBL('BL-2025-0782', 'livraison', '2025-12-28', '2025-12-29', 'LI-2025-78', 'FAC-2025-1182', 'Ets Lambert Industrie', 'M. Lambert', 'Produits finis lot LI-2025-78', '20 unites', 'M. Petit (responsable entrepot)', 'Livraison en un lot'),
    makeBL('BL-2025-0783', 'livraison', '2025-12-29', '2025-12-30', 'PS-2025', 'FAC-2025-1183', 'SAS Perrin Solutions', 'M. Perrin', 'Prestation de services contrat PS-2025', '1 lot', 'M. Perrin (directeur)', 'PV de reception signe'),
    makeBL('BL-2025-0784', 'livraison', '2025-12-30', '2025-12-31', 'GT-DEC25', 'FAC-2025-1184', 'Groupe Tissot SA', 'Mme Tissot', 'Equipements ref GT-DEC25', '8 unites', 'M. Roche (logistique)', 'Livraison le jour de la cloture'),
    makeBL('BR-2025-0450', 'reception', null, '2025-12-20', 'DM-2025-12', 'FRN-2025-0487', 'Dupre Materiaux SAS', 'Service achats', 'Marchandises lot DM-2025-12', '50 unites', 'M. Martin (responsable achats)', 'Reception conforme au bon de commande'),
    makeBL('BR-2025-0451', 'reception', null, '2025-12-28', 'GI-2025-MP', 'FRN-2025-0488', 'Garnier Industries SARL', 'Service achats', 'Matieres premieres ref GI-2025-MP', '20 unites', 'M. Martin (responsable achats)', 'Reception conforme'),
    makeBL('BR-2026-0001', 'reception', null, '2026-01-02', 'BC-2026-01', 'FRN-2025-0489', 'Blanc Composants SA', 'Service achats', 'Pieces detachees ref BC-2026-01', '30 unites', 'M. Martin (responsable achats)', 'Reception le 02/01, conforme'),
  ],
  expected_signals: [],
  is_faulty: false,
}

// -----------------------------------------------------------------------------
// Entreprise 2 : Legrand Textile SARL (propre)
// -----------------------------------------------------------------------------

const legrandTextile: CutoffCompany = {
  id: 'legrand_textile',
  name: 'Legrand Textile SARL',
  legal_form: 'SARL',
  address: '12 avenue des Chartrons, 69100 Villeurbanne',
  siret: '523 876 543 00021',
  tva_intra: 'FR 45 523876543',
  rcs: 'Lyon B 523 876 543',
  capital_social: 80000,
  fiscal_year_end: '2025-12-31',
  cutoff_window_days: 10,
  fec_entries: [
    // 4 ventes
    ...saleFec('VE-2025-0610', '2025-12-22', '411020', 'Maison Dubois SA', 'CLI020', 'Maison Dubois SA', 'FAC-2025-0610', 'Vente tissus ameublement - Cde MD-1220', 18500, '2025-12-31'),
    ...saleFec('VE-2025-0611', '2025-12-26', '411021', 'Atelier Carre SARL', 'CLI021', 'Atelier Carre SARL', 'FAC-2025-0611', 'Vente fournitures textiles - Cde AC-085', 8200, '2025-12-31'),
    ...saleFec('VE-2025-0612', '2025-12-29', '411022', 'Confection Lyonnaise SAS', 'CLI022', 'Confection Lyonnaise SAS', 'FAC-2025-0612', 'Vente rouleaux coton - Lot CL-2025-45', 25000, '2025-12-31'),
    ...saleFec('VE-2025-0613', '2025-12-31', '411023', 'Draperies du Rhone SA', 'CLI023', 'Draperies du Rhone SA', 'FAC-2025-0613', 'Vente echantillons et fins de serie - Ref DR-DEC', 6800, '2025-12-31'),
    // 2 achats
    ...purchaseFec('HA-2025-0310', '2025-12-23', '401010', 'Filatures de l\'Est SAS', 'FRN010', 'Filatures de l\'Est SAS', 'FRN-2025-0310', 'Achat fils et fibres - Lot FE-2025-12', 14200, '2025-12-31'),
    ...purchaseFec('HA-2025-0311', '2025-12-30', '401011', 'Teinturerie Moderne SARL', 'FRN011', 'Teinturerie Moderne SARL', 'FRN-2025-0311', 'Prestation teinture lot decembre', 5600, '2025-12-31'),
  ],
  invoices: [
    makeInvoice('FAC-2025-0610', 'vente', '2025-12-22', 'Maison Dubois SA', 'CLI020', '34 rue de la Bourse, 69002 Lyon', '234 567 890 00011', [{ description: 'Tissus ameublement coton bio', quantity: 100, unit_price_ht: 185, total_ht: 18500 }], 'Reglement a 30 jours', '2026-01-21', 'BL-2025-0510', null, null),
    makeInvoice('FAC-2025-0611', 'vente', '2025-12-26', 'Atelier Carre SARL', 'CLI021', '8 rue Merciere, 69005 Lyon', '345 678 901 00024', [{ description: 'Fournitures textiles assorties', quantity: 40, unit_price_ht: 205, total_ht: 8200 }], 'Reglement a 30 jours', '2026-01-25', 'BL-2025-0511', null, null),
    makeInvoice('FAC-2025-0612', 'vente', '2025-12-29', 'Confection Lyonnaise SAS', 'CLI022', '19 quai de Bondy, 69005 Lyon', '456 789 012 00037', [{ description: 'Rouleaux coton lot CL-2025-45', quantity: 50, unit_price_ht: 500, total_ht: 25000 }], 'Reglement a 45 jours', '2026-02-12', 'BL-2025-0512', null, null),
    makeInvoice('FAC-2025-0613', 'vente', '2025-12-31', 'Draperies du Rhone SA', 'CLI023', '2 place des Terreaux, 69001 Lyon', '567 890 123 00040', [{ description: 'Echantillons et fins de serie ref DR-DEC', quantity: 1, unit_price_ht: 6800, total_ht: 6800 }], 'Reglement a 30 jours', '2026-01-30', 'BL-2025-0513', null, null),
    makeInvoice('FRN-2025-0310', 'achat', '2025-12-23', 'Filatures de l\'Est SAS', 'FRN010', '45 route de Strasbourg, 88000 Epinal', '678 901 234 00053', [{ description: 'Fils et fibres coton lot FE-2025-12', quantity: 200, unit_price_ht: 71, total_ht: 14200 }], 'Reglement a 60 jours', '2026-02-21', 'BR-2025-0310', null, null),
    makeInvoice('FRN-2025-0311', 'achat', '2025-12-30', 'Teinturerie Moderne SARL', 'FRN011', '11 rue des Teinturiers, 69100 Villeurbanne', '789 012 345 00066', [{ description: 'Prestation teinture lot decembre', quantity: 1, unit_price_ht: 5600, total_ht: 5600 }], 'Reglement a 30 jours', '2026-01-29', 'BR-2025-0311', null, null),
  ],
  delivery_notes: [
    makeBL('BL-2025-0510', 'livraison', '2025-12-21', '2025-12-22', 'MD-1220', 'FAC-2025-0610', 'Maison Dubois SA', 'M. Dubois', 'Tissus ameublement coton bio', '100 metres', 'Mme Favre (reception)', 'Livraison conforme'),
    makeBL('BL-2025-0511', 'livraison', '2025-12-25', '2025-12-26', 'AC-085', 'FAC-2025-0611', 'Atelier Carre SARL', 'Mme Carre', 'Fournitures textiles assorties', '40 unites', 'M. Carre (gerant)', 'RAS'),
    makeBL('BL-2025-0512', 'livraison', '2025-12-28', '2025-12-29', 'CL-2025-45', 'FAC-2025-0612', 'Confection Lyonnaise SAS', 'M. Giraud', 'Rouleaux coton lot CL-2025-45', '50 rouleaux', 'M. Blanc (magasinier)', 'Palette complete'),
    makeBL('BL-2025-0513', 'livraison', '2025-12-30', '2025-12-31', 'DR-DEC', 'FAC-2025-0613', 'Draperies du Rhone SA', 'M. Renard', 'Echantillons et fins de serie', '1 lot', 'Mme Renard (directrice)', 'Dernier envoi de l\'exercice'),
    makeBL('BR-2025-0310', 'reception', null, '2025-12-23', 'FE-2025-12', 'FRN-2025-0310', 'Filatures de l\'Est SAS', 'Service achats', 'Fils et fibres coton', '200 kg', 'M. Legrand (gerant)', 'Qualite conforme'),
    makeBL('BR-2025-0311', 'reception', null, '2025-12-30', 'TM-DEC', 'FRN-2025-0311', 'Teinturerie Moderne SARL', 'Service achats', 'Prestation teinture', '1 lot', 'M. Legrand (gerant)', 'Prestation realisee et receptionnee'),
  ],
  expected_signals: [],
  is_faulty: false,
}

// -----------------------------------------------------------------------------
// Entreprise 3 : Meridien Informatique SAS (propre)
// -----------------------------------------------------------------------------

const meridienInformatique: CutoffCompany = {
  id: 'meridien_informatique',
  name: 'Meridien Informatique SAS',
  legal_form: 'SAS',
  address: '18 boulevard de la Croix-Rousse, 69004 Lyon',
  siret: '645 321 987 00034',
  tva_intra: 'FR 78 645321987',
  rcs: 'Lyon B 645 321 987',
  capital_social: 150000,
  fiscal_year_end: '2025-12-31',
  cutoff_window_days: 10,
  fec_entries: [
    // 3 ventes
    ...saleFec('VE-2025-0450', '2025-12-23', '411030', 'Cabinet Renaud & Associes', 'CLI030', 'Cabinet Renaud & Associes', 'FAC-2025-0450', 'Vente serveurs et equipements reseau - Cde CR-788', 35000, '2025-12-31'),
    ...saleFec('VE-2025-0451', '2025-12-28', '411031', 'Clinique Saint-Luc SAS', 'CLI031', 'Clinique Saint-Luc SAS', 'FAC-2025-0451', 'Vente postes de travail - Cde SL-420', 22400, '2025-12-31'),
    ...saleFec('VE-2025-0452', '2025-12-31', '411032', 'Ecole Superieure de Commerce', 'CLI032', 'Ecole Superieure de Commerce', 'FAC-2025-0452', 'Vente licences logicielles - Cde ESC-2025', 15000, '2025-12-31'),
    // 3 achats
    ...purchaseFec('HA-2025-0220', '2025-12-22', '401020', 'Tech Supplies International', 'FRN020', 'Tech Supplies International', 'FRN-2025-0220', 'Achat composants serveurs lot TSI-DEC', 28000, '2025-12-31'),
    ...purchaseFec('HA-2025-0221', '2025-12-27', '401021', 'Distrib\'IT France SARL', 'FRN021', 'Distrib\'IT France SARL', 'FRN-2025-0221', 'Achat ecrans et peripheriques lot DIF-995', 11500, '2025-12-31'),
    ...purchaseFec('HA-2025-0222', '2025-12-30', '401022', 'LogiSoft Editions SA', 'FRN022', 'LogiSoft Editions SA', 'FRN-2025-0222', 'Achat licences editeur lot LS-2025', 8900, '2025-12-31'),
  ],
  invoices: [
    makeInvoice('FAC-2025-0450', 'vente', '2025-12-23', 'Cabinet Renaud & Associes', 'CLI030', '55 rue de la Republique, 69002 Lyon', '112 233 445 00012', [{ description: 'Serveurs et equipements reseau', quantity: 5, unit_price_ht: 7000, total_ht: 35000 }], 'Reglement a 30 jours', '2026-01-22', 'BL-2025-0350', null, null),
    makeInvoice('FAC-2025-0451', 'vente', '2025-12-28', 'Clinique Saint-Luc SAS', 'CLI031', '120 avenue Lacassagne, 69003 Lyon', '223 344 556 00025', [{ description: 'Postes de travail complets commande SL-420', quantity: 16, unit_price_ht: 1400, total_ht: 22400 }], 'Reglement a 45 jours', '2026-02-11', 'BL-2025-0351', null, null),
    makeInvoice('FAC-2025-0452', 'vente', '2025-12-31', 'Ecole Superieure de Commerce', 'CLI032', '23 avenue Guy de Collongue, 69130 Ecully', '334 455 667 00038', [{ description: 'Licences logicielles annuelles ref ESC-2025', quantity: 50, unit_price_ht: 300, total_ht: 15000 }], 'Reglement a 30 jours', '2026-01-30', 'BL-2025-0352', null, null),
    makeInvoice('FRN-2025-0220', 'achat', '2025-12-22', 'Tech Supplies International', 'FRN020', '88 route de Paris, 69260 Charbonnieres', '445 566 778 00041', [{ description: 'Composants serveurs lot TSI-DEC', quantity: 10, unit_price_ht: 2800, total_ht: 28000 }], 'Reglement a 60 jours', '2026-02-20', 'BR-2025-0220', null, null),
    makeInvoice('FRN-2025-0221', 'achat', '2025-12-27', 'Distrib\'IT France SARL', 'FRN021', '14 rue du Progres, 69100 Villeurbanne', '556 677 889 00054', [{ description: 'Ecrans et peripheriques lot DIF-995', quantity: 25, unit_price_ht: 460, total_ht: 11500 }], 'Reglement a 30 jours', '2026-01-26', 'BR-2025-0221', null, null),
    makeInvoice('FRN-2025-0222', 'achat', '2025-12-30', 'LogiSoft Editions SA', 'FRN022', '6 place de l\'Etoile, 75017 Paris', '667 788 990 00067', [{ description: 'Licences editeur lot LS-2025', quantity: 1, unit_price_ht: 8900, total_ht: 8900 }], 'Reglement a 30 jours', '2026-01-29', 'BR-2025-0222', null, null),
  ],
  delivery_notes: [
    makeBL('BL-2025-0350', 'livraison', '2025-12-22', '2025-12-23', 'CR-788', 'FAC-2025-0450', 'Cabinet Renaud & Associes', 'M. Renaud', 'Serveurs et equipements reseau', '5 unites', 'M. Renaud (associe)', 'Installation prevue semaine suivante'),
    makeBL('BL-2025-0351', 'livraison', '2025-12-27', '2025-12-28', 'SL-420', 'FAC-2025-0451', 'Clinique Saint-Luc SAS', 'Mme Leclerc', 'Postes de travail commande SL-420', '16 unites', 'M. Arnaud (service informatique)', 'Livraison en 2 palettes'),
    makeBL('BL-2025-0352', 'livraison', '2025-12-30', '2025-12-31', 'ESC-2025', 'FAC-2025-0452', 'Ecole Superieure de Commerce', 'M. Delorme', 'Licences logicielles ref ESC-2025', '50 licences', 'Mme Jobert (DSI)', 'Activation des licences le jour meme'),
    makeBL('BR-2025-0220', 'reception', null, '2025-12-22', 'TSI-DEC', 'FRN-2025-0220', 'Tech Supplies International', 'Service achats', 'Composants serveurs lot TSI-DEC', '10 unites', 'M. Morel (responsable technique)', 'Controle qualite OK'),
    makeBL('BR-2025-0221', 'reception', null, '2025-12-27', 'DIF-995', 'FRN-2025-0221', 'Distrib\'IT France SARL', 'Service achats', 'Ecrans et peripheriques lot DIF-995', '25 unites', 'M. Morel (responsable technique)', 'Livraison partielle acceptee'),
    makeBL('BR-2025-0222', 'reception', null, '2025-12-30', 'LS-2025', 'FRN-2025-0222', 'LogiSoft Editions SA', 'Service achats', 'Licences editeur lot LS-2025', '1 lot dematerialise', 'M. Gautier (directeur)', 'Cles de licence recues par email'),
  ],
  expected_signals: [],
  is_faulty: false,
}

// -----------------------------------------------------------------------------
// Entreprise 4 : Rhone Equipements SA (AVEC incoherences)
// 6 ventes + 4 achats, 4 signaux documentaires
// -----------------------------------------------------------------------------

const rhoneEquipements: CutoffCompany = {
  id: 'rhone_equipements',
  name: 'Rhone Equipements SA',
  legal_form: 'SA',
  address: '56 quai Rambaud, 69002 Lyon',
  siret: '756 432 198 00045',
  tva_intra: 'FR 91 756432198',
  rcs: 'Lyon B 756 432 198',
  capital_social: 400000,
  fiscal_year_end: '2025-12-31',
  cutoff_window_days: 10,
  fec_entries: [
    // --- Ventes propres ---
    // VE-2025-0990 : Transport Besson — 20/12/2025 — 18 000 HT (propre)
    ...saleFec('VE-2025-0990', '2025-12-20', '411040', 'Transport Besson SARL', 'CLI040', 'Transport Besson SARL', 'FAC-2025-0888', 'Vente pieces detachees Besson - Cde TB-550', 18000, '2025-12-31'),
    // VE-2025-0991 : SCI Bellecour — 22/12/2025 — 19 200 HT (propre, mais cible de l'avoir CUT-005)
    ...saleFec('VE-2025-0991', '2025-12-22', '411041', 'SCI Bellecour', 'CLI041', 'SCI Bellecour', 'FAC-2025-0889', 'Vente equipements SCI Bellecour - Cde SB-320', 19200, '2025-12-31'),
    // VE-2025-0992 : Garage Central — 26/12/2025 — 12 500 HT (propre)
    ...saleFec('VE-2025-0992', '2025-12-26', '411042', 'Garage Central SAS', 'CLI042', 'Garage Central SAS', 'FAC-2025-0890', 'Vente outillage Garage Central - Cde GC-780', 12500, '2025-12-31'),
    // --- CUT-001 : Facture avant cloture, BL apres cloture ---
    // VE-2025-0993 : Atelier Durand — 29/12/2025 — 28 500 HT
    ...saleFec('VE-2025-0993', '2025-12-29', '411043', 'Atelier Durand SAS', 'CLI043', 'Atelier Durand SAS', 'FAC-2025-0891', 'Vente equipements industriels Atelier Durand - Cde AD-115', 28500, '2025-12-31'),
    // --- CUT-004 : Vente sans BL ---
    // VE-2025-0995 : Groupe Martin Industries — 30/12/2025 — 42 000 HT
    ...saleFec('VE-2025-0995', '2025-12-30', '411044', 'Groupe Martin Industries SA', 'CLI044', 'Groupe Martin Industries SA', 'FAC-2025-0895', 'Vente equipements lourds Groupe Martin - Cde GM-2025', 42000, '2025-12-31'),
    // VE-2025-0996 : Societe Nouvelle du Rhone — 31/12/2025 — 15 000 HT (propre)
    ...saleFec('VE-2025-0996', '2025-12-31', '411045', 'Societe Nouvelle du Rhone SAS', 'CLI045', 'Societe Nouvelle du Rhone SAS', 'FAC-2025-0896', 'Vente materiel fin d\'exercice SNR - Ref SNR-DEC', 15000, '2025-12-31'),
    // --- Achats propres ---
    // HA-2025-0501 : Fonderie Alpes — 22/12/2025 — 22 000 HT (propre)
    ...purchaseFec('HA-2025-0501', '2025-12-22', '401030', 'Fonderie des Alpes SA', 'FRN030', 'Fonderie des Alpes SA', 'FRN-2025-0501', 'Achat pieces moulees Fonderie des Alpes', 22000, '2025-12-31'),
    // HA-2025-0502 : Siderurgie Vallee — 27/12/2025 — 16 500 HT (propre)
    ...purchaseFec('HA-2025-0502', '2025-12-27', '401031', 'Siderurgie de la Vallee SARL', 'FRN031', 'Siderurgie de la Vallee SARL', 'FRN-2025-0502', 'Achat profils acier lot SV-2025-12', 16500, '2025-12-31'),
    // --- CUT-002 : Facture apres cloture, BR avant cloture (FNP pattern) ---
    // HA-2026-0012 : Mecanique Precision — 05/01/2026 — 15 800 HT (facture N+1, BR en N)
    ...purchaseFec('HA-2026-0012', '2026-01-05', '401032', 'Mecanique Precision SARL', 'FRN032', 'Mecanique Precision SARL', 'FRN-2026-0012', 'Achat pieces usinees Mecanique Precision - Cde MP-899', 15800, '2026-01-15'),
    // HA-2025-0504 : Robinetterie Industrielle — 30/12/2025 — 9 800 HT (propre)
    ...purchaseFec('HA-2025-0504', '2025-12-30', '401033', 'Robinetterie Industrielle SAS', 'FRN033', 'Robinetterie Industrielle SAS', 'FRN-2025-0504', 'Achat vannes et raccords lot RI-DEC', 9800, '2025-12-31'),
    // --- CUT-005 : Avoir en N+1 annulant partiellement une vente de N ---
    ...creditNoteFec('VE-2026-0005', '2026-01-12', '411041', 'SCI Bellecour', 'CLI041', 'SCI Bellecour', 'AV-2026-0005', 'Avoir sur vente SCI Bellecour du 22/12 - retour partiel 50%', 9600, '2026-01-15'),
  ],
  invoices: [
    // Ventes propres
    makeInvoice('FAC-2025-0888', 'vente', '2025-12-20', 'Transport Besson SARL', 'CLI040', '30 rue de Gerland, 69007 Lyon', '112 345 678 00019', [{ description: 'Pieces detachees vehicules industriels', quantity: 15, unit_price_ht: 1200, total_ht: 18000 }], 'Reglement a 30 jours', '2026-01-19', 'BL-2025-0660', null, null),
    makeInvoice('FAC-2025-0889', 'vente', '2025-12-22', 'SCI Bellecour', 'CLI041', '4 place Bellecour, 69002 Lyon', '223 456 789 00022', [{ description: 'Equipements de maintenance immeuble', quantity: 8, unit_price_ht: 2400, total_ht: 19200 }], 'Reglement a 30 jours', '2026-01-21', 'BL-2025-0661', null, null),
    makeInvoice('FAC-2025-0890', 'vente', '2025-12-26', 'Garage Central SAS', 'CLI042', '78 avenue Berthelot, 69007 Lyon', '334 567 890 00035', [{ description: 'Outillage professionnel commande GC-780', quantity: 10, unit_price_ht: 1250, total_ht: 12500 }], 'Reglement a 30 jours', '2026-01-25', 'BL-2025-0662', null, null),
    // CUT-001 : facture 29/12, BL 03/01
    makeInvoice('FAC-2025-0891', 'vente', '2025-12-29', 'Atelier Durand SAS', 'CLI043', '15 rue des Ateliers, 69100 Villeurbanne', '445 678 901 00048', [{ description: 'Equipements industriels commande AD-115', quantity: 3, unit_price_ht: 9500, total_ht: 28500 }], 'Reglement a 45 jours', '2026-02-12', 'BL-2026-0001', null, null),
    // CUT-004 : pas de BL (linked_bl_ref = null)
    makeInvoice('FAC-2025-0895', 'vente', '2025-12-30', 'Groupe Martin Industries SA', 'CLI044', '90 boulevard Vivier-Merle, 69003 Lyon', '556 789 012 00051', [{ description: 'Equipements lourds commande GM-2025', quantity: 6, unit_price_ht: 7000, total_ht: 42000 }], 'Reglement a 60 jours', '2026-02-28', null, null, null),
    // Vente propre
    makeInvoice('FAC-2025-0896', 'vente', '2025-12-31', 'Societe Nouvelle du Rhone SAS', 'CLI045', '25 rue Garibaldi, 69006 Lyon', '667 890 123 00064', [{ description: 'Materiel fin d\'exercice ref SNR-DEC', quantity: 5, unit_price_ht: 3000, total_ht: 15000 }], 'Reglement a 30 jours', '2026-01-30', 'BL-2025-0665', null, null),
    // Achats propres
    makeInvoice('FRN-2025-0501', 'achat', '2025-12-22', 'Fonderie des Alpes SA', 'FRN030', '12 zone industrielle des Alpes, 38000 Grenoble', '778 901 234 00077', [{ description: 'Pieces moulees en fonte lot FA-2025-12', quantity: 40, unit_price_ht: 550, total_ht: 22000 }], 'Reglement a 60 jours', '2026-02-20', 'BR-2025-0501', null, null),
    makeInvoice('FRN-2025-0502', 'achat', '2025-12-27', 'Siderurgie de la Vallee SARL', 'FRN031', '5 chemin des Forges, 42000 Saint-Etienne', '889 012 345 00080', [{ description: 'Profils acier lot SV-2025-12', quantity: 100, unit_price_ht: 165, total_ht: 16500 }], 'Reglement a 45 jours', '2026-02-10', 'BR-2025-0502', null, null),
    // CUT-002 : facture 05/01/2026, BR 27/12/2025
    makeInvoice('FRN-2026-0012', 'achat', '2026-01-05', 'Mecanique Precision SARL', 'FRN032', '22 rue de l\'Industrie, 69200 Venissieux', '990 123 456 00093', [{ description: 'Pieces usinees haute precision commande MP-899', quantity: 20, unit_price_ht: 790, total_ht: 15800 }], 'Reglement a 30 jours', '2026-02-04', 'BR-2025-0499', null, null),
    makeInvoice('FRN-2025-0504', 'achat', '2025-12-30', 'Robinetterie Industrielle SAS', 'FRN033', '8 allee des Vannes, 69800 Saint-Priest', '101 234 567 00016', [{ description: 'Vannes et raccords industriels lot RI-DEC', quantity: 50, unit_price_ht: 196, total_ht: 9800 }], 'Reglement a 30 jours', '2026-01-29', 'BR-2025-0504', null, null),
    // CUT-005 : avoir annulant 50% de FAC-2025-0889
    makeInvoice('AV-2026-0005', 'avoir', '2026-01-12', 'SCI Bellecour', 'CLI041', '4 place Bellecour, 69002 Lyon', '223 456 789 00022', [{ description: 'Retour partiel equipements - 50% de FAC-2025-0889', quantity: 4, unit_price_ht: 2400, total_ht: 9600 }], 'Avoir a imputer', '2026-01-12', null, 'FAC-2025-0889', 'Retour de 4 equipements sur 8 livres — materiel non conforme aux specifications'),
  ],
  delivery_notes: [
    // Ventes propres
    makeBL('BL-2025-0660', 'livraison', '2025-12-19', '2025-12-20', 'TB-550', 'FAC-2025-0888', 'Transport Besson SARL', 'M. Besson', 'Pieces detachees vehicules industriels', '15 unites', 'M. Besson (gerant)', 'Livraison conforme'),
    makeBL('BL-2025-0661', 'livraison', '2025-12-21', '2025-12-22', 'SB-320', 'FAC-2025-0889', 'SCI Bellecour', 'M. Fournier', 'Equipements de maintenance immeuble', '8 unites', 'M. Fournier (gestionnaire)', 'RAS'),
    makeBL('BL-2025-0662', 'livraison', '2025-12-25', '2025-12-26', 'GC-780', 'FAC-2025-0890', 'Garage Central SAS', 'M. Dupont', 'Outillage professionnel', '10 unites', 'M. Dupont (chef d\'atelier)', 'Livraison complete'),
    // CUT-001 : BL date 03/01/2026 (apres cloture) pour facture du 29/12
    makeBL('BL-2026-0001', 'livraison', '2026-01-02', '2026-01-03', 'AD-115', 'FAC-2025-0891', 'Atelier Durand SAS', 'M. Durand', 'Equipements industriels commande AD-115', '3 unites', 'M. Durand (directeur technique)', 'Livraison reportee au 03/01 — fermeture usine fin decembre'),
    // PAS de BL pour FAC-2025-0895 (CUT-004)
    // Vente propre
    makeBL('BL-2025-0665', 'livraison', '2025-12-30', '2025-12-31', 'SNR-DEC', 'FAC-2025-0896', 'Societe Nouvelle du Rhone SAS', 'M. Morin', 'Materiel ref SNR-DEC', '5 unites', 'Mme Morin (directrice)', 'Derniere livraison de l\'exercice'),
    // Achats propres
    makeBL('BR-2025-0501', 'reception', null, '2025-12-22', 'FA-2025-12', 'FRN-2025-0501', 'Fonderie des Alpes SA', 'Service achats', 'Pieces moulees en fonte', '40 unites', 'M. Vidal (responsable production)', 'Controle qualite OK'),
    makeBL('BR-2025-0502', 'reception', null, '2025-12-27', 'SV-2025-12', 'FRN-2025-0502', 'Siderurgie de la Vallee SARL', 'Service achats', 'Profils acier lot SV-2025-12', '100 unites', 'M. Vidal (responsable production)', 'Reception conforme'),
    // CUT-002 : BR date 27/12/2025 pour facture du 05/01/2026
    makeBL('BR-2025-0499', 'reception', null, '2025-12-27', 'MP-899', 'FRN-2026-0012', 'Mecanique Precision SARL', 'Service achats', 'Pieces usinees haute precision commande MP-899', '20 unites', 'M. Vidal (responsable production)', 'Marchandises reçues le 27/12, facture non parvenue a la cloture'),
    makeBL('BR-2025-0504', 'reception', null, '2025-12-30', 'RI-DEC', 'FRN-2025-0504', 'Robinetterie Industrielle SAS', 'Service achats', 'Vannes et raccords industriels', '50 unites', 'M. Vidal (responsable production)', 'Reception conforme au bon de commande'),
  ],
  expected_signals: [
    {
      signal_id: 'S1',
      rule_triggered: 'CUT-001',
      type: 'rattachement_temporel',
      description:
        'Facture FAC-2025-0891 datee du 29/12/2025 (vente a Atelier Durand SAS, montant 28 500 EUR HT) ' +
        'mais bon de livraison BL-2026-0001 date du 03/01/2026. La facture est enregistree avant la ' +
        'cloture de l\'exercice alors que la livraison effective est constatee apres la cloture. ' +
        'Le rattachement du produit a l\'exercice 2025 necessite l\'attention du commissaire aux comptes.',
      priority: 'high',
      source_document: 'Facture FAC-2025-0891',
      compared_documents: ['Facture FAC-2025-0891', 'Bon de livraison BL-2026-0001'],
      source_extract: 'Facture du 29/12/2025 — BL du 03/01/2026 — Ecart de 5 jours apres cloture',
      invoice_ref: 'FAC-2025-0891',
      bl_ref: 'BL-2026-0001',
      amount: 28500,
      date_gap_days: 5,
    },
    {
      signal_id: 'S2',
      rule_triggered: 'CUT-002',
      type: 'rattachement_temporel',
      description:
        'Facture fournisseur FRN-2026-0012 datee du 05/01/2026 (achat aupres de Mecanique Precision SARL, ' +
        'montant 15 800 EUR HT) mais bon de reception BR-2025-0499 date du 27/12/2025. Les marchandises ' +
        'ont ete receptionnees avant la cloture de l\'exercice mais la facture n\'est parvenue qu\'en N+1. ' +
        'Cette situation de charge a payer (FNP) necessite l\'attention du commissaire aux comptes.',
      priority: 'high',
      source_document: 'Bon de reception BR-2025-0499',
      compared_documents: ['Facture FRN-2026-0012', 'Bon de reception BR-2025-0499'],
      source_extract: 'BR du 27/12/2025 — Facture du 05/01/2026 — Reception avant cloture, facturation apres',
      invoice_ref: 'FRN-2026-0012',
      bl_ref: 'BR-2025-0499',
      amount: 15800,
      date_gap_days: 9,
    },
    {
      signal_id: 'S3',
      rule_triggered: 'CUT-004',
      type: 'absence_piece',
      description:
        'Facture FAC-2025-0895 datee du 30/12/2025 (vente a Groupe Martin Industries SA, montant ' +
        '42 000 EUR HT) sans bon de livraison associe. En l\'absence de preuve de livraison, il n\'est ' +
        'pas possible de verifier la date effective de transfert de propriete et le rattachement ' +
        'du produit a l\'exercice 2025. Cette situation necessite l\'attention du commissaire aux comptes.',
      priority: 'high',
      source_document: 'Facture FAC-2025-0895',
      compared_documents: ['Facture FAC-2025-0895'],
      source_extract: 'Facture du 30/12/2025, 42 000 EUR HT — Aucun bon de livraison retrouve',
      invoice_ref: 'FAC-2025-0895',
      amount: 42000,
    },
    {
      signal_id: 'S4',
      rule_triggered: 'CUT-005',
      type: 'incoherence_montant',
      description:
        'Avoir AV-2026-0005 date du 12/01/2026 annulant 50 % de la facture FAC-2025-0889 ' +
        '(vente du 22/12/2025 a SCI Bellecour). Montant de l\'avoir : 9 600 EUR HT sur un total ' +
        'initial de 19 200 EUR HT. L\'emission d\'un avoir en debut N+1 pour une vente de fin N ' +
        'necessite l\'attention du commissaire aux comptes quant au rattachement du produit a l\'exercice.',
      priority: 'medium',
      source_document: 'Avoir AV-2026-0005',
      compared_documents: ['Avoir AV-2026-0005', 'Facture FAC-2025-0889'],
      source_extract: 'Avoir du 12/01/2026 — 9 600 EUR HT — Reference: retour partiel FAC-2025-0889 du 22/12/2025',
      invoice_ref: 'AV-2026-0005',
      amount: 9600,
    },
  ],
  is_faulty: true,
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const CUTOFF_COMPANIES: CutoffCompany[] = [
  acmeDistributionCutoff,
  legrandTextile,
  meridienInformatique,
  rhoneEquipements,
]

/**
 * Retourne une entreprise aleatoire parmi les 4 disponibles.
 */
export function getRandomCutoffCompany(): CutoffCompany {
  const index = Math.floor(Math.random() * CUTOFF_COMPANIES.length)
  return CUTOFF_COMPANIES[index]
}

/**
 * Retourne une entreprise par son identifiant.
 */
export function getCutoffCompanyById(id: string): CutoffCompany | undefined {
  return CUTOFF_COMPANIES.find((c) => c.id === id)
}

// -----------------------------------------------------------------------------
// Seeded RNG + random discrepancies
// -----------------------------------------------------------------------------

/**
 * Cree un generateur pseudo-aleatoire deterministe a partir d'un seed (ex: missionId).
 * Le meme seed produit toujours la meme sequence de nombres.
 */
function createSeededRng(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  return () => {
    h = Math.imul(h, 1103515245) + 12345 | 0
    return ((h >>> 16) & 0x7fff) / 0x7fff
  }
}

/**
 * Retourne une copie de l'entreprise avec des signaux de cut-off introduits
 * aleatoirement par modification des dates et documents.
 *
 * Les modifications sont deterministes : meme missionId = memes decalages.
 * Au moins 2 signaux sont toujours presents.
 */
export function getCompanyWithDiscrepancies(companyId: string, missionId: string): CutoffCompany | undefined {
  const base = getCutoffCompanyById(companyId)
  if (!base) return undefined

  // Deep clone pour ne pas modifier les donnees de base
  const company = JSON.parse(JSON.stringify(base)) as CutoffCompany
  const rng = createSeededRng(missionId)

  const applied: string[] = []

  // Si l'entreprise a deja des signaux hardcodes (Rhone Equipements), les compter
  if (company.expected_signals.length > 0) {
    company.expected_signals.forEach((s) => {
      if (!applied.includes(s.rule_triggered)) {
        applied.push(s.rule_triggered)
      }
    })
    console.log(
      `[Cutoff] Signaux pre-existants pour ${company.name} (mission ${missionId.slice(0, 8)}...): ` +
      `${applied.length} -- ${applied.join(', ')}`
    )
    return company
  }

  // --- CUT-001 (70% de chance) : Decaler un BL de vente apres la cloture ---
  if (rng() < 0.7) {
    // Prendre la derniere vente avec un BL avant cloture dans la fenetre
    const saleInvoices = company.invoices.filter(
      (inv) => inv.type === 'vente' && inv.linked_bl_ref && inv.date >= '2025-12-25'
    )
    if (saleInvoices.length > 0) {
      const target = saleInvoices[saleInvoices.length - 1]
      const bl = company.delivery_notes.find((dn) => dn.ref === target.linked_bl_ref)
      if (bl && bl.date_delivery <= '2025-12-31') {
        const dayShift = Math.floor(rng() * 5) + 3 // 3 a 7 jours apres cloture
        bl.date_delivery = `2026-01-${String(dayShift).padStart(2, '0')}`
        if (bl.date_expedition) {
          bl.date_expedition = `2026-01-${String(Math.max(1, dayShift - 1)).padStart(2, '0')}`
        }
        bl.observations = `Livraison reportee en janvier 2026 — fermeture fin decembre`
        applied.push('CUT-001')
      }
    }
  }

  // --- CUT-002 (60% de chance) : Decaler une facture achat apres la cloture ---
  if (rng() < 0.6) {
    const purchaseInvoices = company.invoices.filter(
      (inv) => inv.type === 'achat' && inv.date >= '2025-12-25' && inv.date <= '2025-12-31'
    )
    if (purchaseInvoices.length > 0) {
      const target = purchaseInvoices[purchaseInvoices.length - 1]
      const dayShift = Math.floor(rng() * 7) + 3 // 3 a 9 jours apres cloture
      target.date = `2026-01-${String(dayShift).padStart(2, '0')}`
      target.due_date = `2026-02-${String(dayShift).padStart(2, '0')}`
      // Mettre a jour les FEC correspondantes
      const fecEntries = company.fec_entries.filter((e) => e.piece_ref === target.ref)
      fecEntries.forEach((e) => {
        e.ecriture_date = target.date
        e.piece_date = target.date
        e.valid_date = '2026-01-15'
      })
      applied.push('CUT-002')
    }
  }

  // --- CUT-004 (50% de chance) : Supprimer un BL de vente ---
  if (rng() < 0.5) {
    const saleWithBL = company.invoices.filter(
      (inv) => inv.type === 'vente' && inv.linked_bl_ref && inv.date >= '2025-12-26'
    )
    if (saleWithBL.length > 0) {
      const target = saleWithBL[0]
      const blIdx = company.delivery_notes.findIndex((dn) => dn.ref === target.linked_bl_ref)
      if (blIdx >= 0) {
        company.delivery_notes.splice(blIdx, 1)
        target.linked_bl_ref = null
        applied.push('CUT-004')
      }
    }
  }

  // --- CUT-005 (80% de chance, force si < 2 signaux) : Ajouter un avoir N+1 ---
  if (rng() < 0.8 || applied.length < 2) {
    // Choisir une vente de decembre comme cible
    const decSales = company.invoices.filter(
      (inv) => inv.type === 'vente' && inv.date >= '2025-12-20' && inv.date <= '2025-12-31'
    )
    if (decSales.length > 0) {
      const target = decSales[Math.floor(rng() * decSales.length)]
      const avoirHt = Math.round(target.total_ht * 0.5)
      const avoirRef = `AV-2026-${String(Math.floor(rng() * 900) + 100).padStart(4, '0')}`
      const avoirDate = `2026-01-${String(Math.floor(rng() * 15) + 5).padStart(2, '0')}`

      // Ajouter la facture d'avoir
      company.invoices.push(
        makeInvoice(
          avoirRef, 'avoir', avoirDate, target.client_or_supplier, target.client_code,
          target.address, target.siret,
          [{ description: `Retour partiel - 50% de ${target.ref}`, quantity: 1, unit_price_ht: avoirHt, total_ht: avoirHt }],
          'Avoir a imputer', avoirDate, null, target.ref,
          `Retour materiel non conforme aux specifications — reference facture originale ${target.ref}`
        )
      )

      // Ajouter les ecritures FEC d'avoir
      const clientFec = company.fec_entries.find(
        (e) => e.piece_ref === target.ref && e.compte_num.startsWith('411')
      )
      if (clientFec) {
        company.fec_entries.push(
          ...creditNoteFec(
            `VE-2026-${avoirRef.slice(-4)}`, avoirDate,
            clientFec.compte_num, clientFec.compte_lib.replace('Clients - ', ''),
            clientFec.comp_aux_num!, clientFec.comp_aux_lib!,
            avoirRef, `Avoir sur vente ${target.client_or_supplier} du ${target.date.slice(8)}/${target.date.slice(5, 7)} - retour partiel`,
            avoirHt, '2026-01-15'
          )
        )
      }

      applied.push('CUT-005')
    }
  }

  // --- Garantir au moins 2 signaux ---
  // Forcer CUT-001 si pas encore applique
  if (applied.length < 2 && !applied.includes('CUT-001')) {
    const saleInvoices = company.invoices.filter(
      (inv) => inv.type === 'vente' && inv.linked_bl_ref && inv.date >= '2025-12-26'
    )
    if (saleInvoices.length > 0) {
      const target = saleInvoices[saleInvoices.length - 1]
      const bl = company.delivery_notes.find((dn) => dn.ref === target.linked_bl_ref)
      if (bl && bl.date_delivery <= '2025-12-31') {
        bl.date_delivery = '2026-01-04'
        if (bl.date_expedition) bl.date_expedition = '2026-01-03'
        bl.observations = 'Livraison reportee debut janvier 2026'
        applied.push('CUT-001')
      }
    }
  }

  // Forcer CUT-004 si toujours pas assez
  if (applied.length < 2 && !applied.includes('CUT-004')) {
    const saleWithBL = company.invoices.filter(
      (inv) => inv.type === 'vente' && inv.linked_bl_ref
    )
    if (saleWithBL.length > 0) {
      const target = saleWithBL[0]
      const blIdx = company.delivery_notes.findIndex((dn) => dn.ref === target.linked_bl_ref)
      if (blIdx >= 0) {
        company.delivery_notes.splice(blIdx, 1)
        target.linked_bl_ref = null
        applied.push('CUT-004')
      }
    }
  }

  console.log(
    `[Cutoff] Decalages appliques pour ${company.name} (mission ${missionId.slice(0, 8)}...): ` +
    `${applied.length} -- ${applied.join(', ') || 'aucun'}`
  )

  return company
}
