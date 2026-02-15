"use client"

import * as React from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TableColumn<T> {
  key: string
  header: string
  sortable?: boolean
  render?: (row: T, index: number) => React.ReactNode
  className?: string
  headerClassName?: string
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  onRowClick?: (row: T, index: number) => void
  rowKey?: (row: T, index: number) => string | number
  className?: string
  skeletonRows?: number
}

type SortDirection = "asc" | "desc" | null

function Table<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = "Aucune donnee disponible",
  emptyIcon,
  onRowClick,
  rowKey,
  className,
  skeletonRows = 5,
}: TableProps<T>) {
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null)

  const handleSort = React.useCallback((columnKey: string) => {
    setSortColumn((prevColumn) => {
      if (prevColumn === columnKey) {
        setSortDirection((prevDir) => {
          if (prevDir === "asc") return "desc"
          if (prevDir === "desc") {
            setSortColumn(null)
            return null
          }
          return "asc"
        })
        return prevColumn
      }
      setSortDirection("asc")
      return columnKey
    })
  }, [])

  const sortedData = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return data

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDirection === "asc" ? -1 : 1
      if (bVal == null) return sortDirection === "asc" ? 1 : -1

      if (typeof aVal === "string" && typeof bVal === "string") {
        const result = aVal.localeCompare(bVal, "fr")
        return sortDirection === "asc" ? result : -result
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal
      }

      const result = String(aVal).localeCompare(String(bVal), "fr")
      return sortDirection === "asc" ? result : -result
    })
  }, [data, sortColumn, sortDirection])

  function getSortIcon(columnKey: string) {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="size-3.5 text-muted-foreground" />
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="size-3.5 text-primary" />
    }
    return <ArrowDown className="size-3.5 text-primary" />
  }

  if (loading) {
    return (
      <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-center py-4">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          {emptyIcon && <div className="mb-3">{emptyIcon}</div>}
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider",
                  col.sortable && "cursor-pointer select-none hover:bg-muted transition-colors",
                  col.headerClassName
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                aria-sort={
                  sortColumn === col.key
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && getSortIcon(col.key)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border">
          {sortedData.map((row, index) => (
            <tr
              key={rowKey ? rowKey(row, index) : index}
              className={cn(
                "transition-colors duration-100",
                onRowClick
                  ? "cursor-pointer hover:bg-muted/50"
                  : "hover:bg-muted/30"
              )}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn("px-4 py-3 text-sm text-foreground", col.className)}
                >
                  {col.render
                    ? col.render(row, index)
                    : (row[col.key] as React.ReactNode) ?? "\u2014"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { Table }
