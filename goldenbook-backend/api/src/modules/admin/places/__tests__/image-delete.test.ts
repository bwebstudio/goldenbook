// ─── Shared-asset safe image deletion ─────────────────────────────────────
//
// `addImageToPlace` upserts media_assets on (bucket, path), so two places can
// point at the same asset. Deleting an image from one place used to delete the
// asset as well, which cascaded through place_images and removed the photo
// from the other place. These tests pin the two halves of the fix: the pure
// "which bytes may go" decision, and the order of the writes `deleteImage`
// issues inside its transaction.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls: { sql: string; params: unknown[] }[] = []
let mediaDeleteReturns: { bucket: string; path: string }[] = []
let stillUsedReturns: { bucket: string; key: string }[] = []
let assetLeftAfter = false

const client = {
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params })
    if (/DELETE FROM place_images/.test(sql)) return { rows: [{ asset_id: 'asset-1' }] }
    if (/DELETE FROM media_assets/.test(sql)) return { rows: mediaDeleteReturns }
    if (/unnest\(/.test(sql)) return { rows: stillUsedReturns }
    if (/SELECT 1 FROM media_assets/.test(sql)) return { rows: assetLeftAfter ? [{}] : [] }
    return { rows: [] }
  }),
  release: vi.fn(),
}

vi.mock('../../../../db/postgres', () => ({
  db: { connect: vi.fn(async () => client), query: vi.fn() },
}))

import { selectObjectsSafeToRemove, deleteImageFromPlace, deleteImage } from '../admin-images.query'

describe('selectObjectsSafeToRemove', () => {
  it('keeps an object whose key another row still uses under the prefixed spelling', () => {
    const out = selectObjectsSafeToRemove(
      [{ bucket: 'place-images', path: 'lisboa/a.jpg' }],
      [{ bucket: 'place-images', key: 'place-images/lisboa/a.jpg' }],
    )
    expect(out).toEqual([])
  })

  it('returns objects nobody uses, once per normalised key', () => {
    const out = selectObjectsSafeToRemove(
      [
        { bucket: 'place-images', path: 'lisboa/a.jpg' },
        { bucket: 'place-images', path: 'place-images/lisboa/a.jpg' },
        { bucket: 'place-images', path: 'porto/b.jpg' },
      ],
      [],
    )
    expect(out).toEqual([
      { bucket: 'place-images', path: 'lisboa/a.jpg' },
      { bucket: 'place-images', path: 'porto/b.jpg' },
    ])
  })

  it('does not confuse the same key in different buckets', () => {
    const out = selectObjectsSafeToRemove(
      [{ bucket: 'place-images', path: 'x.jpg' }],
      [{ bucket: 'avatars', key: 'x.jpg' }],
    )
    expect(out).toEqual([{ bucket: 'place-images', path: 'x.jpg' }])
  })
})

describe('deleteImage', () => {
  beforeEach(() => {
    calls.length = 0
    mediaDeleteReturns = []
    stillUsedReturns = []
    assetLeftAfter = false
  })

  it('removes only this place link and keeps a shared asset and its bytes', async () => {
    // The guarded DELETE matches nothing because another place still links it.
    mediaDeleteReturns = []
    assetLeftAfter = true

    const result = await deleteImageFromPlace('place-A', 'image-1')

    expect(result).toEqual({ storageObject: null, assetDeleted: false })
    const linkDelete = calls.find((c) => /DELETE FROM place_images/.test(c.sql))!
    expect(linkDelete.sql).toMatch(/WHERE id = \$1 AND place_id = \$2/)
    expect(linkDelete.params).toEqual(['image-1', 'place-A'])

    const assetDelete = calls.find((c) => /DELETE FROM media_assets/.test(c.sql))!
    // Every foreign key into media_assets is checked before deleting.
    for (const ref of ['place_images pi', 'destinations d', 'routes r', 'users u']) {
      expect(assetDelete.sql).toContain(ref)
    }
    // The link is removed before the guarded asset delete runs.
    expect(calls.indexOf(linkDelete)).toBeLessThan(calls.indexOf(assetDelete))
    expect(calls.some((c) => c.sql === 'COMMIT')).toBe(true)
  })

  it('returns the storage object when the asset was used only here', async () => {
    mediaDeleteReturns = [{ bucket: 'place-images', path: 'place-images/lisboa/a.jpg' }]

    const result = await deleteImageFromPlace('place-A', 'image-1')

    expect(result).toEqual({
      storageObject: { bucket: 'place-images', path: 'place-images/lisboa/a.jpg' },
      assetDeleted: true,
    })
  })
})

describe('deleteImage (compat wrapper)', () => {
  beforeEach(() => {
    calls.length = 0
    mediaDeleteReturns = []
    assetLeftAfter = false
  })

  it('returns null for a shared asset so callers never delete its bytes', async () => {
    assetLeftAfter = true
    expect(await deleteImage('place-A', 'image-1')).toBeNull()
  })

  it('returns the location when the bytes may go', async () => {
    mediaDeleteReturns = [{ bucket: 'place-images', path: 'lisboa/a.jpg' }]
    expect(await deleteImage('place-A', 'image-1')).toEqual({ bucket: 'place-images', path: 'lisboa/a.jpg' })
  })
})
