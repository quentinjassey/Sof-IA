'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  FolderOpen,
  Loader2,
  AlertCircle,
  X,
  Clock,
  ChevronRight,
  ArrowRight,
  Trash2,
  FileText,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompanyLogo, extractCompanyFromTitle } from '@/components/missions/CompanyLogo'
import type { Project } from '@/types/database'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<(Project & { document_count?: number; mission_count?: number })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setProjects(json.data)
        }
      }
    } catch {
      // Fail silently
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreate = useCallback(async () => {
    if (!projectName.trim()) {
      setError('Veuillez renseigner le nom du projet client.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
        }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error || 'Erreur lors de la création du projet.')
        return
      }

      router.push(`/projects/${json.data.id}`)
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setIsCreating(false)
    }
  }, [projectName, projectDescription, router])

  const resetForm = useCallback(() => {
    setShowCreateForm(false)
    setProjectName('')
    setProjectDescription('')
    setError(null)
  }, [])

  const handleDeleteProject = useCallback(
    async (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation()

      if (!confirm('Supprimer ce projet et toutes ses données (documents, analyses, signaux) ?')) {
        return
      }

      setDeletingProjectId(projectId)
      try {
        const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
        const json = await res.json()

        if (res.ok) {
          setProjects((prev) => prev.filter((p) => p.id !== projectId))
        } else {
          alert(json.error || 'Erreur lors de la suppression du projet.')
        }
      } catch {
        alert('Impossible de contacter le serveur.')
      } finally {
        setDeletingProjectId(null)
      }
    },
    []
  )

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto p-5 sm:p-6 lg:p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-foreground">
            Projets clients
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez vos projets de pré-analyse documentaire
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className={cn(
              'group flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
              'bg-primary text-primary-foreground shadow-sm shadow-primary/20',
              'hover:shadow-md hover:shadow-primary/25 hover:brightness-110'
            )}
          >
            <Plus className="h-4 w-4" />
            Nouveau projet
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="animate-fade-in mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif text-lg text-card-foreground">
              Nouveau projet client
            </h2>
            <button
              onClick={resetForm}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4">
            <label
              htmlFor="project-name"
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Nom du projet
            </label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Audit ACME Distribution SAS — Exercice 2025"
              className={cn(
                'block w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground',
                'placeholder:text-muted-foreground/50',
                'transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
              )}
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="project-description"
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Description (optionnel)
            </label>
            <input
              id="project-description"
              type="text"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Exercice clos le 31/12/2025 — Commissariat aux comptes"
              className={cn(
                'block w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground',
                'placeholder:text-muted-foreground/50',
                'transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
              )}
            />
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={resetForm}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !projectName.trim()}
              className={cn(
                'group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all',
                'bg-primary text-primary-foreground shadow-sm shadow-primary/20',
                'hover:shadow-md hover:shadow-primary/25 hover:brightness-110',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  Créer le projet
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="mt-3 text-sm text-muted-foreground">
            Chargement des projets...
          </span>
        </div>
      ) : projects.length === 0 && !showCreateForm ? (
        <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border py-20">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <FolderOpen className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-lg text-foreground">
            Aucun projet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Créez votre premier projet client pour commencer
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className={cn(
              'group mt-6 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all',
              'bg-primary text-primary-foreground shadow-sm shadow-primary/20',
              'hover:shadow-md hover:shadow-primary/25 hover:brightness-110'
            )}
          >
            <Plus className="h-4 w-4" />
            Nouveau projet
          </button>
        </div>
      ) : (
        <>
          {projects.length > 0 && (
            <div>
              {!showCreateForm && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                    Projets existants
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[10px] font-medium text-muted-foreground/40">
                    {projects.length}
                  </span>
                </div>
              )}
              <div className="space-y-2">
                {projects.map((project, index) => (
                  <div
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ')
                        router.push(`/projects/${project.id}`)
                    }}
                    className={cn(
                      'group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all cursor-pointer',
                      'hover:border-primary/20 hover:shadow-sm',
                      'animate-fade-in opacity-0'
                    )}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <CompanyLogo name={extractCompanyFromTitle(project.name)} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        {project.description && (
                          <span className="truncate max-w-[200px]">{project.description}</span>
                        )}
                        {project.document_count !== undefined && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {project.document_count} doc{project.document_count !== 1 ? 's' : ''}
                          </span>
                        )}
                        {project.mission_count !== undefined && (
                          <span className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            {project.mission_count} analyse{project.mission_count !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(project.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        disabled={deletingProjectId === project.id}
                        className={cn(
                          'opacity-0 transition-all rounded-lg p-2',
                          'group-hover:opacity-100',
                          'text-muted-foreground hover:text-destructive hover:bg-destructive/5 cursor-pointer'
                        )}
                        title="Supprimer ce projet"
                      >
                        {deletingProjectId === project.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
