/**
 * Shared material library.
 *
 * Every material in the scene comes from here. The previous version declared <meshStandardMaterial>
 * inline in JSX, which creates a NEW material instance per mesh — roughly 140 of them, none shared.
 * Unique material count, not mesh count, is what drives GPU state changes, so sharing by role is
 * both the performance fix and what makes the scene read as one art direction.
 *
 * Roles follow the material-kit convention: bodyPrimary / bodySecondary / trim / glass /
 * emissiveSignal / groundContact, plus character-specific skin, hair and fabric zones.
 */

import * as THREE from 'three';
import type { AgentRole } from '@/types';

const std = (params: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(params);

/** Per-role character palette. One set per agent, shared across all that agent's meshes. */
export interface CharacterMaterials {
  skin: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  /** Dominant garment: shirt, jacket body. */
  fabricPrimary: THREE.MeshStandardMaterial;
  /** Contrast garment: sleeves, hood, trousers. */
  fabricSecondary: THREE.MeshStandardMaterial;
  /** Role colour: tie, beret, trim strips. */
  accent: THREE.MeshStandardMaterial;
  shoe: THREE.MeshStandardMaterial;
}

interface CharacterPalette {
  skin: string;
  hair: string;
  fabricPrimary: string;
  fabricSecondary: string;
  accent: string;
  shoe: string;
}

const PALETTES: Record<AgentRole, CharacterPalette> = {
  ceo: {
    skin: '#e0ac81',
    hair: '#2b2118',
    fabricPrimary: '#2d3b54',
    fabricSecondary: '#1d2738',
    accent: '#f97316',
    shoe: '#15181f',
  },
  project_manager: {
    skin: '#d79b6e',
    hair: '#4a2c1a',
    fabricPrimary: '#0f766e',
    fabricSecondary: '#134e4a',
    accent: '#2dd4bf',
    shoe: '#1c2128',
  },
  designer: {
    skin: '#c98d61',
    hair: '#2a1730',
    fabricPrimary: '#9333ea',
    fabricSecondary: '#3f3f46',
    accent: '#e879f9',
    shoe: '#e7e5e4',
  },
  developer: {
    skin: '#a96b40',
    hair: '#14181f',
    fabricPrimary: '#2563eb',
    fabricSecondary: '#1e293b',
    accent: '#38bdf8',
    shoe: '#2b3342',
  },
};

/** Role accent colour, reused by the name plate, the selection ring and the desk screen. */
export const ACCENT: Record<AgentRole, string> = {
  ceo: PALETTES.ceo.accent,
  project_manager: PALETTES.project_manager.accent,
  designer: PALETTES.designer.accent,
  developer: PALETTES.developer.accent,
};

const characterCache = new Map<AgentRole, CharacterMaterials>();

export function characterMaterials(role: AgentRole): CharacterMaterials {
  const cached = characterCache.get(role);
  if (cached) return cached;

  const p = PALETTES[role];
  const set: CharacterMaterials = {
    // Slight sheen on skin reads as subsurface without costing a custom shader.
    skin: std({ color: p.skin, roughness: 0.62, metalness: 0.02 }),
    hair: std({ color: p.hair, roughness: 0.88, metalness: 0.04 }),
    fabricPrimary: std({ color: p.fabricPrimary, roughness: 0.82 }),
    fabricSecondary: std({ color: p.fabricSecondary, roughness: 0.86 }),
    accent: std({ color: p.accent, roughness: 0.55, metalness: 0.08 }),
    shoe: std({ color: p.shoe, roughness: 0.5, metalness: 0.12 }),
  };
  characterCache.set(role, set);
  return set;
}

/** Screens glow in the owning agent's colour, so a desk reads as that agent's even when empty. */
const screenCache = new Map<AgentRole, THREE.MeshStandardMaterial>();

export function screenMaterial(role: AgentRole): THREE.MeshStandardMaterial {
  const cached = screenCache.get(role);
  if (cached) return cached;
  const color = PALETTES[role].accent;
  const material = std({ color, emissive: color, emissiveIntensity: 0.85, roughness: 0.35 });
  screenCache.set(role, material);
  return material;
}

/**
 * The plumbob animates its colour per agent, so it cannot be shared — but three instances is
 * still three, not one per mesh.
 */
export function createPlumbobMaterial(): THREE.MeshStandardMaterial {
  return std({
    color: '#22c55e',
    emissive: '#22c55e',
    emissiveIntensity: 1.1,
    roughness: 0.15,
    metalness: 0,
    transparent: true,
    opacity: 0.9,
  });
}

/** Everything that is not a character. Created once at module load and reused everywhere. */
export const WORLD = {
  eye: std({ color: '#171412', roughness: 0.25 }),
  eyeWhite: std({ color: '#f5f3f0', roughness: 0.3 }),
  mouth: std({ color: '#7d4038', roughness: 0.7 }),
  lensFrame: std({ color: '#0f172a', roughness: 0.3, metalness: 0.6 }),

  floor: std({ color: '#2a3344', roughness: 0.72, metalness: 0.08 }),
  floorInlay: std({ color: '#323d52', roughness: 0.55, metalness: 0.15 }),
  rug: std({ color: '#3d3558', roughness: 0.96 }),
  wall: std({ color: '#3a4459', roughness: 0.9 }),
  wallTrim: std({ color: '#262e3d', roughness: 0.7, metalness: 0.2 }),
  ceiling: std({ color: '#222a38', roughness: 0.9 }),

  deskTop: std({ color: '#8a6244', roughness: 0.65 }),
  deskFrame: std({ color: '#2b3444', roughness: 0.45, metalness: 0.55 }),
  monitorShell: std({ color: '#141a24', roughness: 0.42, metalness: 0.35 }),
  peripheral: std({ color: '#1b2230', roughness: 0.6 }),

  metal: std({ color: '#5a6678', roughness: 0.38, metalness: 0.7 }),
  plantLeaf: std({ color: '#2f8f52', roughness: 0.85 }),
  plantPot: std({ color: '#96604a', roughness: 0.82 }),
  paper: std({ color: '#f1f5f9', roughness: 0.55 }),

  /** Hover badge telling the player a character can be inspected. */
  brain: std({ color: '#f5a3c7', emissive: '#e0679c', emissiveIntensity: 0.4, roughness: 0.7 }),

  /** Ceiling panels and the cooler bottle: authored emissive, not whole-object glow. */
  panelLight: std({
    color: '#dbeafe',
    emissive: '#cfe4ff',
    emissiveIntensity: 1.5,
    roughness: 0.4,
  }),

  glass: new THREE.MeshPhysicalMaterial({
    color: '#bfdbfe',
    roughness: 0.08,
    metalness: 0,
    transmission: 0.55,
    thickness: 0.4,
    transparent: true,
    opacity: 0.32,
  }),

  /** Distant skyline: unlit so it costs nothing and stays flat against the sky. */
  skyline: new THREE.MeshBasicMaterial({ color: '#1b2334' }),
  skylineLit: new THREE.MeshBasicMaterial({ color: '#2d3a55' }),

  /** Cheap grounding for props that do not earn a real shadow. */
  contactShadow: new THREE.MeshBasicMaterial({
    color: '#000000',
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  }),
} as const;

/** Shared geometries for anything instanced or repeated. Geometry count is also a budget line. */
export const GEO = {
  unitBox: new THREE.BoxGeometry(1, 1, 1),
  unitPlane: new THREE.PlaneGeometry(1, 1),
  contactDisc: new THREE.CircleGeometry(1, 16),
} as const;

/** Diagnostics helper: how many distinct materials this library actually allocates. */
export function materialCount(): number {
  return Object.keys(WORLD).length + characterCache.size * 6 + screenCache.size;
}
