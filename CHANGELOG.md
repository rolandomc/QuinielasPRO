# Changelog — QuinielasPRO

## [Unreleased] — Fase 2 Limpieza (2026-06-24)

### Removido / Deprecado
- `lib/retiros.ts` — stub vacío eliminado; lógica en `features/retiro/`
- `lib/adminHelpers.ts` — stub vacío eliminado; helpers en `features/retiro/retiroUtils.ts`
- `hooks/useAdminData.ts` — dead code marcado; se activará en Fase 3 al refactorizar admin.tsx
- `app/solicitar-retiro.tsx` — duplicado de ModalRetiro en billetera; ahora redirige a `/(tabs)/billetera`
- `app/registro.tsx` — flujo pre-auth obsoleto; ahora redirige a `/login`

### Corregido (Fase 1 — 2026-06-24)
- Guard de navegación en `_layout.tsx`: whitelist de rutas autenticadas (`admin`, `admin-retiros`, `mis-pronosticos`)
- Pantalla `pago/pendiente.tsx` creada (faltaba en MercadoPago `back_urls.pending`)
- URLs hardcodeadas de Supabase eliminadas de `quiniela.tsx` y `registro.tsx`
- `.env.example` creado con todas las variables requeridas
- SQL `acreditar_premio()` — RPC idempotente premios → billetera
- SQL `confirmar_pago_quiniela()` — RPC idempotente para webhook de pago

## Estado por área

| Área | Antes | Después Fase 1+2 |
|------|-------|------------------|
| Quiniela + pagos | ~80% | ~85% |
| Billetera/retiros | ~70% | ~80% |
| Guard navegación | ❌ roto | ✅ corregido |
| URLs hardcodeadas | ❌ 2 archivos | ✅ 0 |
| Stubs/dead code | 4 archivos | marcados para Fase 3 |

## Pendiente — Fase 3
- Conectar `admin.tsx` → `useAdminData.ts` + extraer lógica
- Conectar webhook MP → `confirmar_pago_quiniela()` RPC
- Conectar `calcularGanador()` → `acreditar_premio()` RPC
- Unificar theming (login, admin, pago usan colores fijos)
- README real
