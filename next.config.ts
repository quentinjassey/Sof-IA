import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,
  // Exclude pdfmake from bundling — it uses Node.js fs for font loading
  serverExternalPackages: ['pdfmake', 'pdf-parse', 'pdfjs-dist'],
}

export default nextConfig
