-- =============================================================================
-- Fase 1 · Seguridad (RLS + permisos) y Realtime
--
-- Regla: solo la cuenta del local (registrada en privado.cuentas_local) puede
-- leer o escribir. Sin sesión (rol anon) no hay acceso a ninguna tabla.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Esquema privado: lo mínimo para que las políticas funcionen
-- -----------------------------------------------------------------------------
grant usage on schema privado to authenticated;
revoke execute on all functions in schema privado from public, anon, authenticated;
grant execute on function privado.es_cuenta_local() to authenticated;
grant execute on function privado.encabezado(text) to authenticated;
grant execute on function privado.persona_actual() to authenticated;
grant execute on function privado.diferencias(jsonb, jsonb, text[]) to authenticated;

alter table privado.cuentas_local enable row level security;
alter table privado.personas_pin enable row level security;
revoke all on all tables in schema privado from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Sin acceso anónimo a nada del esquema público
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- -----------------------------------------------------------------------------
-- RLS: una política por tabla, para la cuenta del local
-- -----------------------------------------------------------------------------
alter table public.personas enable row level security;
alter table public.clientes enable row level security;
alter table public.categorias enable row level security;
alter table public.proyectos enable row level security;
alter table public.tareas enable row level security;
alter table public.tarea_responsables enable row level security;
alter table public.subtareas enable row level security;
alter table public.eventos enable row level security;
alter table public.configuracion enable row level security;

create policy cuenta_local on public.personas for all to authenticated
  using ((select privado.es_cuenta_local())) with check ((select privado.es_cuenta_local()));
create policy cuenta_local on public.clientes for all to authenticated
  using ((select privado.es_cuenta_local())) with check ((select privado.es_cuenta_local()));
create policy cuenta_local on public.categorias for all to authenticated
  using ((select privado.es_cuenta_local())) with check ((select privado.es_cuenta_local()));
create policy cuenta_local on public.proyectos for all to authenticated
  using ((select privado.es_cuenta_local())) with check ((select privado.es_cuenta_local()));
create policy cuenta_local on public.tareas for all to authenticated
  using ((select privado.es_cuenta_local())) with check ((select privado.es_cuenta_local()));
create policy cuenta_local on public.tarea_responsables for all to authenticated
  using ((select privado.es_cuenta_local())) with check ((select privado.es_cuenta_local()));
create policy cuenta_local on public.subtareas for all to authenticated
  using ((select privado.es_cuenta_local())) with check ((select privado.es_cuenta_local()));
create policy cuenta_local on public.configuracion for all to authenticated
  using ((select privado.es_cuenta_local())) with check ((select privado.es_cuenta_local()));

-- El historial es de solo lectura: lo escriben únicamente los triggers.
create policy cuenta_local_lectura on public.eventos for select to authenticated
  using ((select privado.es_cuenta_local()));
revoke insert, update, delete, truncate on public.eventos from authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: tablas que escucha la interfaz (especificación, sección 4.5)
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.tareas,
  public.subtareas,
  public.tarea_responsables,
  public.proyectos,
  public.personas,
  public.configuracion,
  public.eventos;
