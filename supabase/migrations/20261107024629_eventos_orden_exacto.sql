-- =============================================================================
-- Fase 1 · Orden exacto del historial
-- now() es la hora de inicio de la transacción: varios eventos de una misma
-- operación quedaban con la misma hora y podían listarse desordenados.
-- clock_timestamp() da la hora real de cada inserción.
-- =============================================================================
alter table public.eventos alter column created_at set default clock_timestamp();
