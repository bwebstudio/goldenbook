#!/usr/bin/env tsx
// ─── Quitar guiones largos del contenido editorial ────────────────────────
//
// El em dash no se usa en español ni en portugués fuera de los diálogos, y en
// inglés se ha vuelto una marca delatora de texto generado. En el catálogo
// había 301 fichas con guiones largos en sus textos.
//
// No es un reemplazo global, porque un carácter suelto por otro deja frases
// torcidas. Las reglas van por caso, en este orden:
//
//   1. Par de guiones usados como paréntesis ("X — algo — Y") pasan a comas.
//   2. Guion inicial de línea se elimina, con su espacio.
//   3. Guion suelto entre espacios pasa a dos puntos cuando introduce una
//      explicación, que es el uso dominante aquí ("El mayor centro comercial
//      de Lisboa — más de 300 tiendas"). Si la frase ya tiene dos puntos, se
//      usa coma para no encadenar dos.
//   4. Guion pegado a las palabras ("palabra—palabra") pasa a coma y espacio.
//
// Uso:
//   npx tsx src/scripts/strip-em-dashes.ts --dry-run
//   npx tsx src/scripts/strip-em-dashes.ts

import { db } from '../db/postgres'

const DRY_RUN = process.argv.includes('--dry-run')

const TARGETS: { table: string; cols: string[] }[] = [
  { table: 'place_translations', cols: ['name', 'short_description', 'goldenbook_note', 'insider_tip', 'full_description'] },
  { table: 'places',             cols: ['short_description', 'full_description', 'editorial_summary'] },
]

export function stripEmDashes(text: string, isName = false): string {
  let out = text

  // 1. Par usado como paréntesis dentro de una misma frase.
  out = out.replace(/\s—\s([^—]{1,80})\s—\s/g, ', $1, ')

  // 2. Guion al principio del texto o de una línea.
  out = out.replace(/(^|\n)\s*—\s*/g, '$1')

  // 3. Guion suelto entre espacios.
  // En un nombre propio ("Sky Bar by Seen — Tivoli Avenida Liberdade") los dos
  // puntos quedan mal: ahi el guion separa marca y sede, y eso es una coma.
  const alreadyHasColon = out.includes(':')
  out = out.replace(/\s+—\s+/g, isName || alreadyHasColon ? ', ' : ': ')

  // 4. Guion pegado a las palabras.
  out = out.replace(/(\S)—(\S)/g, '$1, $2')

  // 5. Cualquier resto suelto.
  out = out.replace(/\s*—\s*/g, ' ')

  // Higiene: dobles espacios y puntuación duplicada que puedan quedar.
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/:\s*:/g, ':')
    .replace(/,\s*\./g, '.')
    .replace(/:\s*\./g, '.')
    .trim()
}

async function main() {
  console.log(`\nLimpieza de guiones largos  ${DRY_RUN ? '[DRY RUN]' : ''}\n`)
  let shown = 0, changed = 0

  for (const { table, cols } of TARGETS) {
    for (const col of cols) {
      const { rows } = await db.query<{ id: string; val: string }>(
        `SELECT id, ${col} AS val FROM ${table} WHERE ${col} LIKE '%—%'`)
      if (rows.length === 0) continue
      console.log(`${table}.${col}: ${rows.length} filas`)

      for (const r of rows) {
        const next = stripEmDashes(r.val, col === 'name')
        if (next === r.val) continue
        if (shown < 6) {
          console.log(`   antes: ...${r.val.slice(Math.max(0, r.val.indexOf('—') - 45), r.val.indexOf('—') + 45)}...`)
          console.log(`   ahora: ...${next.slice(Math.max(0, r.val.indexOf('—') - 45), r.val.indexOf('—') + 45)}...\n`)
          shown++
        }
        if (!DRY_RUN) {
          await db.query(`UPDATE ${table} SET ${col} = $1 WHERE id = $2`, [next, r.id])
        }
        changed++
      }
    }
  }

  console.log(`\n${changed} textos ${DRY_RUN ? 'se cambiarian' : 'corregidos'}\n`)
  await db.end()
}

main().catch(e => { console.error(e); process.exit(1) })
