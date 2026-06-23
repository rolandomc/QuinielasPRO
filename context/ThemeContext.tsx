import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'quinielaspro_theme';

// ─── Paleta STATZ-style: negro profundo + cards con glow de color ──────────────
const dark = {
  bg:           '#0b0b10',
  bg2:          '#0e0e14',
  card:         '#13131a',
  card2:        '#16161f',
  cardBorder:   '#1f1f2e',
  cardBorder2:  '#22223a',

  // Acento principal — cyan/teal brillante
  accent:       '#00d4ff',
  accentDim:    'rgba(0,212,255,0.10)',
  accentGlow:   'rgba(0,212,255,0.25)',

  text:         '#f4f4ff',
  textSub:      '#7070a0',
  textMuted:    '#3a3a5a',

  // Verde neón — partidos confirmados, pago confirmado
  green:        '#00e5a0',
  greenDim:     'rgba(0,229,160,0.10)',
  greenGlow:    'rgba(0,229,160,0.28)',

  // Naranja ámbar — advertencias, urgente
  orange:       '#ffb340',
  orangeDim:    'rgba(255,179,64,0.10)',
  orangeGlow:   'rgba(255,179,64,0.28)',

  // Rojo coral — errores, crítico
  red:          '#ff5a6e',
  redDim:       'rgba(255,90,110,0.10)',
  redGlow:      'rgba(255,90,110,0.28)',

  // Dorado — premios, precio
  gold:         '#ffd060',
  goldDim:      'rgba(255,208,96,0.10)',
  goldGlow:     'rgba(255,208,96,0.28)',

  // Morado — bet builder, especial
  purple:       '#b57bff',
  purpleDim:    'rgba(181,123,255,0.10)',
  purpleGlow:   'rgba(181,123,255,0.28)',

  // Rosa magenta — next match hero card
  pink:         '#ff4fa0',
  pinkDim:      'rgba(255,79,160,0.10)',
  pinkGlow:     'rgba(255,79,160,0.28)',

  tabBar:       '#0e0e14',
  tabBarBorder: '#1a1a28',
  statusBar:    'light' as const,
};

// Modo claro — mantiene misma estructura pero superficies claras
const light = {
  bg:           '#f0f2f8',
  bg2:          '#f5f7fc',
  card:         '#ffffff',
  card2:        '#f8f9ff',
  cardBorder:   '#dde1ef',
  cardBorder2:  '#e0e4f0',
  accent:       '#009fc0',
  accentDim:    'rgba(0,159,192,0.10)',
  accentGlow:   'rgba(0,159,192,0.20)',
  text:         '#0e0e20',
  textSub:      '#555577',
  textMuted:    '#9999bb',
  green:        '#00a878',
  greenDim:     'rgba(0,168,120,0.10)',
  greenGlow:    'rgba(0,168,120,0.20)',
  orange:       '#e08a00',
  orangeDim:    'rgba(224,138,0,0.10)',
  orangeGlow:   'rgba(224,138,0,0.20)',
  red:          '#d94f4f',
  redDim:       'rgba(217,79,79,0.08)',
  redGlow:      'rgba(217,79,79,0.18)',
  gold:         '#c8a200',
  goldDim:      'rgba(200,162,0,0.10)',
  goldGlow:     'rgba(200,162,0,0.20)',
  purple:       '#7c5cbf',
  purpleDim:    'rgba(124,92,191,0.10)',
  purpleGlow:   'rgba(124,92,191,0.20)',
  pink:         '#d43880',
  pinkDim:      'rgba(212,56,128,0.10)',
  pinkGlow:     'rgba(212,56,128,0.20)',
  tabBar:       '#ffffff',
  tabBarBorder: '#dde1ef',
  statusBar:    'dark' as const,
};

export type ThemeColors = typeof dark;

type ThemeContextType = {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  colors: dark,
  toggleTheme: () => {},
});

const getStored = (): Theme => {
  try {
    if (Platform.OS === 'web') {
      return (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark';
    }
  } catch {}
  return 'dark';
};

const setStored = (t: Theme) => {
  try {
    if (Platform.OS === 'web') localStorage.setItem(STORAGE_KEY, t);
  } catch {}
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getStored);
  useEffect(() => { setStored(theme); }, [theme]);
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return (
    <ThemeContext.Provider value={{ theme, colors: theme === 'dark' ? dark : light, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
