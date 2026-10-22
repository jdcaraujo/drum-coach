import { layerAt, mergeSteps } from '../model/exercise'
import type { Exercise } from '../model/exercise'
import { make, tripletCount } from './common'

/** Jazz ride in triplet slots: 1, 2, 2-let, 3, 4, 4-let */
const RIDE = [0, 3, 5, 6, 9, 11]
const N = 12

const counts = (pos: number[]) => (pos.length ? pos.map(tripletCount).join(' ') : '—')

/** Book p. 28: ride cymbal ostinato in the right hand while the feet move. */
export function rideFeet(): Exercise[] {
  const lfPatterns = [[3, 9], [0, 3, 6, 9], [0, 6], [5, 11], [2, 5, 8, 11], [1, 4, 7, 10]]
  const rfPatterns = [[], [0, 3, 6, 9], [0, 6]]
  const out: Exercise[] = []
  rfPatterns.forEach((rf, ri) => {
    lfPatterns.forEach((lf, li) => {
      out.push(
        make({
          id: `rideFeet:lf${lf.join('-')}:rf${rf.join('-') || 'none'}`,
          family: 'rideFeet',
          order: ri * 10 + li,
          label: `LF ${counts(lf)} · RF ${counts(rf)}`,
          subdivision: 3,
          steps: mergeSteps(
            layerAt(N, 'RH', RIDE, true),
            layerAt(N, 'LF', lf, true),
            layerAt(N, 'RF', rf),
          ),
          startBpm: 60,
          targetBpm: 180,
        }),
      )
    })
  })
  return out
}

/** Book p. 29: ride, hi-hat on 2 & 4 and feathered bass drum, while the left hand comps. */
export function rideLH(): Exercise[] {
  const singles = [0, 3, 6, 9, 2, 5, 8, 11, 1, 4, 7, 10].map((p) => [p])
  const pairs = [[2, 8], [5, 11], [0, 5], [3, 8], [2, 5], [8, 11], [5, 8], [2, 11]]
  return [...singles, ...pairs].map((lh, i) =>
    make({
      id: `rideLH:lh${lh.join('-')}`,
      family: 'rideLH',
      order: i,
      label: `LH ${counts(lh)}`,
      voiceKey: 'voice.jazzTime',
      subdivision: 3,
      steps: mergeSteps(
        layerAt(N, 'RH', RIDE, true),
        layerAt(N, 'LH', lh),
        layerAt(N, 'RF', [0, 3, 6, 9]),
        layerAt(N, 'LF', [3, 9], true),
      ),
      startBpm: 60,
      targetBpm: 160,
    }),
  )
}
