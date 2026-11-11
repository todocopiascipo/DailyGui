-- =============================================================================
-- Migración a Supabase · Ajustes para la API de la app
--
-- La app publicada habla con funciones de esta base (ver *_api_funciones.sql)
-- que devuelven lo mismo que el servidor local (server/). Acá: el acceso, el
-- historial con el mismo formato que el servidor local, los avisos en tiempo
-- real y la purga de la papelera.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Acceso: una sola llave. Hoy, solo la cuenta del local (o una conexión directa
-- de administración). `privado.acceso_publico()` decide si la app publicada
-- puede operar sin cuenta; está en false hasta que el usuario lo confirme.
-- -----------------------------------------------------------------------------
create or replace function privado.acceso_publico()
returns boolean
language sql
immutable
set search_path = ''
as $$
  select false;
$$;

create or replace function privado.puede_operar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(auth.role(), '') in ('anon', 'authenticated')
      then privado.es_cuenta_local() or privado.acceso_publico()
    -- Conexión directa (administración, pruebas en SQL).
    else true
  end;
$$;

create or replace function privado.exigir_acceso()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.puede_operar() then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
end;
$$;

-- Errores con mensaje para la pantalla. P0001 = dato inválido; P0002 = no existe.
create or replace function privado.falla(p_mensaje text)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  raise exception '%', p_mensaje using errcode = 'P0001';
end;
$$;

create or replace function privado.no_existe(p_mensaje text)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  raise exception '%', p_mensaje using errcode = 'P0002';
end;
$$;

-- -----------------------------------------------------------------------------
-- Historial: igual que el servidor local (server/servicio.ts).
-- Reasignaciones y subtareas las registran las funciones de la API (con
-- nombres, no ids); los triggers de esas tablas se quitan.
-- La "pista" (devuelta / movida_cuadrante) puede venir del encabezado o de la
-- función que hace el cambio (co.pista).
-- -----------------------------------------------------------------------------
drop trigger if exists z_historial on public.tarea_responsables;
drop trigger if exists z_historial on public.subtareas;

create or replace function privado.tareas_registrar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := privado.persona_actual();
  v_pista text := coalesce(
    nullif(current_setting('co.pista', true), ''),
    privado.encabezado('x-co-accion')
  );
  v_ignorar constant text[] := array[
    'id', 'created_at', 'updated_at', 'creada_por', 'actualizada_por',
    'estado_anterior', 'eliminada_por', 'terminada_at', 'entregada_at'
  ];
  v_cambios jsonb;
  v_accion text;
begin
  if tg_op = 'INSERT' then
    insert into public.eventos (tarea_id, proyecto_id, persona_id, accion, cambios)
    values (
      new.id, new.proyecto_id, new.creada_por, 'creada',
      jsonb_build_object('despues', to_jsonb(new) - v_ignorar)
    );
    return null;
  end if;

  if tg_op = 'DELETE' then
    insert into public.eventos (tarea_id, proyecto_id, persona_id, accion, cambios)
    values (
      null, old.proyecto_id, v_persona, 'borrada_definitiva',
      jsonb_build_object('tarea_id', old.id, 'titulo', old.titulo)
    );
    return null;
  end if;

  v_cambios := privado.diferencias(to_jsonb(old), to_jsonb(new), v_ignorar);
  if v_cambios = '{}'::jsonb then
    return null;
  end if;

  v_accion := case
    when old.eliminada_at is null and new.eliminada_at is not null then 'eliminada'
    when old.eliminada_at is not null and new.eliminada_at is null then 'restaurada'
    when new.estado is distinct from old.estado and v_pista = 'devuelta' then 'devuelta'
    when new.estado is distinct from old.estado then 'estado'
    when v_pista = 'movida_cuadrante' then 'movida_cuadrante'
    else 'editada'
  end;

  insert into public.eventos (tarea_id, proyecto_id, persona_id, accion, cambios)
  values (
    new.id, new.proyecto_id, coalesce(v_persona, new.actualizada_por), v_accion,
    v_cambios || jsonb_build_object('titulo', new.titulo)
  );
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tiempo real: cada cambio manda un aviso al canal público "co-cambios" (solo
-- dice QUÉ cambió, sin datos). Las pantallas vuelven a pedir lo que muestran.
-- Mismo formato que el canal del servidor local: { recursos: [...] }.
-- -----------------------------------------------------------------------------
create or replace function privado.avisar_cambio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('recursos', jsonb_build_array(tg_argv[0])),
    'cambio',
    'co-cambios',
    false
  );
  return null;
end;
$$;

create trigger zz_aviso after insert or update or delete on public.tareas
  for each statement execute function privado.avisar_cambio('tareas');
create trigger zz_aviso after insert or update or delete on public.subtareas
  for each statement execute function privado.avisar_cambio('tareas');
create trigger zz_aviso after insert or update or delete on public.tarea_responsables
  for each statement execute function privado.avisar_cambio('tareas');
create trigger zz_aviso after insert or update or delete on public.clientes
  for each statement execute function privado.avisar_cambio('tareas');
create trigger zz_aviso after insert or update or delete on public.personas
  for each statement execute function privado.avisar_cambio('personas');
create trigger zz_aviso after insert or update or delete on public.configuracion
  for each statement execute function privado.avisar_cambio('configuracion');

-- -----------------------------------------------------------------------------
-- Papelera: lo que pasó el plazo (configuracion.papelera_dias, 30 por defecto)
-- se borra para siempre. Se ejecuta al leer la matriz o la papelera.
-- -----------------------------------------------------------------------------
create or replace function privado.dias_papelera()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  select c.valor into v from public.configuracion c where c.clave = 'papelera_dias';
  if jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric >= 1 then
    return floor((v #>> '{}')::numeric)::integer;
  end if;
  return 30;
end;
$$;

create or replace function privado.purgar_papelera()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.tareas t
  where t.eliminada_at is not null
    and t.eliminada_at < now() - make_interval(days => privado.dias_papelera());
$$;

revoke execute on all functions in schema privado from public, anon, authenticated;
grant execute on function privado.es_cuenta_local() to authenticated;
grant execute on function privado.encabezado(text) to authenticated;
grant execute on function privado.persona_actual() to authenticated;
grant execute on function privado.diferencias(jsonb, jsonb, text[]) to authenticated;
