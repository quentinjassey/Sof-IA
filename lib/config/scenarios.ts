// lib/config/scenarios.ts
// Configuration d'affichage des scenarios de mission.
// Source: CONTEXTE_PROJET_SOFIA.md et ARCHITECTURE_POC_SOFIA.md

import type { ScenarioType } from './expected-documents';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ScenarioConfig {
  /** Identifiant technique du scenario */
  id: ScenarioType;
  /** Libelle court en francais */
  label: string;
  /** Description du scenario pour l'ecran d'accueil */
  description: string;
  /** Description etendue pour le contexte de mission */
  longDescription: string;
  /** Nom de l'icone Lucide React */
  icon: string;
  /** Nom de la societe fictive utilisee pour la demonstration */
  company: string;
  /** Date de cloture de l'exercice */
  fiscal_year: string;
  /** Resume de la pre-analyse realisee dans ce scenario */
  summary: string;
  /** Moment d'intervention dans la mission d'audit */
  timing: string;
  /** Objectif du commissaire aux comptes dans ce scenario */
  objective: string;
  /** Ce que Sof'IA realise dans ce scenario (perimetre) */
  sofia_does: string[];
  /** Ce que Sof'IA ne fait pas dans ce scenario (hors perimetre) */
  sofia_does_not: string[];
}

// -----------------------------------------------------------------------------
// Configuration des scenarios
// -----------------------------------------------------------------------------

export const scenarios: Record<ScenarioType, ScenarioConfig> = {
  // -------------------------------------------------------------------------
  // Scenario 1 : Sondage sur le chiffre d'affaires
  // -------------------------------------------------------------------------
  sondage_ca: {
    id: 'sondage_ca',
    label: 'Sondage sur le chiffre d\'affaires',
    description: 'Pre-analyse documentaire pour le controle des ventes',
    longDescription:
      'Preparation du dossier documentaire des ecritures de vente selectionnees par le commissaire aux comptes dans le cadre du sondage sur le chiffre d\'affaires.',
    icon: 'FileSearch',
    company: 'ACME Distribution SAS',
    fiscal_year: '2025-12-31',
    summary:
      'Verification de la coherence documentaire entre le FEC, les factures de vente et les bons de livraison pour un echantillon d\'ecritures comptables.',
    timing: 'Phase de planification et de travaux sur le cycle ventes',
    objective:
      'Preparer le dossier documentaire des ecritures selectionnees par le commissaire aux comptes pour le sondage.',
    sofia_does: [
      'Rattachement des pieces justificatives aux ecritures selectionnees',
      'Signalement des absences ou incoherences documentaires',
      'Trace des controles realises',
    ],
    sofia_does_not: [
      'Selection de l\'echantillon (responsabilite du CAC)',
      'Extrapolation statistique',
      'Conclusion sur la regularite du chiffre d\'affaires',
    ],
  },

  // -------------------------------------------------------------------------
  // Scenario 2 : Cesure d'exercice / Cut-off
  // -------------------------------------------------------------------------
  cutoff: {
    id: 'cutoff',
    label: 'Cesure d\'exercice (cut-off)',
    description: 'Pre-analyse documentaire de la cesure d\'exercice',
    longDescription:
      'Identification des operations necessitant une attention particuliere en matiere de rattachement temporel autour de la date de cloture.',
    icon: 'CalendarClock',
    company: 'ACME Distribution SAS',
    fiscal_year: '2025-12-31',
    summary:
      'Analyse des operations comptabilisees autour de la date de cloture (31/12/2025) pour verifier la coherence documentaire du rattachement temporel.',
    timing: 'Travaux de cloture autour de la date d\'arrete des comptes',
    objective:
      'Identifier les operations necessitant une attention particuliere en matiere de rattachement temporel.',
    sofia_does: [
      'Identification des operations proches de la cloture',
      'Rapprochement factures, livraisons et prestations',
      'Signalement des situations documentaires necessitant l\'attention du CAC',
    ],
    sofia_does_not: [
      'Qualification d\'erreurs comptables',
      'Reclassification des ecritures',
      'Conclusion sur la conformite de la cesure',
    ],
  },

  // -------------------------------------------------------------------------
  // Scenario 3 : Pointage des etats financiers
  // -------------------------------------------------------------------------
  pointage: {
    id: 'pointage',
    label: 'Coherence des etats financiers',
    description: 'Coherence documentaire des etats financiers et de l\'annexe',
    longDescription:
      'Verification de la coherence et de l\'exhaustivite documentaire entre le bilan, le compte de resultat et l\'annexe aux comptes annuels.',
    icon: 'FileCheck2',
    company: 'ACME Distribution SAS',
    fiscal_year: '2025-12-31',
    summary:
      'Pointage de la coherence factuelle entre les montants du bilan, du compte de resultat et les informations presentees dans l\'annexe aux comptes annuels.',
    timing: 'Phase de finalisation avant emission du rapport',
    objective:
      'Verifier la coherence et l\'exhaustivite documentaire des comptes annuels.',
    sofia_does: [
      'Controle de la presence des informations attendues dans l\'annexe',
      'Verification de la coherence factuelle entre etats financiers et annexe',
      'Signalement des incoherences ou absences documentaires',
    ],
    sofia_does_not: [
      'Validation des comptes',
      'Conclusion sur la conformite reglementaire',
      'Qualification du caractere correct ou incorrect des etats financiers',
    ],
  },
};

// -----------------------------------------------------------------------------
// Fonctions utilitaires
// -----------------------------------------------------------------------------

/**
 * Retourne la configuration d'un scenario par son identifiant.
 */
export function getScenario(id: ScenarioType): ScenarioConfig {
  return scenarios[id];
}

/**
 * Retourne la liste de tous les scenarios sous forme de tableau.
 */
export function getAllScenarios(): ScenarioConfig[] {
  return Object.values(scenarios);
}

/**
 * Retourne le libelle francais d'un scenario.
 */
export function getScenarioLabel(id: ScenarioType): string {
  return scenarios[id]?.label ?? id;
}

/**
 * Retourne les identifiants de tous les scenarios disponibles.
 */
export function getScenarioIds(): ScenarioType[] {
  return Object.keys(scenarios) as ScenarioType[];
}

/**
 * Verifie si un identifiant correspond a un scenario valide.
 */
export function isValidScenario(id: string): id is ScenarioType {
  return id in scenarios;
}

// -----------------------------------------------------------------------------
// Labels d'affichage pour les statuts de mission
// -----------------------------------------------------------------------------

export type MissionStatus =
  | 'created'
  | 'documents_ready'
  | 'uploading'
  | 'upload_failed'
  | 'analyzing'
  | 'analysis_failed'
  | 'analyzed'
  | 'in_review'
  | 'completed';

/** Labels francais pour les statuts de mission */
export const missionStatusLabels: Record<MissionStatus, string> = {
  created: 'Creee',
  documents_ready: 'Documents prets',
  uploading: 'Envoi en cours',
  upload_failed: 'Echec de l\'envoi',
  analyzing: 'Pre-analyse en cours',
  analysis_failed: 'Echec de l\'analyse',
  analyzed: 'Pre-analyse terminee',
  in_review: 'En cours de revue',
  completed: 'Terminee',
};

/** Couleurs CSS suggerees pour les statuts de mission (classes Tailwind) */
export const missionStatusColors: Record<MissionStatus, { bg: string; text: string }> = {
  created: { bg: 'bg-gray-100', text: 'text-gray-600' },
  documents_ready: { bg: 'bg-blue-50', text: 'text-blue-700' },
  uploading: { bg: 'bg-blue-50', text: 'text-blue-600' },
  upload_failed: { bg: 'bg-red-50', text: 'text-red-700' },
  analyzing: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  analysis_failed: { bg: 'bg-red-50', text: 'text-red-700' },
  analyzed: { bg: 'bg-green-50', text: 'text-green-700' },
  in_review: { bg: 'bg-amber-50', text: 'text-amber-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-800' },
};

// -----------------------------------------------------------------------------
// Etapes de progression de l'analyse (pour l'UI de suivi)
// -----------------------------------------------------------------------------

export interface AnalysisStep {
  /** Numero de l'etape (1-6) */
  step_number: number;
  /** Identifiant technique */
  key: string;
  /** Libelle francais */
  label: string;
  /** Description de l'etape */
  description: string;
}

/** Les 6 etapes de la pre-analyse documentaire (correspondant au workflow N8N WF-02) */
export const analysisSteps: AnalysisStep[] = [
  {
    step_number: 1,
    key: 'fec_parsing',
    label: 'Lecture du FEC',
    description: 'Extraction et structuration des ecritures comptables du FEC.',
  },
  {
    step_number: 2,
    key: 'pdf_extraction',
    label: 'Extraction des pieces justificatives',
    description: 'Extraction du texte et des metadonnees des documents PDF.',
  },
  {
    step_number: 3,
    key: 'rapprochement',
    label: 'Rapprochement ecritures et pieces',
    description: 'Mise en correspondance des ecritures comptables avec les pieces justificatives.',
  },
  {
    step_number: 4,
    key: 'analyse_documentaire',
    label: 'Analyse documentaire',
    description: 'Detection des signaux documentaires factuels par comparaison des documents.',
  },
  {
    step_number: 5,
    key: 'consolidation',
    label: 'Consolidation des signaux',
    description: 'Regroupement, deduplication et classement des signaux par priorite.',
  },
  {
    step_number: 6,
    key: 'generation_livrables',
    label: 'Generation des livrables',
    description: 'Creation de la check-list, du tableau des signaux, de la synthese et du journal.',
  },
];

// -----------------------------------------------------------------------------
// Mention obligatoire (disclaimer)
// -----------------------------------------------------------------------------

/** Mention obligatoire a afficher sur tout ecran presentant des resultats de Sof'IA */
export const SOFIA_DISCLAIMER =
  'Analyse automatique \u2014 a valider par le commissaire aux comptes. Sof\'IA ne se substitue pas au jugement professionnel.';

/** Version courte du disclaimer pour les espaces reduits */
export const SOFIA_DISCLAIMER_SHORT =
  'Pre-analyse automatique \u2014 validation humaine requise.';
