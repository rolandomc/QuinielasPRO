/**
 * types/usuario.ts
 * Interfaces para usuarios y autenticación.
 */

/** Perfil de usuario almacenado en la tabla `usuarios`. */
export interface Usuario {
  id: string;
  nombre: string;
  username: string;
  email: string;
  saldo: number;
  es_admin: boolean;
  creado_en?: string;
}

/** Datos mínimos del usuario que se usan en joins (ej: admin de retiros). */
export interface UsuarioResumen {
  id: string;
  nombre: string;
  username: string;
}

/** Parámetros para registro de nuevo usuario. */
export interface RegistroParams {
  email: string;
  password: string;
  nombre: string;
  username: string;
}
