import { describe, expect, it } from 'vitest'
import { reorderLabel } from './reorder'

describe('reorderLabel', () => {
  it('says "Must reorder" for 9 and 10', () => {
    expect(reorderLabel(9)).toBe('Must reorder')
    expect(reorderLabel(10)).toBe('Must reorder')
  })
  it('says "Skip" for 1 to 4', () => {
    expect(reorderLabel(1)).toBe('Skip')
    expect(reorderLabel(4)).toBe('Skip')
  })
  it('gives the middle no label', () => {
    expect(reorderLabel(5)).toBeNull()
    expect(reorderLabel(8)).toBeNull()
  })
  it('gives unrated dishes no label', () => {
    expect(reorderLabel(null)).toBeNull()
    expect(reorderLabel(undefined)).toBeNull()
  })
})
