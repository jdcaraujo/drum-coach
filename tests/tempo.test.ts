import { describe, expect, it } from 'vitest'
import { tempoPlayedLongest } from '../src/srs/tempo'

describe('tempoPlayedLongest', () => {
  it('keeps the main tempo when you drop it just before stopping (your first export)', () => {
    const changes = [24, 26, 28, 30, 32, 34].map((_, i) => ({ atSec: 100 + i, from: 60 - i * 4, to: 56 - i * 4 }))
    expect(tempoPlayedLongest(60, changes, 130)).toBe(60)
  })

  it('uses the new tempo when you settle on it early', () => {
    expect(tempoPlayedLongest(60, [{ atSec: 10, from: 60, to: 36 }], 130)).toBe(36)
  })

  it('treats count-in changes as from the first beat and ignores pre-start ones', () => {
    expect(
      tempoPlayedLongest(
        52,
        [
          { atSec: null, from: 48, to: 52 },
          { atSec: -1.5, from: 52, to: 56 },
        ],
        60,
      ),
    ).toBe(56)
  })

  it('falls back to the last tempo when nothing was played', () => {
    expect(tempoPlayedLongest(60, [{ atSec: -2, from: 60, to: 64 }], 0)).toBe(64)
    expect(tempoPlayedLongest(60, [], 0)).toBe(60)
  })

  it('breaks ties toward the later tempo', () => {
    expect(tempoPlayedLongest(60, [{ atSec: 30, from: 60, to: 64 }], 60)).toBe(64)
  })
})
