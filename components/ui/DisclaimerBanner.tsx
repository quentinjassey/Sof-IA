"use client"

import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface DisclaimerBannerProps {
  className?: string
}

export default function DisclaimerBanner({ className }: DisclaimerBannerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
      <p className="text-sm text-amber-800">
        <span className="font-semibold">Analyse automatique</span> — a valider
        par le commissaire aux comptes.{" "}
        Sof&apos;IA ne se substitue pas au jugement professionnel.
      </p>
    </div>
  )
}
