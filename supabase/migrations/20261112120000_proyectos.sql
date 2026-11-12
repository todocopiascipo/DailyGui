-- Fase 8: proyectos internos (decisión 11). Equivalente a la migración local
-- server/migraciones/0004_proyectos.sql y a las reglas de server/servicio.ts.

alter table public.tareas add column orden_proyecto integer not null default 0;
create index tareas_proyecto_orden_idx on public.tareas (proyecto_id, orden_proyecto)
  where proyecto_id is not null;

-- Tiempo real: los cambios en proyectos también avisan.
create trigger zz_aviso after insert or update or delete on public.proyectos
  for each statement execute function privado.avisar_cambio('proyectos');

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
    'estado_anterior', 'eliminada_por', 'terminada_at', 'entregada_at', 'orden_proyecto'
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

create or replace function privado.campos_tarea(o jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  c jsonb := '{}'::jsonb;
  u jsonb;
begin
  if jsonb_typeof(o) is distinct from 'object' then
    perform privado.falla('Cambios: formato inválido');
  end if;
  if o ? 'titulo' then
    c := c || jsonb_build_object('titulo', privado.v_texto(o -> 'titulo', 'Título', 200));
  end if;
  if o ? 'descripcion' then
    c := c || jsonb_build_object('descripcion',
      privado.v_texto_opcional(o -> 'descripcion', 'Descripción', 2000));
  end if;
  if o ? 'tipo' then
    c := c || jsonb_build_object('tipo', privado.v_opcion(o -> 'tipo', array['pedido', 'interna'], 'Tipo'));
  end if;
  if o ? 'categoria_id' then
    c := c || jsonb_build_object('categoria_id', privado.v_id_opcional(o -> 'categoria_id', 'Categoría'));
  end if;
  if o ? 'pedido_id' then
    c := c || jsonb_build_object('pedido_id',
      privado.v_id_opcional(o -> 'pedido_id', 'Pedido relacionado'));
  end if;
  if o ? 'proyecto_id' then
    c := c || jsonb_build_object('proyecto_id',
      privado.v_id_opcional(o -> 'proyecto_id', 'Proyecto'));
  end if;
  if o ? 'sena' then
    c := c || jsonb_build_object('sena', privado.v_importe(o -> 'sena', 'Seña'));
  end if;
  if o ? 'saldo' then
    c := c || jsonb_build_object('saldo', privado.v_importe(o -> 'saldo', 'Saldo'));
  end if;
  if o ? 'sena_medio' then
    c := c || jsonb_build_object('sena_medio',
      privado.v_medio(o -> 'sena_medio', 'Medio de pago de la seña'));
  end if;
  if o ? 'saldo_medio' then
    c := c || jsonb_build_object('saldo_medio',
      privado.v_medio(o -> 'saldo_medio', 'Medio de pago del saldo'));
  end if;
  if o ? 'importante' then
    c := c || jsonb_build_object('importante', privado.v_booleano(o -> 'importante', 'Importante'));
  end if;
  if o ? 'urgencia_manual' then
    u := o -> 'urgencia_manual';
    if jsonb_typeof(u) <> 'null' and not (
      jsonb_typeof(u) = 'number' and (u #>> '{}') ~ '^[1-5]$'
    ) then
      perform privado.falla('Urgencia: tiene que ser de 1 a 5');
    end if;
    c := c || jsonb_build_object('urgencia_manual', u);
  end if;
  if o ? 'estado' then
    c := c || jsonb_build_object('estado', privado.v_opcion(o -> 'estado',
      array['pendiente', 'en_proceso', 'en_espera', 'terminada', 'entregada', 'cancelada'], 'Estado'));
  end if;
  if o ? 'motivo_espera' then
    c := c || jsonb_build_object('motivo_espera', case
      when jsonb_typeof(o -> 'motivo_espera') = 'null' then null
      else privado.v_opcion(o -> 'motivo_espera',
        array['archivo_cliente', 'material', 'pago', 'proveedor', 'otro'], 'Motivo de espera')
    end);
  end if;
  if o ? 'motivo_espera_detalle' then
    c := c || jsonb_build_object('motivo_espera_detalle',
      privado.v_texto_opcional(o -> 'motivo_espera_detalle', 'Detalle del motivo', 200));
  end if;
  if o ? 'fecha_inicio' then
    c := c || jsonb_build_object('fecha_inicio', privado.v_fecha(o -> 'fecha_inicio', 'Hora de inicio'));
  end if;
  if o ? 'fecha_entrega' then
    c := c || jsonb_build_object('fecha_entrega', privado.v_fecha(o -> 'fecha_entrega', 'Entrega'));
  end if;
  if o ? 'mostrar_en_matriz' then
    c := c || jsonb_build_object('mostrar_en_matriz',
      privado.v_booleano(o -> 'mostrar_en_matriz', 'Mostrar'));
  end if;

  -- Fuera de "en espera" no hay motivo.
  if c ? 'estado' and c ->> 'estado' <> 'en_espera' then
    c := c || '{"motivo_espera": null, "motivo_espera_detalle": null}'::jsonb;
  end if;
  if c ->> 'estado' = 'en_espera' and not (c ? 'motivo_espera') then
    perform privado.falla('Elegí el motivo de la espera');
  end if;
  return c;
end;
$$;
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
    'proyecto', (
      select jsonb_build_object('id', y.id, 'nombre', y.nombre)
      from public.proyectos y where y.id = t.proyecto_id
    ),
    'mostrar_en_matriz', t.mostrar_en_matriz,
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
create or replace function public.co_catalogos()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  return jsonb_build_object(
    'personas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nombre', p.nombre, 'iniciales', p.iniciales, 'tiene_pin', p.tiene_pin
      ) order by u.ultima desc nulls last, p.orden, p.nombre)
      from public.personas p
      left join lateral (
        select max(r.created_at) as ultima from public.tarea_responsables r
        where r.persona_id = p.id
      ) u on true
      where p.activa
    ), '[]'::jsonb),
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'nombre', c.nombre, 'tipo_aplica', c.tipo_aplica
      ) order by c.orden, c.nombre)
      from public.categorias c where c.activa
    ), '[]'::jsonb),
    'proyectos', coalesce((
      select jsonb_agg(jsonb_build_object('id', y.id, 'nombre', y.nombre)
             order by y.orden, y.nombre)
      from public.proyectos y where y.estado in ('activo', 'en_pausa')
    ), '[]'::jsonb)
  );
end;
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
    'proyecto', (
      select jsonb_build_object('id', y.id, 'nombre', y.nombre)
      from public.proyectos y where y.id = t.proyecto_id
    ),
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

-- Proyecto de una tarea: solo internas y tiene que existir. Al entrar a un
-- proyecto va al final de su lista. "Mostrar en la matriz": sola cuando tiene
-- fecha de entrega o está en proceso; el interruptor (p_explicito) manda.
create or replace function privado.controlar_proyecto(
  p_ant public.tareas, t public.tareas, p_explicito boolean
)
returns public.tareas language plpgsql stable security definer set search_path = '' as $$
declare
  v_pide_ant boolean := p_ant.id is not null
    and (p_ant.fecha_entrega is not null or p_ant.estado = 'en_proceso');
  v_pide boolean := t.fecha_entrega is not null or t.estado = 'en_proceso';
begin
  if t.proyecto_id is null then
    t.orden_proyecto := 0;
    t.mostrar_en_matriz := true;
    return t;
  end if;
  if t.tipo <> 'interna' then
    perform privado.falla('Solo las tareas internas van en proyectos');
  end if;
  if not exists (select 1 from public.proyectos y where y.id = t.proyecto_id) then
    perform privado.falla('El proyecto no existe');
  end if;
  if p_ant.proyecto_id is distinct from t.proyecto_id then
    t.orden_proyecto := (
      select coalesce(max(x.orden_proyecto), -1) + 1 from public.tareas x
      where x.proyecto_id = t.proyecto_id
    );
  end if;
  if p_explicito then
    return t;
  end if;
  if p_ant.id is null or p_ant.proyecto_id is distinct from t.proyecto_id then
    t.mostrar_en_matriz := v_pide;
  elsif v_pide and not v_pide_ant then
    t.mostrar_en_matriz := true;
  end if;
  return t;
end;
$$;

create or replace function public.co_crear_tarea(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := p -> 'tarea';
  c jsonb;
  v_id uuid;
  v_cliente uuid;
  v_t public.tareas;
  s jsonb;
  v_orden integer := 0;
  v_resp uuid[];
begin
  perform privado.exigir_acceso();
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Pedido: formato inválido');
  end if;
  if jsonb_typeof(o) is distinct from 'object' then
    perform privado.falla('Tarea: formato inválido');
  end if;
  if not o ? 'titulo' then
    perform privado.falla('Título: no puede quedar vacío');
  end if;
  if not o ? 'importante' then
    perform privado.falla('Elegí si es importante');
  end if;
  c := privado.campos_tarea(o);
  v_id := case when o ? 'id' then privado.v_id(o -> 'id', 'Tarea') else gen_random_uuid() end;
  v_resp := privado.ids_responsables(coalesce(p -> 'responsables', '[]'::jsonb));
  if p ? 'subtareas' and (jsonb_typeof(p -> 'subtareas') <> 'array'
                          or jsonb_array_length(p -> 'subtareas') > 50) then
    perform privado.falla('Subtareas: formato inválido');
  end if;

  if jsonb_typeof(p -> 'cliente') = 'object' then
    if c ->> 'tipo' = 'interna' then
      perform privado.falla('Las tareas internas no tienen cliente');
    end if;
    v_cliente := privado.guardar_cliente(p -> 'cliente');
  end if;

  v_t := jsonb_populate_record(
    null::public.tareas,
    jsonb_build_object(
      'id', v_id, 'tipo', 'pedido', 'sena', 0, 'saldo', 0, 'estado', 'pendiente',
      'mostrar_en_matriz', true, 'created_at', now(), 'updated_at', now()
    ) || c || jsonb_build_object('cliente_id', v_cliente)
  );
  perform privado.controlar_pedido(v_t);
  v_t := privado.controlar_proyecto(null, v_t, o ? 'mostrar_en_matriz');

  begin
    insert into public.tareas select v_t.*;
    insert into public.tarea_responsables (tarea_id, persona_id)
    select v_id, unnest(v_resp) on conflict do nothing;
    for s in select * from jsonb_array_elements(coalesce(p -> 'subtareas', '[]'::jsonb)) loop
      if jsonb_typeof(s) <> 'object' then
        perform privado.falla('Subtarea: formato inválido');
      end if;
      insert into public.subtareas (tarea_id, titulo, responsable_id, orden)
      values (
        v_id,
        privado.v_texto(s -> 'titulo', 'Subtarea', 200),
        privado.v_id_opcional(s -> 'responsable_id', 'Responsable de la subtarea'),
        v_orden
      );
      v_orden := v_orden + 1;
    end loop;
  exception
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      perform privado.falla('Datos inválidos');
  end;
  return public.co_detalle(v_id);
end;
$$;
create or replace function public.co_editar_tarea(p_id uuid, p jsonb, p_pista text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ant public.tareas;
  v_nueva public.tareas;
  c jsonb;
begin
  perform privado.exigir_acceso();
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Pedido: formato inválido');
  end if;
  select * into v_ant from public.tareas where id = p_id for update;
  if not found then
    perform privado.no_existe('La tarea no existe');
  end if;
  c := privado.campos_tarea(coalesce(p -> 'cambios', '{}'::jsonb));
  -- Un pedido no tiene "pedido relacionado"; una interna no tiene cliente.
  if c ->> 'tipo' = 'pedido' then
    c := c || '{"pedido_id": null, "proyecto_id": null}'::jsonb;
  end if;
  if c ->> 'tipo' = 'interna' then
    c := c || '{"cliente_id": null}'::jsonb;
  elsif p ? 'cliente' then
    c := c || jsonb_build_object('cliente_id', case
      when jsonb_typeof(p -> 'cliente') = 'object' then privado.guardar_cliente(p -> 'cliente')
      else null
    end);
  end if;
  v_nueva := jsonb_populate_record(v_ant, c);
  perform privado.controlar_pedido(v_nueva);
  v_nueva := privado.controlar_proyecto(
    v_ant, v_nueva, coalesce(p -> 'cambios', '{}'::jsonb) ? 'mostrar_en_matriz'
  );
  if p_pista in ('movida_cuadrante', 'devuelta') then
    perform set_config('co.pista', p_pista, true);
  end if;

  begin
    update public.tareas set
      tipo = v_nueva.tipo, titulo = v_nueva.titulo, descripcion = v_nueva.descripcion,
      categoria_id = v_nueva.categoria_id, pedido_id = v_nueva.pedido_id,
      cliente_id = v_nueva.cliente_id, sena = v_nueva.sena, saldo = v_nueva.saldo,
      sena_medio = v_nueva.sena_medio, saldo_medio = v_nueva.saldo_medio,
      importante = v_nueva.importante, urgencia_manual = v_nueva.urgencia_manual,
      estado = v_nueva.estado, motivo_espera = v_nueva.motivo_espera,
      motivo_espera_detalle = v_nueva.motivo_espera_detalle,
      fecha_inicio = v_nueva.fecha_inicio, fecha_entrega = v_nueva.fecha_entrega,
      mostrar_en_matriz = v_nueva.mostrar_en_matriz,
      proyecto_id = v_nueva.proyecto_id, orden_proyecto = v_nueva.orden_proyecto
    where id = p_id;
    if p ? 'responsables' then
      perform privado.reasignar(p_id, privado.ids_responsables(p -> 'responsables'));
    end if;
  exception
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      perform privado.falla('Datos inválidos');
  end;
  perform set_config('co.pista', '', true);
  return public.co_detalle(p_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Proyectos: lectura (resumen con avance, lista, detalle con tareas e historial)
-- -----------------------------------------------------------------------------
create or replace function privado.proyecto_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', y.id, 'nombre', y.nombre, 'descripcion', y.descripcion, 'estado', y.estado,
    'fecha_inicio', y.fecha_inicio, 'fecha_objetivo', y.fecha_objetivo,
    'categoria_id', y.categoria_id,
    'responsable', (
      select jsonb_build_object('id', pe.id, 'nombre', pe.nombre, 'iniciales', pe.iniciales)
      from public.personas pe where pe.id = y.responsable_id
    ),
    'progreso', jsonb_build_object(
      'total', (select count(*) from public.tareas t where t.proyecto_id = y.id
                and t.eliminada_at is null and t.estado <> 'cancelada'),
      'hechas', (select count(*) from public.tareas t where t.proyecto_id = y.id
                 and t.eliminada_at is null and t.estado in ('terminada', 'entregada'))
    )
  )
  from public.proyectos y where y.id = p_id;
$$;

create or replace function public.co_proyectos()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  return coalesce((
    select jsonb_agg(privado.proyecto_json(y.id)
      order by case y.estado when 'activo' then 0 when 'en_pausa' then 1
                             when 'terminado' then 2 else 3 end,
               y.fecha_objetivo nulls last, y.orden, y.nombre)
    from public.proyectos y
  ), '[]'::jsonb);
end;
$$;

create or replace function public.co_proyecto(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  if not exists (select 1 from public.proyectos y where y.id = p_id) then
    perform privado.no_existe('El proyecto no existe');
  end if;
  return jsonb_build_object(
    'proyecto', privado.proyecto_json(p_id),
    'tareas', coalesce((
      select jsonb_agg(privado.tarjeta(t) order by t.orden_proyecto, t.created_at)
      from public.tareas t where t.proyecto_id = p_id and t.eliminada_at is null
    ), '[]'::jsonb),
    'eventos', coalesce((
      select jsonb_agg(x order by orden_fecha desc, orden_id desc)
      from (
        select jsonb_build_object('id', e.id, 'accion', e.accion, 'persona', pe.nombre,
                                  'cambios', e.cambios, 'created_at', e.created_at) as x,
               e.created_at as orden_fecha, e.id as orden_id
        from public.eventos e left join public.personas pe on pe.id = e.persona_id
        where e.proyecto_id = p_id
        order by e.created_at desc
        limit 100
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Proyectos: alta, edición, borrado (solo sin tareas) y orden de sus tareas
-- -----------------------------------------------------------------------------
create or replace function privado.campos_proyecto(o jsonb, p_nuevo boolean)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  c jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(o) is distinct from 'object' then
    perform privado.falla('Proyecto: formato inválido');
  end if;
  if p_nuevo and not o ? 'nombre' then
    perform privado.falla('Nombre del proyecto: no puede quedar vacío');
  end if;
  if o ? 'nombre' then
    c := c || jsonb_build_object('nombre', privado.v_texto(o -> 'nombre', 'Nombre del proyecto', 120));
  end if;
  if o ? 'descripcion' then
    c := c || jsonb_build_object('descripcion',
      privado.v_texto_opcional(o -> 'descripcion', 'Descripción', 2000));
  end if;
  if o ? 'estado' then
    c := c || jsonb_build_object('estado', privado.v_opcion(o -> 'estado',
      array['activo', 'en_pausa', 'terminado', 'cancelado'], 'Estado'));
  end if;
  if o ? 'fecha_inicio' then
    c := c || jsonb_build_object('fecha_inicio', privado.v_fecha(o -> 'fecha_inicio', 'Inicio'));
  end if;
  if o ? 'fecha_objetivo' then
    c := c || jsonb_build_object('fecha_objetivo',
      privado.v_fecha(o -> 'fecha_objetivo', 'Fecha objetivo'));
  end if;
  if o ? 'responsable_id' then
    c := c || jsonb_build_object('responsable_id',
      privado.v_id_opcional(o -> 'responsable_id', 'Responsable'));
  end if;
  if o ? 'categoria_id' then
    c := c || jsonb_build_object('categoria_id',
      privado.v_id_opcional(o -> 'categoria_id', 'Categoría'));
  end if;
  return c;
end;
$$;

create or replace function public.co_crear_proyecto(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c jsonb;
  v public.proyectos;
begin
  perform privado.exigir_acceso();
  c := privado.campos_proyecto(p, true);
  v := jsonb_populate_record(null::public.proyectos, jsonb_build_object(
    'id', case when p ? 'id' then privado.v_id(p -> 'id', 'Proyecto') else gen_random_uuid() end,
    'estado', 'activo',
    'orden', (select coalesce(max(y.orden), 0) + 10 from public.proyectos y),
    'created_at', now(), 'updated_at', now()
  ) || c);
  if v.fecha_inicio is not null and v.fecha_objetivo is not null
     and v.fecha_objetivo < v.fecha_inicio then
    perform privado.falla('La fecha objetivo no puede ser anterior al inicio');
  end if;
  begin
    insert into public.proyectos select v.*;
  exception
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      perform privado.falla('Datos inválidos');
  end;
  return public.co_proyecto(v.id);
end;
$$;

create or replace function public.co_editar_proyecto(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.proyectos;
begin
  perform privado.exigir_acceso();
  select * into v from public.proyectos where id = p_id for update;
  if not found then
    perform privado.no_existe('El proyecto no existe');
  end if;
  v := jsonb_populate_record(v, privado.campos_proyecto(p, false));
  if v.fecha_inicio is not null and v.fecha_objetivo is not null
     and v.fecha_objetivo < v.fecha_inicio then
    perform privado.falla('La fecha objetivo no puede ser anterior al inicio');
  end if;
  begin
    update public.proyectos set
      nombre = v.nombre, descripcion = v.descripcion, estado = v.estado,
      fecha_inicio = v.fecha_inicio, fecha_objetivo = v.fecha_objetivo,
      responsable_id = v.responsable_id, categoria_id = v.categoria_id
    where id = p_id;
  exception
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      perform privado.falla('Datos inválidos');
  end;
  return public.co_proyecto(p_id);
end;
$$;

create or replace function public.co_borrar_proyecto(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  if not exists (select 1 from public.proyectos y where y.id = p_id) then
    perform privado.no_existe('El proyecto no existe');
  end if;
  if exists (select 1 from public.tareas t where t.proyecto_id = p_id and t.eliminada_at is null) then
    perform privado.falla('El proyecto tiene tareas: cancelalo o terminalo en vez de borrarlo');
  end if;
  delete from public.proyectos where id = p_id;
  return '{"ok": true}'::jsonb;
end;
$$;

create or replace function public.co_ordenar_proyecto(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
begin
  perform privado.exigir_acceso();
  if not exists (select 1 from public.proyectos y where y.id = p_id) then
    perform privado.no_existe('El proyecto no existe');
  end if;
  if jsonb_typeof(p -> 'tareas') is distinct from 'array'
     or jsonb_array_length(p -> 'tareas') > 500 then
    perform privado.falla('Orden: formato inválido');
  end if;
  select coalesce(array_agg(privado.v_id(x, 'Tarea') order by i), '{}')
    into v_ids from jsonb_array_elements(p -> 'tareas') with ordinality as a(x, i);
  -- Solo las que cambian de lugar (una escritura sin cambios igual avisaría).
  update public.tareas t set orden_proyecto = n.i - 1
  from unnest(v_ids) with ordinality as n(id, i)
  where t.id = n.id and t.proyecto_id = p_id and t.orden_proyecto <> n.i - 1;
  return public.co_proyecto(p_id);
end;
$$;


-- Permisos: ayudantes privados cerrados; la API, para la app (exige la clave).
revoke execute on function privado.controlar_proyecto(public.tareas, public.tareas, boolean)
  from public, anon, authenticated;
revoke execute on function privado.proyecto_json(uuid) from public, anon, authenticated;
revoke execute on function privado.campos_proyecto(jsonb, boolean) from public, anon, authenticated;
do $do$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'co\_%proyecto%'
  loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end;
$do$;
