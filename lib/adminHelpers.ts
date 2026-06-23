/**
 * lib/adminHelpers.ts
 * Constantes de color, helpers de UI y utilidades compartidas para las
 * pantallas de administración. Importar desde aquí para no duplicar código.
 */
import { Platform } from 'react-native';

// ─── Paleta de colores del admin ──────────────────────────────────────────
export const C = {
  bg: '#0a0a15',
  card: '#131320',
  cardBorder: '#1c1c30',
  accent: '#00b4d8',
  accentDim: 'rgba(0,180,216,0.1)',
  text: '#f0f0ff',
  textSub: '#7777aa',
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
} as const;

// ─── Helpers de estado de jornada ─────────────────────────────────────────
export function estadoColorJornada(estado: string): string {
  if (estado === 'abierta') return C.green;
  if (estado === 'cerrada') return C.orange;
  return C.textSub;
}

export function estadoDimJornada(estado: string): string {
  if (estado === 'abierta') return C.greenDim;
  if (estado === 'cerrada') return C.orangeDim;
  return 'rgba(100,100,130,0.1)';
}

export function estadoLabelJornada(estado: string): string {
  if (estado === 'abierta') return 'ABIERTA';
  if (estado === 'cerrada') return 'EN CURSO';
  return 'FINALIZADA';
}

// ─── Diálogos ─────────────────────────────────────────────────────────────
export function confirmar(
  titulo: string,
  mensaje: string,
  onConfirm: () => void
): void {
  if (Platform.OS === 'web') {
    if ((window as any).confirm(`${titulo}\n\n${mensaje}`)) onConfirm();
  } else {
    const { Alert } = require('react-native');
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export function avisar(titulo: string, mensaje: string): void {
  if (Platform.OS === 'web') {
    (window as any).alert(`${titulo}\n\n${mensaje}`);
  } else {
    const { Alert } = require('react-native');
    Alert.alert(titulo, mensaje);
  }
}

// ─── Formatos ─────────────────────────────────────────────────────────────
export function fmtMoneda(valor: number): string {
  return `$${valor.toFixed(2)}`;
}

export function fmtFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}
