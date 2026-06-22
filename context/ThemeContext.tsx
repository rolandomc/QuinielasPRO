import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'quinielaspro_theme';

const dark = {
  bg: '#0a0a15',
  bg2: '#0d0d1a',
  card: '#131320',
  card2: '#161625',
  cardBorder: '#1c1c30',
  cardBorder2: '#1e1e35',
  accent: '#00b4d8',
  accentDim: 'rgba(0,180,216,0.12)',
  text: '#f0f0ff',
  textSub: '#8888aa',
  textMuted: '#44445a',
  green: '#00c897',
  greenDim: 'rgba(0,200,151,0.12)',
  orange: '#ff9f43',
  orangeDim: 'rgba(255,159,67,0.12)',
  red: '#ff6b6b',
  redDim: 'rgba(255,107,107,0.1)',
  gold: '#ffd700',
  goldDim: 'rgba(255,215,0,0.1)',
  purple: '#a78bfa',
  purpleDim: 'rgba(167,139,250,0.1)',
  tabBar: '#0d0d1a',
  tabBarBorder: '#1e1e30',
  statusBar: 'light' as const,
};

const light = {
  bg: '#f0f2f8',
  bg2: '#f5f7fc',
  card: '#ffffff',
  card2: '#ffffff',
  cardBorder: '#dde1ef',
  cardBorder2: '#e0e4f0',
  accent: '#0096b4',
  accentDim: 'rgba(0,150,180,0.1)',
  text: '#0e0e20',
  textSub: '#555577',
  textMuted: '#9999bb',
  green: '#009e78',
  greenDim: 'rgba(0,158,120,0.1)',
  orange: '#e08a00',
  orangeDim: 'rgba(224,138,0,0.1)',
  red: '#d94f4f',
  redDim: 'rgba(217,79,79,0.08)',
  gold: '#c8a200',
  goldDim: 'rgba(200,162,0,0.1)',
  purple: '#7c5cbf',
  purpleDim: 'rgba(124,92,191,0.1)',
  tabBar: '#ffffff',
  tabBarBorder: '#dde1ef',
  statusBar: 'dark' as const,
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
