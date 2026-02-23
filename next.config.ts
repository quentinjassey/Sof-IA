import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdfmake', 'pdf-parse', 'pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
}

export default nextConfig
