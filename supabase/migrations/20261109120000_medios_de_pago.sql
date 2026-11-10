-- Medio de pago de la seña y del saldo (orden de trabajo de papel).
-- Equivale a server/migraciones/0002_medios_de_pago.sql. Pendiente de aplicar:
-- el prototipo usa la base local hasta la migración a Supabase.
create type public.medio_pago as enum ('posnet', 'efectivo', 'transferencia');

alter table public.tareas
  add column sena_medio public.medio_pago,
  add column saldo_medio public.medio_pago;
