/**
 * constants/theme.ts
 * Tokens de espaciado, tipografía, radios y sombras del proyecto.
 * Complementa colors.ts con el resto del sistema de diseño.
 */

import { COLORS } from './colors';

// ── Espaciado (base 4 px) ──────────────────────────────────────────────────
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  base: 16,
  lg:  20,
  xl:  24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

// ── Tipografía ─────────────────────────────────────────────────────────────
export const FONT_SIZE = {
  xs:   10,
  sm:   11,
  base: 13,
  md:   15,
  lg:   17,
  xl:   20,
  '2xl': 24,
  '3xl': 28,
} as const;

export const FONT_WEIGHT = {
  regular:   '400',
  medium:    '600',
  bold:      '700',
  black:     '800',
  extraBlack:'900',
} as const;

// ── Bordes ─────────────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   8,
  md:   10,
  lg:   12,
  xl:   14,
  full: 9999,
} as const;

// ── Sombras de neón (usadas con NeonWrapper) ───────────────────────────────
export const GLOW = {
  accent: COLORS.accentGlow,
  green:  COLORS.greenGlow,
  orange: COLORS.orangeGlow,
  gold:   COLORS.goldGlow,
} as const;

// ── Opacidades estándar ────────────────────────────────────────────────────
export const OPACITY = {
  disabled: 0.45,
  dimmed:   0.6,
  full:     1,
} as const;
