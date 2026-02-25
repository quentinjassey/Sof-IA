#!/usr/bin/env npx tsx
// =============================================================================
// SOF'IA — Génération de tous les documents de démonstration
// Usage: npx tsx scripts/generate-demo-docs.ts
// =============================================================================

import { generateSondageDocs } from './generate-sondage'
import { generateCutoffDocs } from './generate-cutoff'
import { generatePointageDocs } from './generate-pointage'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

async function main() {
  console.log('=== SOF\'IA — Génération des documents de démonstration ===\n')

  // Ensure output directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true })

  // Copy real FEC file (source of truth for sondage)
  const fecSrc = path.join(process.env.HOME || '', 'Downloads', 'DGI_LET_2024-1.txt')
  const fecDst = path.join(DATA_DIR, 'DGI_LET_2024.txt')
  if (fs.existsSync(fecSrc)) {
    fs.copyFileSync(fecSrc, fecDst)
    console.log('  [FEC] DGI_LET_2024.txt copié depuis Downloads')
  } else if (!fs.existsSync(fecDst)) {
    console.warn('  [FEC] ATTENTION: DGI_LET_2024-1.txt non trouvé dans ~/Downloads')
  }

  // Generate all scenarios in parallel — all output flat into data/
  const [sondageResult, cutoffResult, pointageResult] = await Promise.all([
    generateSondageDocs(DATA_DIR),
    generateCutoffDocs(DATA_DIR),
    generatePointageDocs(DATA_DIR),
  ])

  const total = sondageResult.count + cutoffResult.count + pointageResult.count
  console.log('\n=== Résumé ===')
  console.log(`Sondage CA : ${sondageResult.count} fichiers`)
  console.log(`Cut-off    : ${cutoffResult.count} fichiers`)
  console.log(`Pointage   : ${pointageResult.count} fichiers`)
  console.log(`Total      : ${total} fichiers → ${DATA_DIR}`)
  console.log('\nTerminé.')
}

main().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
