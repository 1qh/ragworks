import type { Block } from './lib'
import { respaceBlocks } from './respace'
import { snapBlocksToInk } from './snap-ink'

interface Reconciled {
  blocks: Block[]
  repaired: number
  snapped: number
  unanchored: number
}
const reconcileBlocks = (bytes: Uint8Array<ArrayBuffer>, blocks: readonly Block[]): Reconciled => {
  const snap = snapBlocksToInk(bytes, blocks)
  const respaced = respaceBlocks(bytes, snap.blocks)
  return {
    blocks: respaced.blocks,
    repaired: respaced.repaired,
    snapped: snap.snapped,
    unanchored: snap.unanchored
  }
}
export { reconcileBlocks }
export type { Reconciled }
