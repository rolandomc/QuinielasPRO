-- ============================================================
-- FIX: Vista saldos
--
-- PROBLEMA ANTERIOR:
--   disponible = u.saldo - SUM(pendientes)
--
--   Esto causaba un bug visible al aprobar un retiro:
--   El RPC solicitar_retiro ya descuenta `saldo` en la tabla usuarios
--   cuando se crea la solicitud (estado='pendiente').
--   Cuando el admin aprueba, el estado pasa a 'aprobado' y la vista
--   dejaba de restar ese monto — haciendo que `disponible` SUBIERA
--   al valor original, mostrando saldo incorrecto al usuario.
--
-- SOLUCIÓN:
--   disponible = u.saldo          (valor real ya descontado en DB por el RPC)
--   en_retiro  = SUM(pendientes)  (solo informativo, para mostrar cuanto está bloqueado)
--   saldo_total = disponible + en_retiro (suma lógica para la UI)
--
--   De esta forma la UI siempre refleja el estado correcto:
--   - Al crear solicitud:  disponible baja,   en_retiro sube
--   - Al aprobar:          disponible no cambia, en_retiro baja a 0
--   - Al rechazar:         disponible sube (RPC devuelve saldo), en_retiro baja a 0
-- ============================================================

create or replace view public.saldos as
select
  u.id                                                                        as usuario_id,
  u.saldo                                                                     as disponible,
  coalesce(sum(r.monto) filter (where r.estado = 'pendiente'), 0)             as en_retiro,
  u.saldo + coalesce(sum(r.monto) filter (where r.estado = 'pendiente'), 0)   as saldo_total
from public.usuarios u
left join public.solicitudes_retiro r on r.usuario_id = u.id
group by u.id, u.saldo;

-- Asegurar permisos
grant select on public.saldos to authenticated;
