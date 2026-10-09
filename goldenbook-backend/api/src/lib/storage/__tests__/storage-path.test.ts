import { describe, it, expect } from 'vitest'
import { toStorageObjectKey } from '../storage-path'

describe('toStorageObjectKey', () => {
  it('strips a leading <bucket>/ prefix (legacy media_assets rows)', () => {
    expect(toStorageObjectKey('place-images', 'place-images/lisboa/a.jpg')).toBe('lisboa/a.jpg')
  })

  it('leaves bare keys untouched', () => {
    expect(toStorageObjectKey('place-images', 'lisboa/a.jpg')).toBe('lisboa/a.jpg')
  })

  it('maps both spellings of the same object to one key', () => {
    expect(toStorageObjectKey('place-images', 'place-images/x/y.webp'))
      .toBe(toStorageObjectKey('place-images', 'x/y.webp'))
  })

  it('strips leading slashes before the prefix and collapses double slashes', () => {
    expect(toStorageObjectKey('media', '/media/photo.jpg')).toBe('photo.jpg')
    expect(toStorageObjectKey('media', ' a//b.jpg ')).toBe('a/b.jpg')
  })

  it('only strips the prefix once, and only for the same bucket', () => {
    expect(toStorageObjectKey('place-images', 'place-images/place-images/a.jpg')).toBe('place-images/a.jpg')
    expect(toStorageObjectKey('place-images', 'place-images-old/a.jpg')).toBe('place-images-old/a.jpg')
  })
})
