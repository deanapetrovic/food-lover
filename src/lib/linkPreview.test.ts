import { describe, expect, it } from 'vitest'
import { cleanTitle, extractUrl, guessPlaceQuery, isHttpUrl } from './linkPreview'

describe('extractUrl', () => {
  it('finds a link inside shared text', () => {
    expect(extractUrl('Look at this 🔥 https://www.instagram.com/p/abc123/?igsh=x thanks')).toBe(
      'https://www.instagram.com/p/abc123/?igsh=x',
    )
  })
  it('drops trailing punctuation', () => {
    expect(extractUrl('see (https://example.com/page).')).toBe('https://example.com/page')
  })
  it('returns null when there is no http(s) link', () => {
    expect(extractUrl('no link here')).toBeNull()
    expect(extractUrl('javascript:alert(1)')).toBeNull()
  })
})

describe('isHttpUrl', () => {
  it('accepts only http and https', () => {
    expect(isHttpUrl('https://a.com')).toBe(true)
    expect(isHttpUrl('http://a.com')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('data:text/html,hi')).toBe(false)
    expect(isHttpUrl('not a url')).toBe(false)
  })
})

describe('cleanTitle', () => {
  it('strips "on Instagram" captions', () => {
    expect(cleanTitle('Ćevabdžinica Zlatni on Instagram: "so good"')).toBe('Ćevabdžinica Zlatni')
  })
  it('strips site suffixes', () => {
    expect(cleanTitle('Burger Joint Dorćol | Instagram')).toBe('Burger Joint Dorćol')
    expect(cleanTitle('Pekara Pistacchio - Google Maps')).toBe('Pekara Pistacchio')
  })
  it('caps the length', () => {
    expect(cleanTitle('x'.repeat(200))).toHaveLength(80)
  })
})

describe('guessPlaceQuery', () => {
  it('reads the place name from a Google Maps place link', () => {
    expect(
      guessPlaceQuery('https://www.google.com/maps/place/%C4%86evabd%C5%BEinica+Zlatni/@44.8,20.4,17z'),
    ).toBe('Ćevabdžinica Zlatni')
  })
  it('uses the resolved URL when the shared one is a short link', () => {
    expect(
      guessPlaceQuery('https://maps.app.goo.gl/abc', {
        url: 'https://www.google.com/maps/place/Kafana+Test/@1,2,3z', title: null, description: null, siteName: null,
      }),
    ).toBe('Kafana Test')
  })
  it('falls back to a cleaned page title', () => {
    expect(
      guessPlaceQuery('https://www.instagram.com/p/x', {
        url: 'https://www.instagram.com/p/x', title: 'Pekara Pistacchio on Instagram: "burek"', description: null, siteName: 'Instagram',
      }),
    ).toBe('Pekara Pistacchio')
  })
  it('ignores titles that only name the site', () => {
    const generic = (title: string) => ({ url: 'https://x.test', title, description: null, siteName: null })
    expect(guessPlaceQuery('https://www.google.com/maps?q=x', generic('Google Maps'))).toBeNull()
    expect(guessPlaceQuery('https://www.instagram.com/p/x', generic('Instagram'))).toBeNull()
    expect(guessPlaceQuery('https://www.instagram.com/p/x', generic('Log in'))).toBeNull()
  })
  it('returns null when there is nothing to go on', () => {
    expect(guessPlaceQuery('https://example.com', null)).toBeNull()
    expect(guessPlaceQuery('https://example.com', { url: '', title: ' ', description: null, siteName: null })).toBeNull()
  })
})
