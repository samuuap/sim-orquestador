/**
 * Per-role character appearance.
 *
 * Characters are assembled from Three.js primitives, so "appearance" is a palette plus a handful
 * of shape switches. Proportions are shared (PROPORTIONS) so every character reads as the same
 * species; only colour, hair, accessories and overall height differ.
 */

import type { AgentRole } from '@/types';

export type HairStyle = 'slick' | 'messy' | 'bun';
export type Accessory = 'tie' | 'glasses' | 'headphones' | 'beret' | 'lanyard';

export interface Appearance {
  /** Display name. Sims have names; agents that are only ever "DEVELOPER" feel like furniture. */
  name: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  /** Torso / upper garment. */
  shirt: string;
  /** Secondary garment colour: sleeves, hoodie pocket, suit lapel. */
  shirtAccent: string;
  legs: string;
  shoes: string;
  accessories: Accessory[];
  /** Role colour, reused for the selection ring and the name outline. */
  accent: string;
  /** Multiplies overall character height. Small differences read as personality. */
  heightScale: number;
}

/**
 * Shared skeleton measurements, in world units. The character stands on y=0 and is roughly
 * 1.75 units tall, sized so it sits comfortably next to the 0.8-unit-high desks in Office.tsx.
 */
export const PROPORTIONS = {
  legLength: 0.62,
  legRadius: 0.085,
  hipY: 0.62,
  torsoHeight: 0.56,
  torsoTopRadius: 0.21,
  torsoBottomRadius: 0.17,
  shoulderY: 1.16,
  shoulderX: 0.2,
  armLength: 0.5,
  armRadius: 0.062,
  neckY: 1.2,
  headY: 1.42,
  headRadius: 0.2,
  /** Plumbob floats here, above the head. */
  plumbobY: 1.95,
} as const;

const APPEARANCES: Record<AgentRole, Appearance> = {
  ceo: {
    name: 'Robin',
    skin: '#e8b98f',
    hair: '#2f2620',
    hairStyle: 'slick',
    shirt: '#27364d',
    shirtAccent: '#1b2639',
    legs: '#1b2639',
    shoes: '#141821',
    accessories: ['tie', 'lanyard'],
    accent: '#f97316',
    heightScale: 1.04,
  },
  designer: {
    name: 'Ash',
    skin: '#d9a273',
    hair: '#3b1f47',
    hairStyle: 'bun',
    shirt: '#a855f7',
    shirtAccent: '#7e22ce',
    legs: '#3f3f46',
    shoes: '#e2e8f0',
    accessories: ['beret'],
    accent: '#a855f7',
    heightScale: 0.97,
  },
  developer: {
    name: 'Kai',
    skin: '#c78e5c',
    hair: '#191f2b',
    hairStyle: 'messy',
    shirt: '#3b82f6',
    shirtAccent: '#1d4ed8',
    legs: '#232a38',
    shoes: '#2b3342',
    accessories: ['headphones', 'glasses'],
    accent: '#3b82f6',
    heightScale: 1.0,
  },
};

export function appearanceFor(role: AgentRole): Appearance {
  return APPEARANCES[role];
}

/**
 * Plumbob colour by agent state. This is the primary state read at a glance — it is far more
 * legible from an isometric camera than tinting the whole body.
 */
export const PLUMBOB_COLORS = {
  IDLE: '#22c55e',
  THINKING: '#fbbf24',
  WORKING: '#38bdf8',
  WAITING: '#94a3b8',
  COMPLETED: '#4ade80',
  ERROR: '#ef4444',
} as const;
