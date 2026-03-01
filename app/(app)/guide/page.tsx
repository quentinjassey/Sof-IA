'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  FolderPlus,
  Upload,
  Play,
  FileCheck,
  AlertTriangle,
  UserCheck,
  FileText,
  Clock,
  Shield,
  BookOpen,
  ChevronRight,
  Info,
  CheckCircle2,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepCardProps {
  step: number
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}

function StepCard({ step, icon, title, children }: StepCardProps) {
  return (
    <div className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/20 hover:shadow-sm">
      <div className="absolute -left-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
        {step}
      </div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          {icon}
        </div>
        <h3 className="font-serif text-lg text-foreground">{title}</h3>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  )
}

interface DeliverableCardProps {
  icon: React.ReactNode
  title: string
  description: string
  format: string
}

function DeliverableCard({ icon, title, description, format }: DeliverableCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
        <span className="mt-2 inline-block rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {format}
        </span>
      </div>
    </div>
  )
}

export default function GuidePage() {
  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto p-5 sm:p-6 lg:p-8">
      {/* Back navigation */}
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux projets
      </Link>

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl tracking-tight text-foreground">
              Guide d&apos;utilisation — Sof&apos;IA
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              POC HackAudit 2026 — Pré-analyse documentaire pour commissaires aux comptes
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <section className="mb-10">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-6">
          <h2 className="mb-3 font-serif text-lg text-foreground">Qu&apos;est-ce que Sof&apos;IA ?</h2>
          <p className="text-sm leading-relaxed text-foreground/90">
            Sof&apos;IA est un outil d&apos;aide à la <strong>pré-analyse documentaire</strong> conçu pour
            les commissaires aux comptes. Elle automatise le rapprochement entre écritures comptables (FEC),
            pièces justificatives (factures, bons de livraison) et documents financiers pour identifier
            les zones nécessitant l&apos;attention du professionnel.
          </p>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-foreground/80">
              <strong>Principe fondamental :</strong> Sof&apos;IA ne se substitue jamais au jugement professionnel
              du commissaire aux comptes. Elle éclaire, le CAC décide.
            </p>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mb-10">
        <h2 className="mb-6 font-serif text-xl text-foreground">
          Parcours d&apos;utilisation
        </h2>
        <div className="space-y-6">
          <StepCard
            step={1}
            icon={<FolderPlus className="h-5 w-5 text-primary" />}
            title="Créer un nouveau projet"
          >
            <p>
              Depuis la page <strong>Projets</strong>, cliquez sur <strong>«&nbsp;Nouveau projet&nbsp;»</strong>.
              Renseignez le nom du client (exemple : <em>Audit ACME Distribution SAS — Exercice 2025</em>)
              et une description optionnelle.
            </p>
            <p>
              Chaque projet constitue un dossier de travail indépendant, isolé par votre licence.
            </p>
          </StepCard>

          <StepCard
            step={2}
            icon={<Upload className="h-5 w-5 text-primary" />}
            title="Importer les documents"
          >
            <p>
              Dans la vue projet, utilisez la zone de dépôt pour importer vos fichiers.
              Les documents attendus dépendent du scénario d&apos;analyse :
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong>Sondage CA :</strong> FEC (fichier .txt), factures de vente, bons de livraison</li>
              <li><strong>Cut-off :</strong> FEC, factures autour de la date de clôture, bons de livraison/réception</li>
              <li><strong>Pointage :</strong> Bilan, Compte de résultat, Annexe</li>
            </ul>
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Les jeux de données de test vous sont fournis. Importez l&apos;ensemble des fichiers
                du scénario choisi. N&apos;oubliez pas de <strong>classer</strong> vos documents dans
                la bonne catégorie après import.
              </p>
            </div>
          </StepCard>

          <StepCard
            step={3}
            icon={<Play className="h-5 w-5 text-primary" />}
            title="Lancer l'analyse"
          >
            <p>
              Une fois vos documents importés et classés, créez une nouvelle analyse depuis la vue projet en
              sélectionnant le <strong>type de mission</strong> correspondant à vos documents (sondage CA, cut-off ou pointage).
            </p>
            <p>
              L&apos;analyse sera traitée automatiquement. Vous pourrez suivre
              sa progression en temps réel.
            </p>
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-foreground" />
              <p className="text-xs text-warning-foreground">
                <strong>Durée :</strong> L&apos;analyse implique l&apos;extraction de texte, le parsing du FEC,
                le rapprochement documentaire et l&apos;analyse par IA. Comptez <strong>2 à 5 minutes</strong> selon
                le volume de documents. L&apos;écran de suivi vous informe de chaque étape.
              </p>
            </div>
          </StepCard>

          <StepCard
            step={4}
            icon={<AlertTriangle className="h-5 w-5 text-primary" />}
            title="Consulter les signaux documentaires"
          >
            <p>
              Une fois l&apos;analyse terminée, accédez à la page <strong>Signaux</strong> de la mission.
              Vous y trouverez la liste des <strong>signaux documentaires</strong> détectés par Sof&apos;IA :
              absences de pièces, écarts de montants, incohérences temporelles, etc.
            </p>
            <p>
              Chaque signal est accompagné de :
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>La règle déclenchée (ex. SCA-001, CUT-002)</li>
              <li>Le document source avec page/ligne</li>
              <li>Un raisonnement factuel expliquant le constat</li>
              <li>L&apos;extrait du document concerné</li>
            </ul>
          </StepCard>

          <StepCard
            step={5}
            icon={<UserCheck className="h-5 w-5 text-primary" />}
            title="Valider les signaux"
          >
            <p>
              Pour chaque signal, vous disposez de trois actions :
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Valider
                </span>
                <span className="text-xs text-muted-foreground">— Le signal est pertinent, à intégrer au dossier</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
                  <AlertTriangle className="h-3 w-3" /> Rejeter
                </span>
                <span className="text-xs text-muted-foreground">— Le signal n&apos;est pas pertinent (commentaire obligatoire)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <Clock className="h-3 w-3" /> À approfondir
                </span>
                <span className="text-xs text-muted-foreground">— Le signal nécessite une investigation complémentaire</span>
              </div>
            </div>
            <p className="mt-2">
              Chaque décision est tracée dans le journal de traçabilité avec l&apos;identité du CAC.
            </p>
          </StepCard>

          <StepCard
            step={6}
            icon={<FileCheck className="h-5 w-5 text-primary" />}
            title="Télécharger les livrables"
          >
            <p>
              Une fois vos décisions prises, accédez à la page <strong>Livrables</strong> pour consulter et
              télécharger les documents générés, intégrables directement dans votre dossier de travail.
            </p>
          </StepCard>
        </div>
      </section>

      {/* Deliverables */}
      <section className="mb-10">
        <h2 className="mb-4 font-serif text-xl text-foreground">
          Les livrables
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Chaque analyse produit des documents directement exploitables dans le dossier de travail du CAC.
        </p>

        <h3 className="mb-3 text-sm font-semibold text-foreground">Livrables communs à tous les scénarios</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DeliverableCard
            icon={<FileText className="h-4 w-4 text-primary" />}
            title="Check-list de complétude"
            description="Tableau des documents attendus vs reçus, avec statut (présent, manquant, incomplet)."
            format="Consultable en ligne"
          />
          <DeliverableCard
            icon={<AlertTriangle className="h-4 w-4 text-primary" />}
            title="Table des signaux documentaires"
            description="Signaux détectés avec source, règle, priorité et décision du CAC."
            format="Export XLSX"
          />
          <DeliverableCard
            icon={<BookOpen className="h-4 w-4 text-primary" />}
            title="Synthèse de pré-analyse"
            description="Résumé structuré du périmètre, des constats et des limites pour le dossier NEP 230."
            format="Export PDF"
          />
          <DeliverableCard
            icon={<Clock className="h-4 w-4 text-primary" />}
            title="Journal de traçabilité"
            description="Historique chronologique de toutes les actions (Sof'IA + CAC) avec horodatage."
            format="Export PDF"
          />
        </div>

        <h3 className="mb-3 mt-6 text-sm font-semibold text-foreground">
          Livrable spécifique au sondage sur le chiffre d&apos;affaires
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DeliverableCard
            icon={<Scale className="h-4 w-4 text-primary" />}
            title="Tableau de rapprochement et justification du CA"
            description="Détail pièce par pièce des écritures testées, rapprochement factures / bons de livraison, et couverture du chiffre d'affaires."
            format="Export XLSX"
          />
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Ce livrable additionnel est généré uniquement pour le scénario <strong>Sondage CA</strong>.
            Il constitue un tableau de synthèse des démarches documentaires avec le rapprochement
            détaillé entre écritures comptables, factures et bons de livraison, ainsi que le taux
            de couverture du chiffre d&apos;affaires testé.
          </p>
        </div>
      </section>

      {/* Scenarios */}
      <section className="mb-10">
        <h2 className="mb-4 font-serif text-xl text-foreground">
          Les 3 scénarios de démonstration
        </h2>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <ChevronRight className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Sondage sur le chiffre d&apos;affaires</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Vérification documentaire sur un échantillon de ventes. Rapprochement factures / bons de livraison / FEC.
              Détection des pièces manquantes, écarts de montants, anomalies temporelles.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <ChevronRight className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Contrôle du cut-off</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Analyse des opérations autour de la date de clôture (31/12). Identification des factures
              et livraisons à cheval sur deux exercices. Vérification de la correcte séparation des périodes.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <ChevronRight className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Pointage des états financiers</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Réconciliation entre bilan, compte de résultat et annexe. Vérification de la cohérence
              des montants, de la présence des informations obligatoires et des variations significatives.
            </p>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="mb-10">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Rappel déontologique</h3>
              <p className="mt-2 text-xs italic leading-relaxed text-muted-foreground">
                «&nbsp;Analyse automatique — à valider par le commissaire aux comptes.
                Sof&apos;IA ne se substitue pas au jugement professionnel.&nbsp;»
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Tous les signaux documentaires sont des constats factuels objectifs. Aucune conclusion
                d&apos;audit, aucune qualification de significativité, aucune recommandation d&apos;opinion
                n&apos;est formulée. Le commissaire aux comptes conserve l&apos;entière responsabilité
                de ses décisions professionnelles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="flex justify-center pb-8">
        <Link
          href="/projects"
          className={cn(
            'group flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all',
            'bg-primary text-primary-foreground shadow-sm shadow-primary/20',
            'hover:shadow-md hover:shadow-primary/25 hover:brightness-110'
          )}
        >
          Commencer l&apos;utilisation
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
