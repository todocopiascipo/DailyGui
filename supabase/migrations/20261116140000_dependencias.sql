-- Fase 14 (pedido del usuario): tareas encadenadas. Una tarea puede esperar
-- a otras de la misma orden de trabajo. Equivale a la migración local
-- 0006_dependencias.sql y a enlazarTareas/desenlazarTareas (server/servicio.ts).

create table public.tarea_dependencias (
  tarea_id uuid not null references public.tareas (id) on delete cascade,
  depende_de_id uuid not null references public.tareas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tarea_id, depende_de_id),
  check (tarea_id <> depende_de_id)
);
create index tarea_dependencias_depende_idx on public.tarea_dependencias (depende_de_id);
alter table public.tarea_dependencias enable row level security;
revoke all on public.tarea_dependencias from public, anon, authenticated;

create trigger zz_aviso after insert or update or delete on public.tarea_dependencias
  for each statement execute function privado.avisar_cambio('tareas');

-- De qué tareas depende una (sin las que están en la papelera).
create or replace function privado.dependencias_de(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'titulo', x.titulo, 'hecha', x.estado in ('terminada', 'entregada'))
           order by x.created_at), '[]'::jsonb)
  from public.tarea_dependencias d join public.tareas x on x.id = d.depende_de_id
  where d.tarea_id = p_id and x.eliminada_at is null;
$$;
revoke execute on function privado.dependencias_de(uuid) from public, anon, authenticated;

create or replace function privado.tarjeta(t public.tareas)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'tipo', t.tipo,
    'titulo', t.titulo,
    'importante', t.importante,
    'urgencia_manual', t.urgencia_manual,
    'estado', t.estado,
    'estado_anterior', t.estado_anterior,
    'motivo_espera', t.motivo_espera,
    'motivo_espera_detalle', t.motivo_espera_detalle,
    'fecha_entrega', t.fecha_entrega,
    'fecha_inicio', t.fecha_inicio,
    'terminada_at', t.terminada_at,
    'entregada_at', t.entregada_at,
    'saldo', t.saldo,
    'cliente', (
      select jsonb_build_object('nombre', c.nombre_apellido, 'telefono', c.telefono)
      from public.clientes c where c.id = t.cliente_id
    ),
    'pedido', (
      select jsonb_build_object('id', p.id, 'titulo', p.titulo)
      from public.tareas p where p.id = t.pedido_id
    ),
    'nivel_importancia', t.nivel_importancia,
    'nivel_urgencia', t.nivel_urgencia,
    'depende_de', privado.dependencias_de(t.id),
    'responsables', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', pe.id, 'nombre', pe.nombre, 'iniciales', pe.iniciales)
        order by pe.orden, pe.nombre
      )
      from public.tarea_responsables r join public.personas pe on pe.id = r.persona_id
      where r.tarea_id = t.id
    ), '[]'::jsonb),
    'subtareas', jsonb_build_object(
      'total', (select count(*) from public.subtareas s where s.tarea_id = t.id),
      'hechas', (select count(*) from public.subtareas s where s.tarea_id = t.id and s.hecha)
    )
  );
$$;
create or replace function public.co_detalle(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t public.tareas;
begin
  perform privado.exigir_acceso();
  select * into t from public.tareas where id = p_id;
  if not found then
    perform privado.no_existe('La tarea no existe');
  end if;
  return jsonb_build_object(
    'tarea', to_jsonb(t),
    'responsables', coalesce((
      select jsonb_agg(jsonb_build_object('id', pe.id, 'nombre', pe.nombre, 'iniciales', pe.iniciales)
             order by pe.orden, pe.nombre)
      from public.tarea_responsables r join public.personas pe on pe.id = r.persona_id
      where r.tarea_id = t.id
    ), '[]'::jsonb),
    'subtareas', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'titulo', s.titulo,
             'responsable_id', s.responsable_id, 'hecha', s.hecha, 'orden', s.orden)
             order by s.orden, s.created_at)
      from public.subtareas s where s.tarea_id = t.id
    ), '[]'::jsonb),
    'cliente', (
      select jsonb_build_object('id', c.id, 'nombre_apellido', c.nombre_apellido, 'telefono', c.telefono)
      from public.clientes c where c.id = t.cliente_id
    ),
    'creada_por', (
      select jsonb_build_object('id', pe.id, 'nombre', pe.nombre, 'iniciales', pe.iniciales)
      from public.personas pe where pe.id = t.creada_por
    ),
    'pedido', (
      select jsonb_build_object('id', p.id, 'titulo', p.titulo)
      from public.tareas p where p.id = t.pedido_id
    ),
    'depende_de', privado.dependencias_de(t.id),
    'eventos', coalesce((
      select jsonb_agg(x order by orden_fecha desc, orden_id desc)
      from (
        select jsonb_build_object('id', e.id, 'accion', e.accion, 'persona', pe.nombre,
                                  'cambios', e.cambios, 'created_at', e.created_at) as x,
               e.created_at as orden_fecha, e.id as orden_id
        from public.eventos e left join public.personas pe on pe.id = e.persona_id
        where e.tarea_id = t.id
        order by e.created_at desc
        limit 100
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function privado.nombres_dependencias(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.titulo order by x.titulo), '[]'::jsonb)
  from public.tarea_dependencias d join public.tareas x on x.id = d.depende_de_id
  where d.tarea_id = p_id;
$$;
revoke execute on function privado.nombres_dependencias(uuid) from public, anon, authenticated;

create or replace function privado.registrar_enlace(p_tarea public.tareas, p_antes jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_despues jsonb := privado.nombres_dependencias(p_tarea.id);
begin
  if v_despues = p_antes then
    return;
  end if;
  insert into public.eventos (tarea_id, proyecto_id, persona_id, accion, cambios)
  values (p_tarea.id, null, privado.persona_actual(), 'editada', jsonb_build_object(
    'espera_a', jsonb_build_object('antes', p_antes, 'despues', v_despues),
    'titulo', p_tarea.titulo));
end;
$$;
revoke execute on function privado.registrar_enlace(public.tareas, jsonb) from public, anon, authenticated;

-- POST /tareas/:id/dependencias  { depende_de_id }
create or replace function public.co_enlazar_tareas(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.tareas;
  d public.tareas;
  v_otra uuid;
  v_antes jsonb;
begin
  perform privado.exigir_acceso();
  if jsonb_typeof(p) is distinct from 'object' or not p ? 'depende_de_id' then
    perform privado.falla('Elegí la tarea de la que depende');
  end if;
  v_otra := privado.v_id(p -> 'depende_de_id', 'Tarea de la que depende');
  select * into t from public.tareas where id = p_id and eliminada_at is null;
  if not found then
    perform privado.no_existe('La tarea no existe');
  end if;
  select * into d from public.tareas where id = v_otra and eliminada_at is null;
  if not found then
    perform privado.no_existe('La tarea de la que depende no existe');
  end if;
  if t.id = d.id then
    perform privado.falla('Una tarea no puede esperarse a sí misma');
  end if;
  if t.tipo <> 'interna' or d.tipo <> 'interna' or t.pedido_id is null
     or t.pedido_id is distinct from d.pedido_id then
    perform privado.falla('Solo se encadenan tareas de la misma orden de trabajo');
  end if;
  -- Sin círculos: d no puede depender (ni indirectamente) de t.
  if exists (
    with recursive cadena(id) as (
      select d.id
      union
      select x.depende_de_id from public.tarea_dependencias x join cadena c on x.tarea_id = c.id
    )
    select 1 from cadena where id = t.id
  ) then
    perform privado.falla('"' || d.titulo || '" ya espera a "' || t.titulo || '": no se puede armar un círculo');
  end if;
  v_antes := privado.nombres_dependencias(t.id);
  insert into public.tarea_dependencias (tarea_id, depende_de_id) values (t.id, d.id)
  on conflict do nothing;
  perform privado.registrar_enlace(t, v_antes);
  return public.co_detalle(t.id);
end;
$$;

-- DELETE /tareas/:id/dependencias/:otra
create or replace function public.co_desenlazar_tareas(p_id uuid, p_otra uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.tareas;
  v_antes jsonb;
begin
  perform privado.exigir_acceso();
  select * into t from public.tareas where id = p_id;
  if not found then
    perform privado.no_existe('La tarea no existe');
  end if;
  v_antes := privado.nombres_dependencias(t.id);
  -- Solo si existe el enlace (un borrado vacío igual avisaría por tiempo real).
  if exists (select 1 from public.tarea_dependencias where tarea_id = t.id and depende_de_id = p_otra) then
    delete from public.tarea_dependencias where tarea_id = t.id and depende_de_id = p_otra;
  end if;
  perform privado.registrar_enlace(t, v_antes);
  return public.co_detalle(t.id);
end;
$$;

revoke execute on function public.co_enlazar_tareas(uuid, jsonb) from public;
revoke execute on function public.co_desenlazar_tareas(uuid, uuid) from public;
grant execute on function public.co_enlazar_tareas(uuid, jsonb) to anon, authenticated;
grant execute on function public.co_desenlazar_tareas(uuid, uuid) to anon, authenticated;
