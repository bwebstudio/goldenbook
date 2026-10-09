import { describe, it, expect } from 'vitest'
import {
  IMAGE_ADD_FIELD,
  IMAGE_REMOVE_FIELD,
  PORTAL_IMAGE_SLOTS,
  buildPortalImageKey,
  canCancelImageRequest,
  canRequestImageRemoval,
  clientOwnsPlace,
  isImageChangeField,
  portalImageSlotsLeft,
  sniffImageMime,
} from '../business-images.policy'

const MINE = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

describe('clientOwnsPlace', () => {
  it('accepts only places linked to the account', () => {
    expect(clientOwnsPlace([MINE], MINE)).toBe(true)
    expect(clientOwnsPlace([MINE], OTHER)).toBe(false)
    expect(clientOwnsPlace([], MINE)).toBe(false)
    expect(clientOwnsPlace([MINE], null)).toBe(false)
  })
})

describe('canCancelImageRequest', () => {
  it('lets the client withdraw its own pending image request', () => {
    expect(canCancelImageRequest({ place_id: MINE, field_name: IMAGE_ADD_FIELD, status: 'pending' }, MINE)).toBe('ok')
    expect(canCancelImageRequest({ place_id: MINE, field_name: IMAGE_REMOVE_FIELD, status: 'pending' }, MINE)).toBe('ok')
  })

  it("hides other places' requests as not found", () => {
    expect(canCancelImageRequest({ place_id: OTHER, field_name: IMAGE_ADD_FIELD, status: 'pending' }, MINE)).toBe('not_found')
    expect(canCancelImageRequest(null, MINE)).toBe('not_found')
  })

  it('does not allow withdrawing text change requests through the image endpoint', () => {
    expect(canCancelImageRequest({ place_id: MINE, field_name: 'full_description', status: 'pending' }, MINE)).toBe('not_found')
  })

  it('refuses requests that were already reviewed', () => {
    expect(canCancelImageRequest({ place_id: MINE, field_name: IMAGE_ADD_FIELD, status: 'approved' }, MINE)).toBe('not_pending')
  })
})

describe('canRequestImageRemoval', () => {
  it('allows visible images of the active place only', () => {
    expect(canRequestImageRemoval({ place_id: MINE, image_role: 'gallery' }, MINE)).toBe(true)
    expect(canRequestImageRemoval({ place_id: MINE, image_role: 'cover' }, MINE)).toBe(true)
    expect(canRequestImageRemoval({ place_id: OTHER, image_role: 'gallery' }, MINE)).toBe(false)
    expect(canRequestImageRemoval({ place_id: MINE, image_role: 'thumbnail' }, MINE)).toBe(false)
    expect(canRequestImageRemoval(undefined, MINE)).toBe(false)
  })
})

describe('portalImageSlotsLeft', () => {
  it('counts pending uploads against the base plan', () => {
    expect(portalImageSlotsLeft(0, 0)).toBe(PORTAL_IMAGE_SLOTS)
    expect(portalImageSlotsLeft(2, 1)).toBe(PORTAL_IMAGE_SLOTS - 3)
    expect(portalImageSlotsLeft(7, 0)).toBe(0)
  })
})

describe('sniffImageMime', () => {
  const bytes = (...b: number[]) => Uint8Array.from([...b, 0, 0, 0, 0, 0, 0, 0, 0])

  it('recognises the three formats the bucket accepts', () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(sniffImageMime(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp')
  })

  it('rejects HEIC and TIFF even when labelled as JPEG', () => {
    // HEIC: ....ftypheic
    expect(sniffImageMime(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63))).toBeNull()
    // TIFF little-endian
    expect(sniffImageMime(bytes(0x49, 0x49, 0x2a, 0x00))).toBeNull()
    expect(sniffImageMime(new Uint8Array())).toBeNull()
  })
})

describe('buildPortalImageKey', () => {
  it('produces a bare object key without the bucket prefix', () => {
    const key = buildPortalImageKey(MINE, 'image/jpeg', 1700000000000, 'ab12cd')
    expect(key).toBe(`places/${MINE}/1700000000000-ab12cd.jpg`)
    expect(key.startsWith('place-images/')).toBe(false)
  })

  it('cannot be steered outside the place folder by the random part', () => {
    expect(buildPortalImageKey(MINE, 'image/png', 1, '../../x')).toBe(`places/${MINE}/1-x.png`)
  })
})

describe('isImageChangeField', () => {
  it('separates image requests from text requests', () => {
    expect(isImageChangeField(IMAGE_ADD_FIELD)).toBe(true)
    expect(isImageChangeField(IMAGE_REMOVE_FIELD)).toBe(true)
    expect(isImageChangeField('name')).toBe(false)
  })
})
