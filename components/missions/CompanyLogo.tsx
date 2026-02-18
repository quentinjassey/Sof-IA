'use client'

import { useState } from 'react'

/**
 * Strips common audit/mission keywords and date suffixes from a mission title
 * to extract a probable company name.
 * e.g. "Audit Acme Distribution - Exercice 2025" → "Acme Distribution"
 */
export function extractCompanyFromTitle(title: string): string {
  return title
    .replace(/^(audit|mission|sondage\s+ca?|pointage|cut[- ]?off|césure|rapprochement|contrôle|vérification)\s+/gi, '')
    .replace(/\s*[-–—]\s*(exercice|ex\.?|année|period|clôture)?\s*(20\d{2}|19\d{2})[\s,.\-]*/gi, '')
    .replace(/\s+(sas|sarl|sasu|eurl|sci|snc|sa)\s*$/gi, '')
    .replace(/\s*[-–—]\s*(sas|sarl|sasu|eurl|sci|snc|sa)\s*$/gi, '')
    .trim()
}

/** Builds the internal logo proxy URL for a given company name or domain. */
export function logoUrl(name: string, domain?: string): string {
  if (domain) return `/api/logo?domain=${encodeURIComponent(domain)}`
  return `/api/logo?name=${encodeURIComponent(name)}`
}

/**
 * Returns up to 2 uppercase initials from a name.
 * "Acme Distribution" → "AD"
 */
function getInitials(name: string): string {
  return name
    .replace(/_/g, ' ')
    .split(/[\s\-–—]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
]

function getColorFromName(name: string): { bg: string; text: string } {
  const idx =
    name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

interface CompanyLogoProps {
  /** Company name or slug — used to fetch the logo and generate the initials fallback */
  name: string
  /** Optionally provide a domain directly (e.g. "orange.com") to skip auto-discovery */
  domain?: string
  className?: string
}

/**
 * Displays the company logo fetched via the internal /api/logo proxy.
 * The proxy tries multiple logo services server-side (.com then .fr, across
 * Logo.dev and Google Favicon), so no external requests are made from the browser.
 * Falls back to a deterministically colored avatar with initials when no logo is found.
 */
export function CompanyLogo({ name, domain, className = '' }: CompanyLogoProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const src = logoUrl(name, domain)
  const initials = getInitials(name)
  const color = getColorFromName(name)

  return (
    <div
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${className}`}
    >
      {/* Colored initials avatar — always rendered, hides when logo loads */}
      <div
        className={[
          'absolute inset-0 flex items-center justify-center text-[13px] font-semibold transition-opacity duration-200',
          color.bg,
          color.text,
          loaded ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
        aria-hidden={loaded}
      >
        {initials}
      </div>

      {/* Logo fetched via internal API proxy — no direct external calls from browser */}
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Logo ${name}`}
          className={[
            'relative h-full w-full object-contain p-1.5 transition-opacity duration-200',
            loaded ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
