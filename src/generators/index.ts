import type { Exercise } from '../model/exercise'
import { rudiments, orchestrated } from './rudiments'
import { melodic, twoPart, fourWayBuild, fourWay } from './coordination'
import { rideFeet, rideLH } from './ride'

let cache: Exercise[] | null = null
let byId: Map<string, Exercise> | null = null

/** Every exercise in the curriculum, ordered by stage then difficulty. */
export function allExercises(): Exercise[] {
  if (!cache) {
    cache = [
      ...rudiments(),
      ...orchestrated(),
      ...melodic(),
      ...twoPart(),
      ...fourWayBuild(),
      ...fourWay(),
      ...rideFeet(),
      ...rideLH(),
    ].sort((a, b) => a.stage - b.stage || a.order - b.order)
    byId = new Map(cache.map((e) => [e.id, e]))
  }
  return cache
}

export function exerciseById(id: string): Exercise | undefined {
  allExercises()
  return byId!.get(id)
}
