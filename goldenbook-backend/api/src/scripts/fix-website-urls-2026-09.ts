#!/usr/bin/env tsx
// ─── Repair six unusable website_url values ─────────────────────────────────
//
// The app gates its website button on `isHttpUrl()` (PlaceActions.tsx), so a
// value without a scheme is not rendered as a broken link — it is silently
// dropped and the venue simply has no website button. Nothing looks wrong,
// which is why these survived.
//
// Six rows are affected, in three shapes:
//   • two URLs crammed into one field, separated by "; "
//   • a stray space inside the host ("www. olive-bistro.com")
//   • placeholder prose where a URL should be ("NÃO DISPONÍVEL")
//
// Each decision is written out rather than derived, because there are only six
// and picking between two candidate domains is a judgement call: for Palácio
// da Bolsa the field holds both the venue's own site and that of the chamber
// of commerce that runs it, and the venue's own is the useful one for a guest.
//
// Not touched: `booking_url = 'tel:+351291630611'` on 1811 Bistro. It looks
// malformed but places.dto.ts `normalizeBooking` turns a tel: value into a
// reservation phone on purpose.
//
// Usage:
//   npx tsx api/src/scripts/fix-website-urls-2026-09.ts            # dry run
//   npx tsx api/src/scripts/fix-website-urls-2026-09.ts --confirm

import { db } from '../db/postgres'

const CONFIRM = process.argv.includes('--confirm')

/** slug → the value to store, or null to clear the field. */
const FIXES: { slug: string; from: string; to: string | null; why: string }[] = [
  {
    slug: 'lisboa-a-noite-lisboa',
    from: 'www.lisboanoite.com; www.facebook.com/restaurantelisboanoite',
    to: 'https://www.lisboanoite.com',
    why: 'two links in one field — keep the venue site, drop the Facebook page',
  },
  {
    slug: 'mud-factory-under-design-porto',
    from: 'www.mudstore.pt; www.mudstoreus.com',
    to: 'https://www.mudstore.pt',
    why: 'two links — keep the .pt storefront for a Portugal guide',
  },
  {
    slug: 'palacio-da-bolsa-porto',
    from: 'www.cciporto.com; www.palaciodabolsa.pt',
    // The stored .pt does not resolve at all; the venue's live site is on
    // .com. Picking the "obviously right" domain out of the pair and writing
    // it down unchecked would have swapped one dead link for another.
    to: 'https://palaciodabolsa.com',
    why: 'two links — the monument site, on the TLD that actually resolves',
  },
  {
    slug: 'olive-algarve',
    from: 'www. olive-bistro.com',
    to: 'https://www.olive-bistro.com',
    why: 'stray space inside the host',
  },
  {
    slug: 'mae-porto',
    from: 'NÃO DISPONÍVEL',
    to: null,
    why: 'placeholder prose, not a URL',
  },
  {
    slug: 'optica-jomil-lisboa',
    from: 'Não especificado',
    to: null,
    why: 'placeholder prose, not a URL',
  },
]

async function main() {
  if (!CONFIRM) console.log('\nDRY RUN — nothing is written. Re-run with --confirm.\n')

  let changed = 0, skipped = 0
  for (const fix of FIXES) {
    const { rows } = await db.query<{ id: string; website_url: string | null }>(
      `SELECT id, website_url FROM places WHERE slug = $1 LIMIT 1`, [fix.slug],
    )
    if (!rows[0]) { console.log(`! ${fix.slug} not found`); skipped++; continue }

    // Guard on the exact value we inspected, so a re-run cannot overwrite a
    // correction someone made in the meantime.
    if (rows[0].website_url !== fix.from) {
      console.log(`- ${fix.slug}\n    already changed to ${rows[0].website_url ?? 'NULL'} — leaving it`)
      skipped++
      continue
    }

    console.log(`  ${fix.slug}`)
    console.log(`    ${fix.from}`)
    console.log(`    → ${fix.to ?? 'NULL'}   (${fix.why})`)
    if (CONFIRM) {
      await db.query(`UPDATE places SET website_url = $1, updated_at = now() WHERE id = $2`, [fix.to, rows[0].id])
      changed++
    }
  }

  console.log(`\n  ${CONFIRM ? 'updated' : 'would update'} ${CONFIRM ? changed : FIXES.length - skipped}, skipped ${skipped}\n`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
