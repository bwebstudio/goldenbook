// ─── Shared Scoring Module ───────────────────────────────────────────────────
//
// Centralized recommendation engine used by both NOW and Concierge.
// Import from this barrel: import { scoreCandidate, ... } from '../shared-scoring'

export * from './types'
export * from './context-tags'
export * from './scoring-engine'
export * from './diversity'
export * from './copy-templates'
