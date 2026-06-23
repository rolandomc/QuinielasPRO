/**
 * constants/colors.ts
 * Paleta única del proyecto — fuente de verdad para todos los colores.
 *
 * Todos los archivos deben importar desde aquí:
 *   import { COLORS } from '@/constants/colors';
 *
 * Las constantes locales `const C = { ... }` en cada pantalla se eliminan
 * en el Paso 3 (migración de features/) y se reemplazan por esta.
 */

export const COLORS = {
  // ── Fondos ──────────────────────────────────────────────────────────────
  bg:          '#0b0b10',
  bgAlt:       '#0d0d1a',    // variante usada en resultados.tsx
  card:        '#13131a',
  cardAlt:     '#161625',    // variante usada en resultados.tsx
  cardBorder:  '#1f1f2e',
  cardBorderAlt: '#1e1e35', // variante usada en resultados.tsx
  darkRow:     '#12121f',

  // ── Acento principal (cian) ──────────────────────────────────────────────
  accent:      '#00d4ff',
  accentAlt:   '#00b4d8',   // variante usada en resultados.tsx
  accentDim:   'rgba(0,212,255,0.10)',
  accentGlow:  'rgba(0,212,255,0.25)',

  // ── Texto ────────────────────────────────────────────────────────────────
  text:        '#f4f4ff',
  textAlt:     '#f0f0ff',   // variante usada en resultados.tsx
  textSub:     '#7070a0',
  textSubAlt:  '#8888aa',   // variante usada en resultados.tsx

  // ── Semánticos ──────────────────────────────────────────────────────────
  green:       '#00e5a0',
  greenAlt:    '#00c897',   // variante usada en resultados.tsx
  greenDim:    'rgba(0,229,160,0.10)',
  greenGlow:   'rgba(0,229,160,0.28)',

  orange:      '#ffb340',
  orangeAlt:   '#ff9f43',   // variante usada en resultados.tsx
  orangeDim:   'rgba(255,179,64,0.10)',
  orangeGlow:  'rgba(255,179,64,0.28)',

  red:         '#ff5a6e',
  redAlt:      '#ff6b6b',   // variante usada en resultados.tsx
  redDim:      'rgba(255,90,110,0.10)',

  gold:        '#ffd060',
  goldFull:    '#ffd700',   // usado en podio / medallas
  goldDim:     'rgba(255,208,96,0.10)',
  goldGlow:    'rgba(255,208,96,0.28)',

  purple:      '#b57bff',

  // ── Aliases semánticos (para legibilidad en pantallas) ──────────────────
  success:     '#00e5a0',   // === green
  danger:      '#ff5a6e',   // === red
  warning:     '#ffb340',   // === orange
  info:        '#00d4ff',   // === accent
} as const;

/** Tipo derivado de la paleta para autocompletado. */
export type ColorKey = keyof typeof COLORS;
