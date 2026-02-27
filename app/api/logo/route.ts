import { NextRequest, NextResponse } from 'next/server'

const LEGAL_SUFFIXES = /\b(sas|sarl|sasu|eurl|sci|snc|sa|spa|srl|nv|ag|gmbh|ltd|inc|llc|corp)\b/gi

function normalizeSlug(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(LEGAL_SUFFIXES, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .trim()
}

/**
 * Returns ordered candidate domains for a company name.
 * e.g. "Orange" → ["orange.com", "orange.fr"]
 */
function candidateDomains(name: string): string[] {
  const slug = normalizeSlug(name)
  if (!slug) return []
  return [`${slug}.com`, `${slug}.fr`]
}

const LOGO_DEV_TOKEN = process.env.LOGO_DEV_TOKEN ?? ''

/**
 * Ordered list of logo fetch strategies.
 * Each entry receives a domain and returns the URL to try.
 * Logo.dev is tried first (high-quality SVG/PNG), then Google Favicon as fallback.
 */
const LOGO_SOURCES: Array<(domain: string) => string | null> = [
  // Logo.dev — high-quality logos, sk_ keys go through the REST API
  (domain) =>
    LOGO_DEV_TOKEN
      ? `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=128&format=png`
      : null,
  // Google Favicon — only as secondary fallback when Logo.dev is configured.
  // Without Logo.dev, skip entirely: Google returns a default globe icon for
  // non-existent domains, which looks worse than our initials avatar.
  (domain) =>
    LOGO_DEV_TOKEN
      ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
      : null,
]

async function fetchLogo(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SofIA/1.0)' },
    })
    const contentType = res.headers.get('content-type') ?? ''
    if (res.ok && contentType.startsWith('image/')) {
      return res
    }
    return null
  } catch {
    return null
  }
}

/**
 * GET /api/logo?name={companyName}
 * or  GET /api/logo?domain={domain}
 *
 * Server-side logo proxy — tries multiple logo services and streams the first
 * successful image back to the browser. Returns 404 when no logo is found.
 *
 * Caches successful responses for 24 h to reduce outbound requests.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const name = searchParams.get('name') ?? ''
  const domainParam = searchParams.get('domain') ?? ''

  const domains = domainParam ? [domainParam] : candidateDomains(name)

  if (domains.length === 0) {
    return new NextResponse(null, { status: 400 })
  }

  for (const domain of domains) {
    for (const buildUrl of LOGO_SOURCES) {
      const url = buildUrl(domain)
      if (!url) continue

      const res = await fetchLogo(url)
      if (res) {
        const buffer = await res.arrayBuffer()
        const contentType = res.headers.get('content-type') ?? 'image/png'
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          },
        })
      }
    }
  }

  // All sources exhausted — component will show the initials avatar
  return new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  })
}
