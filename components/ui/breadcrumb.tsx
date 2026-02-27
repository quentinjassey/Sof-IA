import * as React from 'react'
import { cn } from '@/lib/utils'

function Breadcrumb({ children, className, ...props }: React.ComponentPropsWithoutRef<'nav'>) {
  return (
    <nav aria-label="Fil d'ariane" className={className} {...props}>
      {children}
    </nav>
  )
}

function BreadcrumbList({ children, className, ...props }: React.ComponentPropsWithoutRef<'ol'>) {
  return (
    <ol
      className={cn('flex items-center gap-1.5 text-sm', className)}
      {...props}
    >
      {children}
    </ol>
  )
}

function BreadcrumbItem({ children, className, ...props }: React.ComponentPropsWithoutRef<'li'>) {
  return (
    <li className={cn('inline-flex items-center gap-1.5', className)} {...props}>
      {children}
    </li>
  )
}

function BreadcrumbSeparator({ className, ...props }: React.ComponentPropsWithoutRef<'li'>) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('inline-flex', className)}
      {...props}
    >
      <span className="text-sm text-muted-foreground/40">/</span>
    </li>
  )
}

function BreadcrumbPage({ children, className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('text-sm font-medium text-foreground', className)}
      {...props}
    >
      {children}
    </span>
  )
}

export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator, BreadcrumbPage }
