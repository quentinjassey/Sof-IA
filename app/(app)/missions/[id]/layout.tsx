'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function MissionLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const missionId = params.id as string

  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function checkProjectContext() {
      try {
        const res = await fetch(`/api/missions/${missionId}`)
        if (res.ok) {
          const json = await res.json()
          const projectId = json.data?.project_id
          if (projectId) {
            const subPath = pathname.replace(`/missions/${missionId}`, '')
            router.replace(`/projects/${projectId}/missions/${missionId}${subPath}`)
            return
          }
        }
      } catch {
        // If fetch fails, just show the page
      }
      setChecked(true)
    }
    checkProjectContext()
  }, [missionId, pathname, router])

  if (!checked) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
