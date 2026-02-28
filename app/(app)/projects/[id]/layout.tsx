'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { PanelLeftClose, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import DocumentLibrary, { type LibraryDocument } from '@/components/projects/DocumentLibrary'
import ReclassifyDialog from '@/components/projects/ReclassifyDialog'
import UploadModal from '@/components/projects/UploadModal'
import type { DocumentType, Mission } from '@/types/database'

const PdfPreviewModal = dynamic(
  () => import('@/components/ui/PdfPreviewModal').then((m) => m.PdfPreviewModal),
  { ssr: false }
)
const FecPreviewModal = dynamic(
  () => import('@/components/ui/FecPreviewModal').then((m) => m.FecPreviewModal),
  { ssr: false }
)

interface ProjectContextValue {
  projectId: string
  documents: LibraryDocument[]
  missions: Mission[]
  refreshProject: () => Promise<void>
  isLoading: boolean
  projectName: string
  openUploadModal: () => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProjectContext() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectContext must be used within ProjectLayout')
  return ctx
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const projectId = params.id as string

  const [documents, setDocuments] = useState<LibraryDocument[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [projectName, setProjectName] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [previewDoc, setPreviewDoc] = useState<LibraryDocument | null>(null)
  const [reclassifyDoc, setReclassifyDoc] = useState<LibraryDocument | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const refreshProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setDocuments(json.data.documents ?? [])
          setMissions(json.data.missions ?? [])
          setProjectName(json.data.name ?? '')
        }
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    refreshProject()
  }, [refreshProject])

  const handleDeleteDoc = useCallback(
    async (doc: LibraryDocument) => {
      if (!confirm(`Supprimer "${doc.filename}" ?`)) return
      try {
        const res = await fetch(`/api/projects/${projectId}/documents?documentId=${doc.id}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
        }
      } catch {
        // Silent fail
      }
    },
    [projectId]
  )

  const handleReclassify = useCallback(
    async (newType: DocumentType) => {
      if (!reclassifyDoc) return
      const res = await fetch(
        `/api/projects/${projectId}/documents/${reclassifyDoc.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: newType }),
        }
      )
      if (res.ok) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === reclassifyDoc.id ? { ...d, type: newType } : d))
        )
      }
    },
    [projectId, reclassifyDoc]
  )

  const handleOpenUpload = useCallback(() => {
    setShowUploadModal(true)
  }, [])

  const handleUploadFiles = useCallback(
    async (files: File[], types: string[], onProgress?: (pct: number) => void) => {
      let completed = 0
      const total = files.length
      const errors: string[] = []

      for (let i = 0; i < total; i++) {
        const formData = new FormData()
        formData.append('file', files[i])
        if (types[i]) formData.append('types', types[i])

        onProgress?.(Math.round((completed / total) * 100))

        try {
          const res = await fetch(`/api/projects/${projectId}/documents`, {
            method: 'POST',
            body: formData,
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            errors.push(data.error || `Erreur pour ${files[i].name}`)
          }
        } catch {
          errors.push(`Erreur réseau pour ${files[i].name}`)
        }

        completed++
        onProgress?.(Math.round((completed / total) * 100))
      }

      if (errors.length === total) {
        throw new Error('Aucun document n\'a pu être envoyé.')
      }

      await refreshProject()
    },
    [projectId, refreshProject]
  )

  const handleBulkDelete = useCallback(
    async (docIds: string[]) => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/documents?documentIds=${docIds.join(',')}`,
          { method: 'DELETE' }
        )
        if (res.ok) {
          setDocuments((prev) => prev.filter((d) => !docIds.includes(d.id)))
        }
      } catch {
        // Silent fail
      }
    },
    [projectId]
  )

  const handleBulkReclassify = useCallback(
    async (docIds: string[], newType: DocumentType) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/documents`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentIds: docIds, type: newType }),
        })
        if (res.ok) {
          setDocuments((prev) =>
            prev.map((d) => (docIds.includes(d.id) ? { ...d, type: newType } : d))
          )
        }
      } catch {
        // Silent fail
      }
    },
    [projectId]
  )

  return (
    <ProjectContext.Provider
      value={{ projectId, documents, missions, refreshProject, isLoading, projectName, openUploadModal: handleOpenUpload }}
    >
      <div className="flex h-full">
        {/* Document library sidebar */}
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out lg:flex',
            sidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-r-0'
          )}
        >
          <div className="flex h-full w-64 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xs font-semibold text-foreground">{projectName || 'Projet'}</h2>
                <p className="text-[10px] text-muted-foreground">
                  {documents.length} document{documents.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                title="Masquer les documents"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <DocumentLibrary
                documents={documents}
                onPreview={setPreviewDoc}
                onDelete={handleDeleteDoc}
                onBulkDelete={handleBulkDelete}
                onBulkReclassify={handleBulkReclassify}
                onReclassify={setReclassifyDoc}
                onUpload={handleOpenUpload}
                selectedDocId={previewDoc?.id}
              />
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="relative flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8">
          {/* Sidebar open button (visible when collapsed) */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute left-2 top-3 z-10 hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground lg:flex"
              title="Afficher les documents"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="text-[11px] font-medium">{documents.length}</span>
            </button>
          )}
          {children}
        </div>
      </div>

      {/* Document Preview modals */}
      {previewDoc && previewDoc.type === 'fec' && (
        <FecPreviewModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.filename}
          previewUrl={`/api/projects/${projectId}/documents/${previewDoc.id}/preview`}
        />
      )}
      {previewDoc && previewDoc.type !== 'fec' && (
        <PdfPreviewModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.filename}
          pdfUrl={`/api/projects/${projectId}/documents/${previewDoc.id}/preview`}
        />
      )}

      {/* Reclassify dialog */}
      {reclassifyDoc && (
        <ReclassifyDialog
          isOpen={!!reclassifyDoc}
          onClose={() => setReclassifyDoc(null)}
          documentName={reclassifyDoc.filename}
          currentType={reclassifyDoc.type}
          onConfirm={handleReclassify}
        />
      )}

      {/* Upload modal with drag-and-drop */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUploadFiles}
      />
    </ProjectContext.Provider>
  )
}
