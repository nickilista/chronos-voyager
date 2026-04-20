import type { EraId } from '../../eras/eras.ts';
import type { Pantheon } from './types.ts';
import { EGYPT_PANTHEON } from './egypt.ts';
import { GREECE_PANTHEON } from './greece.ts';
import { CHINA_PANTHEON } from './china.ts';
import { ISLAMIC_PANTHEON } from './islamic.ts';
import { INDIA_PANTHEON } from './india.ts';
import { RENAISSANCE_PANTHEON } from './renaissance.ts';
import { EDO_PANTHEON } from './edo.ts';
import { ENLIGHTENMENT_PANTHEON } from './enlightenment.ts';
import { REVOLUTION_PANTHEON } from './revolution.ts';
import { CODEBREAKERS_PANTHEON } from './codebreakers.ts';

/**
 * Registry of per-era pantheons. Keyed by EraId so the celestial-orbit
 * renderer can look up the right iconography whenever the active flow
 * switches era.
 */

export const PANTHEONS: Record<EraId, Pantheon> = {
  egypt: EGYPT_PANTHEON,
  greece: GREECE_PANTHEON,
  china: CHINA_PANTHEON,
  islamic: ISLAMIC_PANTHEON,
  india: INDIA_PANTHEON,
  renaissance: RENAISSANCE_PANTHEON,
  edo: EDO_PANTHEON,
  enlightenment: ENLIGHTENMENT_PANTHEON,
  revolution: REVOLUTION_PANTHEON,
  codebreakers: CODEBREAKERS_PANTHEON,
};

export type { Pantheon, Palette, Figure } from './types.ts';
