// lib/config/expected-signals.ts
// Mapping complet des signaux documentaires attendus par scenario.
// Source: data/README.txt — Signaux attendus pour chaque jeu de donnees fictif.
//
// Ce fichier est la reference pour les tests de validation du POC :
// chaque signal attendu doit etre detecte lors de la pre-analyse du jeu
// de donnees correspondant.
//
// VOCABULAIRE OBLIGATOIRE :
// - "signal documentaire" (jamais "anomalie")
// - "constat factuel" (jamais "conclusion")
// - "necessite l'attention du CAC" (jamais "significatif")

import type { ScenarioType } from './expected-documents';
import type { SignalType, SignalPriority } from './signal-rules';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ExpectedSignal {
  /** Identifiant court du signal dans le scenario (S1, S2, ...) */
  signal_id: string;
  /** Regle de detection declenchee (ex: SCA-001, CUT-002, PTG-005) */
  rule_triggered: string;
  /** Type de signal documentaire */
  type: SignalType;
  /** Description factuelle en francais du signal attendu */
  description: string;
  /** Priorite du signal */
  priority: SignalPriority;
  /** Document source declenchant le signal (reference du document) */
  source_document: string;
  /** Documents compares lors de la detection (references) */
  compared_documents: string[];
  /** Page ou section du document source, si applicable */
  source_page?: string;
  /** Montant concerne, si applicable (en euros HT) */
  amount_ht?: number;
  /** Ecart constate, si applicable (en euros HT ou en pourcentage) */
  discrepancy?: string;
  /** Reference NEP associee, si applicable */
  nep_reference?: string;
}

export interface ScenarioExpectedSignals {
  /** Type de scenario */
  scenario: ScenarioType;
  /** Libelle du scenario en francais */
  label: string;
  /** Societe fictive concernee */
  company: string;
  /** Exercice audite */
  fiscal_year: string;
  /** Nombre total de signaux attendus */
  total_signals: number;
  /** Signaux attendus */
  signals: ExpectedSignal[];
}

// -----------------------------------------------------------------------------
// Signaux attendus par scenario
// -----------------------------------------------------------------------------

/**
 * SCENARIO 1 : Sondage sur le chiffre d'affaires
 *
 * 9 ecritures de vente (FAC-2025-0847 a FAC-2025-0855), 6 bons de livraison
 * (BL-2025-0612 a BL-2025-0617). Volontairement 6 BL pour 9 factures.
 *
 * 4 signaux attendus.
 */
const sondageCaSignals: ScenarioExpectedSignals = {
  scenario: 'sondage_ca',
  label: 'Sondage sur le chiffre d\'affaires',
  company: 'ACME Distribution SAS',
  fiscal_year: '2025',
  total_signals: 4,
  signals: [
    {
      signal_id: 'S1',
      rule_triggered: 'SCA-001',
      type: 'absence_piece',
      description:
        'Facture FAC-2025-0851 (SAS Moreau Industries, 35 000,00 EUR HT) sans bon de livraison associe. ' +
        'La facture mentionne une livraison et installation prevues courant decembre 2025, ' +
        'mais aucun bon de livraison n\'a ete fourni.',
      priority: 'high',
      source_document: 'FAC-2025-0851',
      compared_documents: ['FAC-2025-0851', 'FEC_ACME_2025.txt'],
      source_page: 'Page 1',
      amount_ht: 35000,
      nep_reference: 'NEP 500',
    },
    {
      signal_id: 'S2',
      rule_triggered: 'SCA-001',
      type: 'absence_piece',
      description:
        'Facture FAC-2025-0854 (SARL Dubois Commerce, 18 000,00 EUR HT) sans bon de livraison associe. ' +
        'La facture mentionne une livraison prevue en semaine 2 de janvier 2026.',
      priority: 'high',
      source_document: 'FAC-2025-0854',
      compared_documents: ['FAC-2025-0854', 'FEC_ACME_2025.txt'],
      source_page: 'Page 1',
      amount_ht: 18000,
      nep_reference: 'NEP 500',
    },
    {
      signal_id: 'S3',
      rule_triggered: 'SCA-002',
      type: 'incoherence_montant',
      description:
        'Ecart de montant entre la facture FAC-2025-0852 (12 500,00 EUR HT) et le bon de livraison ' +
        'BL-2025-0616 (13 250,00 EUR HT livre). Ecart de 750,00 EUR (6,0 %) du a 10 unites Serie C ' +
        'ajoutees en complement de livraison.',
      priority: 'high',
      source_document: 'FAC-2025-0852',
      compared_documents: ['FAC-2025-0852', 'BL-2025-0616', 'FEC_ACME_2025.txt'],
      source_page: 'Page 1',
      amount_ht: 12500,
      discrepancy: '750,00 EUR (6,0 %)',
      nep_reference: 'NEP 500',
    },
    {
      signal_id: 'S4',
      rule_triggered: 'SCA-005',
      type: 'rattachement_temporel',
      description:
        'Facture FAC-2025-0855 datee du 30/12/2025 (vente comptabilisee en N). ' +
        'Bon de livraison BL-2025-0617 date du 03/01/2026 (expedition en N+1). ' +
        'La vente est enregistree sur l\'exercice 2025 alors que la livraison effective ' +
        'est datee de l\'exercice 2026. Le rattachement temporel necessite l\'attention du CAC.',
      priority: 'high',
      source_document: 'FAC-2025-0855',
      compared_documents: ['FAC-2025-0855', 'BL-2025-0617', 'FEC_ACME_2025.txt'],
      source_page: 'Page 1',
      amount_ht: 47000,
      nep_reference: 'NEP 500, paragraphe A14',
    },
  ],
};

/**
 * SCENARIO 2 : Cesure d'exercice / Cut-off
 *
 * Ecritures des journaux VE (ventes) et HA (achats), periode 18/12/2025 au 10/01/2026.
 * 5 factures de vente, 3 factures fournisseurs, 1 avoir.
 * 3 bons de livraison clients, 2 bons de reception fournisseurs.
 *
 * 4 signaux attendus.
 */
const cutoffSignals: ScenarioExpectedSignals = {
  scenario: 'cutoff',
  label: 'Cesure d\'exercice (cut-off)',
  company: 'ACME Distribution SAS',
  fiscal_year: '2025',
  total_signals: 4,
  signals: [
    {
      signal_id: 'S1',
      rule_triggered: 'CUT-001',
      type: 'rattachement_temporel',
      description:
        'Facture FAC-2025-1182 datee du 29/12/2025 (facture avant cloture), ' +
        'bon de livraison BL-2025-0782 date du 05/01/2026 (livraison apres cloture). ' +
        'Vente de 44 000,00 EUR HT (Ets Lambert Industrie) comptabilisee en 2025, ' +
        'marchandise expediee en 2026. Le rattachement du produit a l\'exercice necessite ' +
        'une verification par le commissaire aux comptes.',
      priority: 'high',
      source_document: 'FAC-2025-1182',
      compared_documents: ['FAC-2025-1182', 'BL-2025-0782', 'FEC_ACME_2025_cutoff.txt'],
      source_page: 'Page 1',
      amount_ht: 44000,
      nep_reference: 'NEP 500, paragraphe A14',
    },
    {
      signal_id: 'S2',
      rule_triggered: 'CUT-002',
      type: 'rattachement_temporel',
      description:
        'Facture fournisseur FRN-2025-0489 datee du 02/01/2026 (facture apres cloture), ' +
        'bon de reception BR-2025-0345 date du 28/12/2025 (reception avant cloture). ' +
        'Achat de 7 800,00 EUR HT (Blanc Composants SA) receptionne en 2025, facture en 2026. ' +
        'La charge pourrait devoir etre rattachee a l\'exercice 2025.',
      priority: 'high',
      source_document: 'FRN-2025-0489',
      compared_documents: ['FRN-2025-0489', 'BR-2025-0345', 'FEC_ACME_2025_cutoff.txt'],
      source_page: 'Page 1',
      amount_ht: 7800,
      nep_reference: 'NEP 500, paragraphe A14',
    },
    {
      signal_id: 'S3',
      rule_triggered: 'CUT-004',
      type: 'absence_piece',
      description:
        'Facture FAC-2025-1183 datee du 30/12/2025 (SAS Perrin Solutions, prestation de service, ' +
        '16 000,00 EUR HT). Aucun justificatif de date de realisation de la prestation. ' +
        'La facture mentionne des dates de prestation (16, 17, 18/12/2025) mais sans piece ' +
        'probante (proces-verbal de reception, feuille de temps, etc.). ' +
        'L\'absence de ce justificatif ne permet pas de verifier le rattachement temporel.',
      priority: 'high',
      source_document: 'FAC-2025-1183',
      compared_documents: ['FAC-2025-1183', 'FEC_ACME_2025_cutoff.txt'],
      source_page: 'Page 1',
      amount_ht: 16000,
    },
    {
      signal_id: 'S4',
      rule_triggered: 'CUT-005',
      type: 'incoherence_montant',
      description:
        'Avoir AV-2026-0001 date du 10/01/2026 annulant partiellement la vente ' +
        'FAC-2025-1181 du 22/12/2025 (SARL Mercier & Cie). Avoir de 6 000,00 EUR HT ' +
        'emis en N+1 sur une vente de 12 000,00 EUR HT enregistree en N. ' +
        'Le retour partiel de marchandises (10 unites non conformes retournees le 08/01/2026) ' +
        'necessite l\'attention du commissaire aux comptes.',
      priority: 'medium',
      source_document: 'AV-2026-0001',
      compared_documents: ['AV-2026-0001', 'FAC-2025-1181', 'FEC_ACME_2025_cutoff.txt'],
      source_page: 'Page 1',
      amount_ht: 6000,
      discrepancy: 'Avoir de 6 000,00 EUR sur vente initiale de 12 000,00 EUR',
    },
  ],
};

/**
 * SCENARIO 3 : Pointage des etats financiers
 *
 * Bilan, compte de resultat et annexe aux comptes annuels.
 * Total actif = Total passif = 2 450 000,00 EUR.
 * CA net : 4 050 000,00 EUR. Resultat net : 128 000,00 EUR.
 *
 * 3 signaux attendus.
 */
const pointageSignals: ScenarioExpectedSignals = {
  scenario: 'pointage',
  label: 'Pointage des etats financiers',
  company: 'ACME Distribution SAS',
  fiscal_year: '2025',
  total_signals: 3,
  signals: [
    {
      signal_id: 'S1',
      rule_triggered: 'PTG-001',
      type: 'incoherence_montant',
      description:
        'Ecart entre le poste "Immobilisations corporelles" au bilan ' +
        '(valeur nette : 996 000,00 EUR) et le montant indique dans l\'annexe Note 3 ' +
        '(valeur nette : 981 000,00 EUR). Ecart de 15 000,00 EUR. ' +
        'Le bilan presente un total brut de 1 530 000,00 EUR et des amortissements de 534 000,00 EUR ' +
        '(net = 996 000,00 EUR). L\'annexe indique un total brut de 1 515 000,00 EUR et des ' +
        'amortissements de 519 000,00 EUR (net = 981 000,00 EUR, en excluant la cession).',
      priority: 'high',
      source_document: 'bilan_ACME_2025.txt',
      compared_documents: ['bilan_ACME_2025.txt', 'annexe_ACME_2025.txt'],
      source_page: 'Bilan — Actif immobilise / Annexe — Note 3',
      amount_ht: 996000,
      discrepancy: '15 000,00 EUR',
      nep_reference: 'NEP 500',
    },
    {
      signal_id: 'S2',
      rule_triggered: 'PTG-002',
      type: 'incompletude',
      description:
        'Information obligatoire absente de l\'annexe : les engagements hors bilan ne sont pas ' +
        'mentionnes. L\'annexe ne contient aucune note relative aux engagements hors bilan ' +
        '(cautions, garanties donnees, engagements de credit-bail, etc.), ce qui est une ' +
        'information obligatoire au titre de l\'article L. 123-13 du Code de Commerce.',
      priority: 'medium',
      source_document: 'annexe_ACME_2025.txt',
      compared_documents: ['annexe_ACME_2025.txt'],
      source_page: 'Annexe — Ensemble du document (absence constatee)',
      nep_reference: 'NEP 500',
    },
    {
      signal_id: 'S3',
      rule_triggered: 'PTG-005',
      type: 'rupture_chaine',
      description:
        'Variation notable du poste "Autres charges externes" : 95 000,00 EUR en 2025 contre ' +
        '52 000,00 EUR en 2024, soit une hausse de +82,7 %. ' +
        'L\'annexe (Note 14) fournit un detail partiel (frais de recrutement 25 000 EUR, ' +
        'formation 18 000 EUR, cotisations 12 000 EUR) mais 40 000 EUR restent sous la ' +
        'mention "Divers" sans explication suffisante de cette variation.',
      priority: 'medium',
      source_document: 'compte_resultat_ACME_2025.txt',
      compared_documents: ['compte_resultat_ACME_2025.txt', 'annexe_ACME_2025.txt'],
      source_page: 'Compte de resultat — Charges d\'exploitation / Annexe — Note 14',
      amount_ht: 95000,
      discrepancy: '+43 000,00 EUR (+82,7 %)',
    },
  ],
};

// -----------------------------------------------------------------------------
// Export principal
// -----------------------------------------------------------------------------

/**
 * Mapping complet des signaux attendus par scenario.
 *
 * Utilisation :
 * ```ts
 * import { EXPECTED_SIGNALS } from '@/lib/config/expected-signals';
 *
 * const signals = EXPECTED_SIGNALS.sondage_ca.signals;
 * const total = EXPECTED_SIGNALS.cutoff.total_signals;
 * ```
 */
export const EXPECTED_SIGNALS: Record<ScenarioType, ScenarioExpectedSignals> = {
  sondage_ca: sondageCaSignals,
  cutoff: cutoffSignals,
  pointage: pointageSignals,
};

// -----------------------------------------------------------------------------
// Fonctions utilitaires
// -----------------------------------------------------------------------------

/**
 * Retourne les signaux attendus pour un scenario donne.
 */
export function getExpectedSignals(scenario: ScenarioType): ExpectedSignal[] {
  return EXPECTED_SIGNALS[scenario]?.signals ?? [];
}

/**
 * Retourne le nombre total de signaux attendus pour un scenario.
 */
export function getExpectedSignalCount(scenario: ScenarioType): number {
  return EXPECTED_SIGNALS[scenario]?.total_signals ?? 0;
}

/**
 * Retourne les signaux attendus pour un scenario, filtres par regle declenchee.
 */
export function getExpectedSignalsByRule(
  scenario: ScenarioType,
  ruleId: string
): ExpectedSignal[] {
  return getExpectedSignals(scenario).filter(
    (signal) => signal.rule_triggered === ruleId
  );
}

/**
 * Retourne les signaux attendus pour un scenario, filtres par priorite.
 */
export function getExpectedSignalsByPriority(
  scenario: ScenarioType,
  priority: SignalPriority
): ExpectedSignal[] {
  return getExpectedSignals(scenario).filter(
    (signal) => signal.priority === priority
  );
}

/**
 * Retourne les signaux attendus pour un scenario, filtres par type de signal.
 */
export function getExpectedSignalsByType(
  scenario: ScenarioType,
  signalType: SignalType
): ExpectedSignal[] {
  return getExpectedSignals(scenario).filter(
    (signal) => signal.type === signalType
  );
}

/**
 * Retourne un signal attendu specifique par son identifiant dans un scenario.
 */
export function getExpectedSignalById(
  scenario: ScenarioType,
  signalId: string
): ExpectedSignal | undefined {
  return getExpectedSignals(scenario).find(
    (signal) => signal.signal_id === signalId
  );
}

/**
 * Retourne le nombre de signaux attendus par niveau de priorite pour un scenario.
 */
export function getExpectedSignalCountByPriority(
  scenario: ScenarioType
): Record<SignalPriority, number> {
  const signals = getExpectedSignals(scenario);
  return {
    high: signals.filter((s) => s.priority === 'high').length,
    medium: signals.filter((s) => s.priority === 'medium').length,
    low: signals.filter((s) => s.priority === 'low').length,
  };
}

/**
 * Retourne le nombre total de signaux attendus tous scenarios confondus.
 */
export function getTotalExpectedSignalCount(): number {
  return Object.values(EXPECTED_SIGNALS).reduce(
    (sum, scenario) => sum + scenario.total_signals,
    0
  );
}
