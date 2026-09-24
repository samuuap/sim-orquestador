/**
 * Character identity: proportions, silhouette switches and names.
 *
 * Colour lives in assets/materials.ts, not here — every mesh pulls a shared material by role so
 * the scene allocates ~45 materials instead of one per mesh.
 */

import type { AgentRole } from '@/types';

export type HairStyle = 'slick' | 'messy' | 'bun';
export type Accessory =
  | 'tie'
  | 'glasses'
  | 'headphones'
  | 'beret'
  | 'lanyard'
  | 'hoodie'
  | 'blazer'
  | 'clipboard';

export interface Appearance {
  name: string;
  hairStyle: HairStyle;
  accessories: Accessory[];
  /** Multiplies overall height. Small differences read as individuals rather than clones. */
  heightScale: number;
  /** Shoulder width multiplier — build differs between people more visibly than height. */
  buildScale: number;
}

/**
 * Human-ish proportions for a ~1.78-unit character: the head is about 1/7 of total height.
 * The previous version used a 1/8 head on a 1.6 body, which reads as a toy.
 *
 * Joint heights are absolute (feet at y=0); limb segments are lengths between them.
 */
export const P = {
  ankleY: 0.075,
  kneeY: 0.49,
  hipY: 0.95,
  waistY: 1.1,
  shoulderY: 1.42,
  neckY: 1.46,
  headY: 1.655,
  headRadius: 0.125,
  plumbobY: 2.06,

  thigh: 0.46,
  shin: 0.415,
  upperArm: 0.28,
  foreArm: 0.26,

  hipX: 0.088,
  shoulderX: 0.185,

  thighRadius: 0.079,
  shinRadius: 0.062,
  upperArmRadius: 0.055,
  foreArmRadius: 0.046,

  chestTopRadius: 0.175,
  chestBottomRadius: 0.132,
  pelvisRadius: 0.152,
} as const;

const APPEARANCES: Record<AgentRole, Appearance> = {
  ceo: {
    name: 'Robin',
    hairStyle: 'slick',
    accessories: ['blazer', 'tie', 'lanyard'],
    heightScale: 1.04,
    buildScale: 1.06,
  },
  project_manager: {
    name: 'Noa',
    hairStyle: 'slick',
    // The clipboard is the read: a PM is recognisable by what they carry, at any zoom level.
    accessories: ['lanyard', 'glasses', 'clipboard'],
    heightScale: 0.99,
    buildScale: 0.98,
  },
  designer: {
    name: 'Ash',
    hairStyle: 'bun',
    accessories: ['beret'],
    heightScale: 0.96,
    buildScale: 0.94,
  },
  developer: {
    name: 'Kai',
    hairStyle: 'messy',
    accessories: ['hoodie', 'headphones', 'glasses'],
    heightScale: 1.0,
    buildScale: 1.0,
  },
};

export function appearanceFor(role: AgentRole): Appearance {
  return APPEARANCES[role];
}

/** Plumbob colour by agent state — the state read, kept off the body so the costume stays legible. */
export const PLUMBOB_COLORS = {
  IDLE: '#22c55e',
  THINKING: '#fbbf24',
  WORKING: '#38bdf8',
  WAITING: '#94a3b8',
  COMPLETED: '#4ade80',
  ERROR: '#ef4444',
} as const;
