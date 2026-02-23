import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdfmake', 'pdf-parse', 'pdfjs-dist'],
}

export default nextConfig
