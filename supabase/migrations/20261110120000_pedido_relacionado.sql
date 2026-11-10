-- Tarea interna relacionada con un pedido (orden de trabajo).
-- Equivale a server/migraciones/0003_pedido_relacionado.sql. Pendiente de
-- aplicar: el prototipo usa la base local hasta la migración a Supabase.
alter table public.tareas
  add column pedido_id uuid references public.tareas (id) on delete set null,
  add constraint tareas_pedido_solo_internas check (pedido_id is null or tipo = 'interna'),
  add constraint tareas_pedido_no_ella_misma check (pedido_id is null or pedido_id <> id);

create index tareas_pedido_idx on public.tareas (pedido_id) where pedido_id is not null;
