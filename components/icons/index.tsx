/**
 * components/icons/index.tsx
 *
 * Archivo centralizado de íconos SVG para React Native (Expo).
 * Usa react-native-svg (ya incluido en Expo vía expo-router).
 *
 * Uso:
 *   import { CifMx, BanderaCircular } from '@/components/icons'
 *
 *   <CifMx width={42} height={24} />
 *   <BanderaCircular pais="mx" size={32} />
 *
 * Para agregar más banderas circulares:
 *   https://icons0.dev/?collection=circle-flags
 *   Copia el SVG, conviértelo con https://react-svgr.com/playground/?native=true
 *   y agrégalo como nueva función exportada abajo.
 */

import * as React from 'react'
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'

// ─────────────────────────────────────────────
// Tipos base
// ─────────────────────────────────────────────

interface IconProps {
  width?: number
  height?: number
  style?: object
}

// ─────────────────────────────────────────────
// Banderas rectangulares (CIF)
// ─────────────────────────────────────────────

/** Bandera de México (rectangular, estilo CIF) */
export function CifMx({ width = 42, height = 24, style }: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 301 173"
      style={style}
    >
      <Defs>
        <RadialGradient
          id="a"
          cx="50.012%"
          cy="49.987%"
          r="64.817%"
          fx="50.012%"
          fy="49.987%"
          gradientTransform="matrix(.92105 .26596 -.38946 .62898 .234 .052)"
        >
          <Stop offset="0%" stopColor="#FFF" />
          <Stop offset="100%" stopColor="#F15770" />
        </RadialGradient>
      </Defs>
      <G fill="none">
        <Path fill="#FFF" d="M.51.788h299.994v171.427H.51z" />
        <Path fill="#006847" d="M.51.788h99.997v171.427H.51z" />
        <Path fill="#CE1126" d="M200.513.788h99.997v171.427h-99.997z" />
        {/* Águila central simplificada */}
        <Path
          fill="#A8AC71"
          d="M134.48 66.937s-1.795.154-3.042-.062-.974-3.395-1.004-3.488-.76-.864-.639-1.574c.122-.71 2.426-2.583 2.738-2.685.213-.069.669.124.669.124s.583-.567.755-.567c.178 0 .424.327.356.466-.069.138-.86.601-.921.956s.008.71-.221 1.057c-.228.347-.669.818-.722 1.111s-.182.548.038.656c.221.108.974.015 1.62-.277.646-.294.912-.687 1.004-.648.091.038-.373.809-1.088 1.111s-1.187.648-1.544.594c0 0-.395.949.829 1.003s1.901-.27 1.901-.27zm-7.013 7.484s.943.37.943 1.421c0 1.049-1.034 1.928-1.004 3.78s.318 1.871 2.769 3.859c.076.062.593.587.73 1.189.138.601.578 4.151 2.937 4.134 2.357-.015 2.677-1.511 2.677-1.511l-1.004-1.482s-.822.246-1.263.139c-.441-.109-.836-.402-1.095-.972-.258-.571-.329-1.932-.73-2.531-.989-1.482-2.754-1.729-2.769-3.288s1.08-1.728.776-3.581-2.51-2.747-2.51-2.747l-.897-.363-.312 1.86z"
        />
        <Circle cx="132.927" cy="59.586" r="1" fill="#1C242F" />
      </G>
    </Svg>
  )
}

// ─────────────────────────────────────────────
// Banderas circulares (Circle Flags)
// ─────────────────────────────────────────────

/** Bandera circular de México */
export function CircleMx({ size = 32, style }: { size?: number; style?: object }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
      <Circle cx="256" cy="256" r="256" fill="#f0f0f0" />
      <Path
        fill="#d80027"
        d="M345.043 256c0 49.178-21.943 93.368-56.868 123.879L256 512c141.384 0 256-114.616 256-256"
      />
      <Path
        fill="#6da544"
        d="M0 256c0 141.384 114.616 256 256 256l33.175-256L256 0C114.616 0 0 114.616 0 256"
      />
      <Path
        fill="#f0f0f0"
        d="M256 0v512c49.178 0 93.368-21.943 123.879-56.868L256 256l123.879-199.132C349.368 21.943 305.178 0 256 0z"
      />
      <Circle cx="256" cy="256" r="89.043" fill="#496e2d" />
      <Circle cx="256" cy="256" r="55.652" fill="#ff9811" />
    </Svg>
  )
}

/** Bandera circular de USA */
export function CircleUs({ size = 32, style }: { size?: number; style?: object }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
      <Circle cx="256" cy="256" r="256" fill="#f0f0f0" />
      <Path
        fill="#d80027"
        d="M244.87 256H512c0-23.106-3.08-45.49-8.819-66.783H244.87V256zM244.87 122.435h229.556a257.35 257.35 0 0 0-59.07-66.783H244.87v66.783zM256 512c60.249 0 115.626-20.824 159.356-55.652H96.644C140.374 491.176 195.751 512 256 512zM37.574 389.565h436.852a254.474 254.474 0 0 0 28.755-66.783H8.819a254.474 254.474 0 0 0 28.755 66.783z"
      />
      <Path
        fill="#0052b4"
        d="M118.584 39.978A256.128 256.128 0 0 0 8.819 189.217h109.765V39.978z"
      />
      <Path
        fill="#f0f0f0"
        d="M118.584 189.217H8.819A258.865 258.865 0 0 0 0 256h118.584V189.217z"
      />
    </Svg>
  )
}

/** Bandera circular de España */
export function CircleEs({ size = 32, style }: { size?: number; style?: object }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
      <Circle cx="256" cy="256" r="256" fill="#ffda44" />
      <Path
        fill="#d80027"
        d="M0 256C0 154.506 61.4 67.308 150.261 28.036v455.928C61.4 444.692 0 357.494 0 256zM361.739 28.036v455.928C450.6 444.692 512 357.494 512 256S450.6 67.308 361.739 28.036z"
      />
    </Svg>
  )
}

/** Bandera circular de Brasil */
export function CircleBr({ size = 32, style }: { size?: number; style?: object }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
      <Circle cx="256" cy="256" r="256" fill="#6da544" />
      <Path fill="#ffda44" d="M256 100.174L467.478 256 256 411.826 44.522 256z" />
      <Circle cx="256" cy="256" r="89.043" fill="#f0f0f0" />
      <Path
        fill="#0052b4"
        d="M211.478 243.478a111.506 111.506 0 0 0-2.696 24.348c0 49.178 32.307 90.904 77.217 104.649a89.191 89.191 0 0 0 58.26-22.478 111.506 111.506 0 0 0 2.696-24.348c0-49.178-32.307-90.904-77.217-104.649a89.191 89.191 0 0 0-58.26 22.478z"
      />
    </Svg>
  )
}

/** Bandera circular de Argentina */
export function CircleAr({ size = 32, style }: { size?: number; style?: object }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
      <Circle cx="256" cy="256" r="256" fill="#f0f0f0" />
      <Path
        fill="#338af3"
        d="M0 256C0 154.506 61.4 67.308 150.261 28.036v455.928C61.4 444.692 0 357.494 0 256zM361.739 28.036v455.928C450.6 444.692 512 357.494 512 256S450.6 67.308 361.739 28.036z"
      />
      <Circle cx="256" cy="256" r="55.652" fill="#ffda44" />
    </Svg>
  )
}

/** Bandera circular de Alemania */
export function CircleDe({ size = 32, style }: { size?: number; style?: object }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
      <Circle cx="256" cy="256" r="256" fill="#ffda44" />
      <Path fill="#d80027" d="M25.402 144.696h461.195A255.545 255.545 0 0 0 256 0C159.082 0 73.72 55.308 25.402 144.696z" />
      <Path fill="#333" d="M25.402 367.304C73.72 456.692 159.082 512 256 512s182.28-55.308 230.598-144.696H25.402z" />
    </Svg>
  )
}

/** Bandera circular de Francia */
export function CircleFr({ size = 32, style }: { size?: number; style?: object }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
      <Circle cx="256" cy="256" r="256" fill="#f0f0f0" />
      <Path
        fill="#d80027"
        d="M345.043 256c0 141.384 0 256-89.043 256 141.384 0 256-114.616 256-256z"
      />
      <Path
        fill="#0052b4"
        d="M0 256c0 141.384 114.616 256 256 256-89.043 0-89.043-114.616-89.043-256S166.957 0 256 0C114.616 0 0 114.616 0 256z"
      />
    </Svg>
  )
}

/** Bandera circular de Inglaterra / UK */
export function CircleGb({ size = 32, style }: { size?: number; style?: object }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
      <Circle cx="256" cy="256" r="256" fill="#f0f0f0" />
      <Path
        fill="#0052b4"
        d="M52.92 100.142C32.926 124.842 17.458 153.666 8.819 184.969L184.97 361.12V512c41.072-14.21 78.84-37.448 111.011-67.386l-90.074-90.072L52.92 100.142z"
      />
      <Path
        fill="#d80027"
        d="M509.833 222.609H289.391V2.167A258.556 258.556 0 0 0 256 0a258.556 258.556 0 0 0-33.391 2.167v220.442H2.167A258.556 258.556 0 0 0 0 256a258.556 258.556 0 0 0 2.167 33.391h220.442v220.442A258.556 258.556 0 0 0 256 512a258.556 258.556 0 0 0 33.391-2.167V289.391h220.442A258.556 258.556 0 0 0 512 256a258.556 258.556 0 0 0-2.167-33.391z"
      />
    </Svg>
  )
}

// ─────────────────────────────────────────────
// Wrapper genérico (para uso dinámico)
// ─────────────────────────────────────────────

const BANDERAS_MAP: Record<string, React.ComponentType<{ size?: number; style?: object }>> = {
  mx: CircleMx,
  us: CircleUs,
  es: CircleEs,
  br: CircleBr,
  ar: CircleAr,
  de: CircleDe,
  fr: CircleFr,
  gb: CircleGb,
}

/**
 * Bandera circular por código ISO de país.
 * @param pais  Código ISO 3166-1 alpha-2 en minúsculas (ej: "mx", "us", "es")
 * @param size  Tamaño en px (default 32)
 *
 * @example
 * <BanderaCircular pais="mx" size={24} />
 */
export function BanderaCircular({
  pais,
  size = 32,
  style,
}: {
  pais: string
  size?: number
  style?: object
}) {
  const Bandera = BANDERAS_MAP[pais.toLowerCase()]
  if (!Bandera) return null
  return <Bandera size={size} style={style} />
}
