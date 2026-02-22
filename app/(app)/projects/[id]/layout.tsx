'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { useParams } from 'next/navigation'
import DocumentLibrary, { type LibraryDocument } from '@/components/projects/DocumentLibrary'
import ReclassifyDialog from '@/components/projects/ReclassifyDialog'
import { PdfPreviewModal } from '@/components/ui/PdfPreviewModal'
import type { DocumentType, Mission } from '@/types/database'

interface ProjectContextValue {
  projectId: string
  documents: LibraryDocument[]
  missions: Mission[]
  refreshProject: () => Promise<void>
  isLoading: boolean
  projectName: string
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

  const [previewDoc, setPreviewDoc] = useState<LibraryDocument | null>(null)
  const [reclassifyDoc, setReclassifyDoc] = useState<LibraryDocument | null>(null)

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

  const handleUpload = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.txt,.csv,.pdf,.jpg,.jpeg,.png,.tiff,.tif'
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return

      const formData = new FormData()
      for (const file of Array.from(files)) {
        formData.append('files', file)
      }

      try {
        const res = await fetch(`/api/projects/${projectId}/documents`, {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          await refreshProject()
        }
      } catch {
        // Silent fail
      }
    }
    input.click()
  }, [projectId, refreshProject])

  return (
    <ProjectContext.Provider
      value={{ projectId, documents, missions, refreshProject, isLoading, projectName }}
    >
      <div className="flex h-full">
        {/* Document library sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
          <div className="border-b border-border px-3 py-2.5">
            <h2 className="truncate text-xs font-semibold text-foreground">{projectName || 'Projet'}</h2>
            <p className="text-[10px] text-muted-foreground">
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <DocumentLibrary
              documents={documents}
              onPreview={setPreviewDoc}
              onDelete={handleDeleteDoc}
              onReclassify={setReclassifyDoc}
              onUpload={handleUpload}
              selectedDocId={previewDoc?.id}
            />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>

      {/* PDF Preview modal */}
      {previewDoc && (
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
    </ProjectContext.Provider>
  )
}
