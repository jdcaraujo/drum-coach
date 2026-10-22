import { STAGES } from '../model/exercise'
import type { Exercise } from '../model/exercise'
import type { CardRecord } from '../model/card'
import { isSolid } from './scheduler'

export interface StageProgress {
  stage: number
  total: number
  introduced: number
  solid: number
  unlocked: boolean
}

/** Minimum solid cards in a stage before the next one opens. */
const MIN_SOLID = 4
/** Share of introduced cards in a stage that must be solid. */
const SOLID_SHARE = 0.8

/**
 * Stage N opens once stage N-1 has at least MIN_SOLID solid cards and
 * 80% of what you've started there is solid. `previouslyUnlocked` keeps
 * stages open once reached, even if a later "Again" drops the ratio.
 */
export function stageProgress(
  exercises: Exercise[],
  cards: Map<string, CardRecord>,
  previouslyUnlocked: number,
  unlockAll: boolean,
): StageProgress[] {
  const out: StageProgress[] = STAGES.map((_, stage) => {
    const inStage = exercises.filter((e) => e.stage === stage)
    const started = inStage.filter((e) => cards.has(e.id))
    return {
      stage,
      total: inStage.length,
      introduced: started.length,
      solid: started.filter((e) => isSolid(cards.get(e.id)!, e)).length,
      unlocked: false,
    }
  })
  out.forEach((p, i) => {
    if (i === 0 || unlockAll || i <= previouslyUnlocked) {
      p.unlocked = true
      return
    }
    const prev = out[i - 1]
    p.unlocked =
      prev.unlocked &&
      prev.solid >= Math.min(MIN_SOLID, prev.total) &&
      prev.solid >= Math.ceil(prev.introduced * SOLID_SHARE)
  })
  return out
}

export function highestUnlocked(progress: StageProgress[]): number {
  let max = 0
  for (const p of progress) if (p.unlocked) max = p.stage
  return max
}
