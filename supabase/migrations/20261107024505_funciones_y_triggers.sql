-- =============================================================================
-- Fase 1 · Funciones internas, reglas automáticas e historial
--
-- Autoría: el frontend manda la persona activa ("¿Quién soy?") en el encabezado
-- HTTP `x-persona-id`. Los triggers lo leen y lo registran en `eventos`.
-- Opcionalmente manda `x-co-accion` (movida_cuadrante | devuelta) para que el
-- historial distinga esas acciones de una edición común.
--
-- El historial se escribe SOLO acá (una sola vía, consistente).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function privado.es_cuenta_local()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from privado.cuentas_local c where c.user_id = (select auth.uid())
  );
$$;

create or replace function privado.encabezado(p_nombre text)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.headers', true), '')::json ->> p_nombre;
$$;

create or replace function privado.persona_actual()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_texto text := privado.encabezado('x-persona-id');
  v_id uuid;
begin
  if v_texto is null
     or v_texto !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  select p.id into v_id from public.personas p where p.id = v_texto::uuid;
  return v_id;
end;
$$;

-- Diferencia entre dos filas (como jsonb), ignorando las claves indicadas.
-- Devuelve { campo: { antes, despues } } solo con lo que cambió.
create or replace function privado.diferencias(p_antes jsonb, p_despues jsonb, p_ignorar text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(k, jsonb_build_object('antes', p_antes -> k, 'despues', p_despues -> k)),
    '{}'::jsonb
  )
  from jsonb_object_keys(p_despues) as k
  where not (k = any (p_ignorar))
    and (p_antes -> k) is distinct from (p_despues -> k);
$$;

create or replace function privado.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- tareas: reglas automáticas antes de guardar
--  - autoría (creada_por, actualizada_por, eliminada_por)
--  - estado_anterior para "Devolver al estado anterior"
--  - terminada_at / entregada_at según el estado
-- -----------------------------------------------------------------------------
create or replace function privado.tareas_antes_de_guardar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_persona uuid := privado.persona_actual();
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.creada_por := coalesce(v_persona, new.creada_por);
    new.actualizada_por := new.creada_por;
    new.estado_anterior := null;
    new.eliminada_at := null;
    new.eliminada_por := null;
  else
    new.created_at := old.created_at;
    new.creada_por := old.creada_por;
    if v_persona is not null then
      new.actualizada_por := v_persona;
    end if;
    if new.estado is distinct from old.estado then
      new.estado_anterior := old.estado;
    end if;
    if new.eliminada_at is not null and old.eliminada_at is null then
      new.eliminada_por := coalesce(v_persona, new.actualizada_por);
    elsif new.eliminada_at is null then
      new.eliminada_por := null;
    end if;
  end if;

  if new.estado in ('terminada', 'entregada') then
    new.terminada_at := coalesce(new.terminada_at, now());
  else
    new.terminada_at := null;
  end if;

  if new.estado = 'entregada' then
    new.entregada_at := coalesce(new.entregada_at, now());
  else
    new.entregada_at := null;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- tareas: historial
-- -----------------------------------------------------------------------------
create or replace function privado.tareas_registrar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := privado.persona_actual();
  v_pista text := privado.encabezado('x-co-accion');
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
    -- Borrado definitivo desde la papelera: la tarea ya no existe.
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
-- tarea_responsables: historial de reasignaciones
-- Se omite cuando la tarea se creó en la misma transacción (alta en un paso):
-- ese alta ya queda registrada como "creada".
-- -----------------------------------------------------------------------------
create or replace function privado.responsables_registrar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tarea_id uuid := coalesce(new.tarea_id, old.tarea_id);
  v_tarea public.tareas;
begin
  select * into v_tarea from public.tareas t where t.id = v_tarea_id;
  if not found or v_tarea.created_at = now() then
    return null;
  end if;

  insert into public.eventos (tarea_id, proyecto_id, persona_id, accion, cambios)
  values (
    v_tarea.id, v_tarea.proyecto_id, privado.persona_actual(), 'reasignada',
    case when tg_op = 'INSERT'
      then jsonb_build_object('agregado', new.persona_id, 'titulo', v_tarea.titulo)
      else jsonb_build_object('quitado', old.persona_id, 'titulo', v_tarea.titulo)
    end
  );
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- subtareas
-- -----------------------------------------------------------------------------
create or replace function privado.subtareas_antes_de_guardar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.hecha then
    new.hecha_at := case
      when tg_op = 'UPDATE' and old.hecha then coalesce(old.hecha_at, now())
      else now()
    end;
  else
    new.hecha_at := null;
  end if;
  return new;
end;
$$;

-- El responsable de una subtarea se suma automáticamente a los de la tarea.
create or replace function privado.subtareas_sumar_responsable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.responsable_id is not null then
    insert into public.tarea_responsables (tarea_id, persona_id)
    values (new.tarea_id, new.responsable_id)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create or replace function privado.subtareas_registrar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tarea_id uuid := coalesce(new.tarea_id, old.tarea_id);
  v_tarea public.tareas;
  v_cambios jsonb;
  v_accion text;
begin
  select * into v_tarea from public.tareas t where t.id = v_tarea_id;
  if not found then
    return null; -- la tarea se está borrando: alcanza con su propio evento
  end if;

  if tg_op = 'INSERT' then
    if v_tarea.created_at = now() then
      return null; -- alta junto con la tarea
    end if;
    v_accion := 'subtarea_creada';
    v_cambios := jsonb_build_object('subtarea', new.titulo);
  elsif tg_op = 'DELETE' then
    v_accion := 'subtarea_eliminada';
    v_cambios := jsonb_build_object('subtarea', old.titulo);
  elsif new.hecha is distinct from old.hecha then
    v_accion := case when new.hecha then 'subtarea_hecha' else 'subtarea_deshecha' end;
    v_cambios := jsonb_build_object('subtarea', new.titulo);
  else
    v_cambios := privado.diferencias(
      to_jsonb(old), to_jsonb(new),
      array['id', 'tarea_id', 'created_at', 'updated_at', 'hecha_at', 'orden']
    );
    if v_cambios = '{}'::jsonb then
      return null; -- por ejemplo, solo se reordenó
    end if;
    v_accion := 'subtarea_editada';
    v_cambios := v_cambios || jsonb_build_object('subtarea', new.titulo);
  end if;

  insert into public.eventos (tarea_id, proyecto_id, persona_id, accion, cambios)
  values (
    v_tarea.id, v_tarea.proyecto_id, privado.persona_actual(), v_accion,
    v_cambios || jsonb_build_object('titulo', v_tarea.titulo)
  );
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- proyectos: historial
-- -----------------------------------------------------------------------------
create or replace function privado.proyectos_registrar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := privado.persona_actual();
  v_cambios jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.eventos (proyecto_id, persona_id, accion, cambios)
    values (new.id, v_persona, 'proyecto_creado', jsonb_build_object('nombre', new.nombre));
  elsif tg_op = 'DELETE' then
    insert into public.eventos (proyecto_id, persona_id, accion, cambios)
    values (null, v_persona, 'proyecto_eliminado',
            jsonb_build_object('proyecto_id', old.id, 'nombre', old.nombre));
  else
    v_cambios := privado.diferencias(
      to_jsonb(old), to_jsonb(new), array['id', 'created_at', 'updated_at', 'orden']
    );
    if v_cambios <> '{}'::jsonb then
      insert into public.eventos (proyecto_id, persona_id, accion, cambios)
      values (
        new.id, v_persona,
        case when new.estado is distinct from old.estado
          then 'proyecto_estado' else 'proyecto_editado' end,
        v_cambios || jsonb_build_object('nombre', new.nombre)
      );
    end if;
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
-- updated_at en todas las tablas
create trigger a_updated_at before update on public.personas
  for each row execute function privado.set_updated_at();
create trigger a_updated_at before update on privado.personas_pin
  for each row execute function privado.set_updated_at();
create trigger a_updated_at before update on public.clientes
  for each row execute function privado.set_updated_at();
create trigger a_updated_at before update on public.categorias
  for each row execute function privado.set_updated_at();
create trigger a_updated_at before update on public.proyectos
  for each row execute function privado.set_updated_at();
create trigger a_updated_at before update on public.tareas
  for each row execute function privado.set_updated_at();
create trigger a_updated_at before update on public.tarea_responsables
  for each row execute function privado.set_updated_at();
create trigger a_updated_at before update on public.subtareas
  for each row execute function privado.set_updated_at();
create trigger a_updated_at before update on public.eventos
  for each row execute function privado.set_updated_at();
create trigger a_updated_at before update on public.configuracion
  for each row execute function privado.set_updated_at();

-- reglas automáticas
create trigger b_reglas before insert or update on public.tareas
  for each row execute function privado.tareas_antes_de_guardar();
create trigger b_reglas before insert or update on public.subtareas
  for each row execute function privado.subtareas_antes_de_guardar();
create trigger c_sumar_responsable after insert or update of responsable_id on public.subtareas
  for each row execute function privado.subtareas_sumar_responsable();

-- historial
create trigger z_historial after insert or update or delete on public.tareas
  for each row execute function privado.tareas_registrar_evento();
create trigger z_historial after insert or delete on public.tarea_responsables
  for each row execute function privado.responsables_registrar_evento();
create trigger z_historial after insert or update or delete on public.subtareas
  for each row execute function privado.subtareas_registrar_evento();
create trigger z_historial after insert or update or delete on public.proyectos
  for each row execute function privado.proyectos_registrar_evento();
