import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Sof'IA - Pre-analyse documentaire",
  description:
    "Outil de pre-analyse documentaire automatisee pour les commissaires aux comptes",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  )
}
