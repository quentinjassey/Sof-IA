"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems?: number
  itemsPerPage?: number
  onPageChange: (page: number) => void
  maxVisiblePages?: number
  className?: string
}

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  maxVisiblePages = 5,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  function getVisiblePages(): (number | "ellipsis")[] {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | "ellipsis")[] = []
    const half = Math.floor(maxVisiblePages / 2)

    let start = Math.max(2, currentPage - half)
    let end = Math.min(totalPages - 1, currentPage + half)

    if (currentPage <= half + 1) {
      end = maxVisiblePages - 1
    }
    if (currentPage >= totalPages - half) {
      start = totalPages - maxVisiblePages + 2
    }

    pages.push(1)
    if (start > 2) pages.push("ellipsis")
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < totalPages - 1) pages.push("ellipsis")
    pages.push(totalPages)

    return pages
  }

  const visiblePages = getVisiblePages()
  const startItem = totalItems ? (currentPage - 1) * (itemsPerPage || 1) + 1 : null
  const endItem =
    totalItems && itemsPerPage
      ? Math.min(currentPage * itemsPerPage, totalItems)
      : null

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="text-sm text-muted-foreground">
        {totalItems != null && startItem != null && endItem != null ? (
          <span>
            {startItem} - {endItem} sur {totalItems} elements
          </span>
        ) : (
          <span>
            Page {currentPage} sur {totalPages}
          </span>
        )}
      </div>

      <nav className="inline-flex items-center gap-1" aria-label="Pagination">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex items-center justify-center size-8 rounded-lg text-sm text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
          aria-label="Page precedente"
        >
          <ChevronLeft className="size-4" />
        </button>

        {visiblePages.map((page, index) => {
          if (page === "ellipsis") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="inline-flex items-center justify-center size-8 text-sm text-muted-foreground"
              >
                ...
              </span>
            )
          }

          const isActive = page === currentPage
          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={cn(
                "inline-flex items-center justify-center size-8 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent"
              )}
              aria-label={`Page ${page}`}
              aria-current={isActive ? "page" : undefined}
            >
              {page}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="inline-flex items-center justify-center size-8 rounded-lg text-sm text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
          aria-label="Page suivante"
        >
          <ChevronRight className="size-4" />
        </button>
      </nav>
    </div>
  )
}

export { Pagination }
