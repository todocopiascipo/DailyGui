-- =============================================================================
-- Migración a Supabase · Funciones de la API
--
-- Equivalen, una por una, a las rutas del servidor local (server/app.ts) y
-- devuelven los mismos datos (mismo formato JSON), con la misma validación
-- (server/validar.ts) y las mismas reglas (server/servicio.ts). Así la app
-- publicada y la de desarrollo se comportan igual.
-- Todas exigen acceso (privado.exigir_acceso) y corren con los permisos del
-- dueño: el navegador no toca las tablas directamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Validación (mismos mensajes que server/validar.ts)
-- -----------------------------------------------------------------------------
create or replace function privado.v_texto(v jsonb, p_nombre text, p_max integer)
returns text language plpgsql immutable set search_path = '' as $$
declare
  t text;
begin
  if jsonb_typeof(v) is distinct from 'string' then
    perform privado.falla(p_nombre || ': tiene que ser texto');
  end if;
  t := btrim(v #>> '{}');
  if t = '' then
    perform privado.falla(p_nombre || ': no puede quedar vacío');
  end if;
  if length(t) > p_max then
    perform privado.falla(p_nombre || ': máximo ' || p_max || ' caracteres');
  end if;
  return t;
end;
$$;

create or replace function privado.v_texto_opcional(v jsonb, p_nombre text, p_max integer)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if v is null or jsonb_typeof(v) = 'null'
     or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '') then
    return null;
  end if;
  return privado.v_texto(v, p_nombre, p_max);
end;
$$;

create or replace function privado.v_id(v jsonb, p_nombre text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(v) is distinct from 'string'
     or (v #>> '{}') !~* '^[0-9a-f-]{36}$' then
    perform privado.falla(p_nombre || ': identificador inválido');
  end if;
  begin
    return (v #>> '{}')::uuid;
  exception when others then
    perform privado.falla(p_nombre || ': identificador inválido');
  end;
end;
$$;

create or replace function privado.v_id_opcional(v jsonb, p_nombre text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  if v is null or jsonb_typeof(v) = 'null' or v = '""'::jsonb then
    return null;
  end if;
  return privado.v_id(v, p_nombre);
end;
$$;

create or replace function privado.v_importe(v jsonb, p_nombre text)
returns numeric language plpgsql immutable set search_path = '' as $$
declare
  n numeric;
begin
  begin
    if jsonb_typeof(v) = 'number' then
      n := (v #>> '{}')::numeric;
    elsif jsonb_typeof(v) = 'string' and btrim(v #>> '{}') <> '' then
      n := btrim(v #>> '{}')::numeric;
    end if;
  exception when others then
    n := null;
  end;
  if n is null or n < 0 or n > 1000000000 then
    perform privado.falla(p_nombre || ': tiene que ser un número igual o mayor que 0');
  end if;
  return round(n, 2);
end;
$$;

create or replace function privado.v_fecha(v jsonb, p_nombre text)
returns timestamptz language plpgsql stable set search_path = '' as $$
begin
  if v is null or jsonb_typeof(v) = 'null' or v = '""'::jsonb then
    return null;
  end if;
  if jsonb_typeof(v) <> 'string' then
    perform privado.falla(p_nombre || ': fecha inválida');
  end if;
  begin
    return (v #>> '{}')::timestamptz;
  exception when others then
    perform privado.falla(p_nombre || ': fecha inválida');
  end;
end;
$$;

create or replace function privado.v_opcion(v jsonb, p_opciones text[], p_nombre text)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(v) is distinct from 'string' or not ((v #>> '{}') = any (p_opciones)) then
    perform privado.falla(p_nombre || ': valor no permitido');
  end if;
  return v #>> '{}';
end;
$$;

create or replace function privado.v_booleano(v jsonb, p_nombre text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(v) is distinct from 'boolean' then
    perform privado.falla(p_nombre || ': tiene que ser Sí o No');
  end if;
  return (v #>> '{}')::boolean;
end;
$$;

create or replace function privado.v_medio(v jsonb, p_nombre text)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if v is null or jsonb_typeof(v) = 'null' or v = '""'::jsonb then
    return null;
  end if;
  return privado.v_opcion(v, array['posnet', 'efectivo', 'transferencia'], p_nombre);
end;
$$;

-- Campos editables de una tarea, validados. Solo incluye los que vienen.
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

-- -----------------------------------------------------------------------------
-- Lectura: una tarjeta (lo que muestran la matriz y el panel "Hechas hoy")
-- -----------------------------------------------------------------------------
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

create or replace function privado.nombre_persona(p_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select p.nombre from public.personas p where p.id = p_id;
$$;

-- -----------------------------------------------------------------------------
-- GET /matriz
-- -----------------------------------------------------------------------------
create or replace function public.co_matriz()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  perform privado.purgar_papelera();
  return jsonb_build_object(
    'tareas', coalesce((
      select jsonb_agg(privado.tarjeta(t))
      from public.tareas t
      where t.eliminada_at is null
        and t.mostrar_en_matriz
        and t.estado in ('pendiente', 'en_proceso', 'en_espera', 'terminada')
        and not (t.tipo = 'interna' and t.estado = 'terminada')
    ), '[]'::jsonb),
    'configuracion', coalesce((
      select jsonb_agg(jsonb_build_object('clave', c.clave, 'valor', c.valor))
      from public.configuracion c
      where c.clave in ('umbrales_urgencia', 'disposicion_cuadrantes', 'confeti_activado',
                        'plantilla_mensaje')
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- GET /catalogos  (personas: primero las asignadas más recientemente)
-- -----------------------------------------------------------------------------
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
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- GET /clientes?telefono=
-- -----------------------------------------------------------------------------
create or replace function public.co_clientes(p_telefono text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  if length(btrim(coalesce(p_telefono, ''))) < 3 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x)
    from (
      select jsonb_build_object('id', c.id, 'nombre_apellido', c.nombre_apellido,
                                'telefono', c.telefono) as x
      from public.clientes c
      where c.telefono = btrim(p_telefono)
      order by c.updated_at desc
      limit 5
    ) s
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- GET /tareas/:id  (detalle con historial)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Clientes, responsables y pedido relacionado (ayudantes de alta y edición)
-- -----------------------------------------------------------------------------
create or replace function privado.guardar_cliente(c jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := privado.v_id_opcional(c -> 'id', 'Cliente');
  v_nombre text := privado.v_texto(c -> 'nombre_apellido', 'Nombre y apellido', 120);
  v_tel text := privado.v_texto_opcional(c -> 'telefono', 'Teléfono', 30);
begin
  if v_id is not null then
    update public.clientes set nombre_apellido = v_nombre, telefono = v_tel where id = v_id;
    if not found then
      perform privado.no_existe('El cliente no existe');
    end if;
    return v_id;
  end if;
  insert into public.clientes (nombre_apellido, telefono) values (v_nombre, v_tel)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function privado.controlar_pedido(t public.tareas)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if t.pedido_id is null then
    return;
  end if;
  if t.tipo <> 'interna' then
    perform privado.falla('Solo las tareas internas tienen pedido relacionado');
  end if;
  if t.pedido_id = t.id or not exists (
    select 1 from public.tareas p where p.id = t.pedido_id and p.tipo = 'pedido'
  ) then
    perform privado.falla('El pedido relacionado no existe');
  end if;
end;
$$;

create or replace function privado.ids_responsables(v jsonb)
returns uuid[] language plpgsql immutable set search_path = '' as $$
declare
  r jsonb;
  ids uuid[] := '{}';
begin
  if jsonb_typeof(v) is distinct from 'array' then
    perform privado.falla('Responsables: formato inválido');
  end if;
  if jsonb_array_length(v) > 20 then
    perform privado.falla('Responsables: demasiados');
  end if;
  for r in select * from jsonb_array_elements(v) loop
    ids := array_append(ids, privado.v_id(r, 'Responsable'));
  end loop;
  return array(select distinct unnest(ids) order by 1);
end;
$$;

-- Reemplaza los responsables y registra "reasignada" (con nombres) si cambiaron.
create or replace function privado.reasignar(p_tarea uuid, p_nuevos uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_antes uuid[];
  t public.tareas;
begin
  select * into t from public.tareas where id = p_tarea;
  v_antes := array(
    select r.persona_id from public.tarea_responsables r where r.tarea_id = p_tarea order by 1
  );
  if v_antes = p_nuevos then
    return;
  end if;
  delete from public.tarea_responsables where tarea_id = p_tarea;
  insert into public.tarea_responsables (tarea_id, persona_id)
  select p_tarea, unnest(p_nuevos);
  insert into public.eventos (tarea_id, proyecto_id, persona_id, accion, cambios)
  values (
    t.id, t.proyecto_id, privado.persona_actual(), 'reasignada',
    jsonb_build_object(
      'responsables', jsonb_build_object(
        'antes', coalesce((select jsonb_agg(coalesce(privado.nombre_persona(x), '—')) from unnest(v_antes) x), '[]'::jsonb),
        'despues', coalesce((select jsonb_agg(coalesce(privado.nombre_persona(x), '—')) from unnest(p_nuevos) x), '[]'::jsonb)
      ),
      'titulo', t.titulo
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- POST /tareas  (alta en un paso: responsables, subtareas y cliente)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- PATCH /tareas/:id  (campos, responsables y cliente; p_pista para el historial)
-- -----------------------------------------------------------------------------
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
    c := c || '{"pedido_id": null}'::jsonb;
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
      mostrar_en_matriz = v_nueva.mostrar_en_matriz
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
-- Ciclo y papelera: POST /tareas/:id/{eliminar,restaurar,terminar,entregar,devolver}
-- -----------------------------------------------------------------------------
create or replace function privado.estado_antes_de_terminar(p_id uuid)
returns public.estado_tarea language sql stable security definer set search_path = '' as $$
  select (e.cambios -> 'estado' ->> 'antes')::public.estado_tarea
  from public.eventos e
  where e.tarea_id = p_id
    and e.accion in ('estado', 'devuelta')
    and e.cambios -> 'estado' ->> 'despues' = 'terminada'
    and e.cambios -> 'estado' ->> 'antes' in ('pendiente', 'en_proceso', 'en_espera')
  order by e.created_at desc
  limit 1;
$$;

create or replace function public.co_tarea_accion(p_id uuid, p_accion text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.tareas;
  v_estado public.estado_tarea;
  v_activos constant text[] := array['pendiente', 'en_proceso', 'en_espera'];
begin
  perform privado.exigir_acceso();
  select * into t from public.tareas where id = p_id for update;
  if not found then
    perform privado.no_existe('La tarea no existe');
  end if;

  if p_accion = 'eliminar' then
    update public.tareas set eliminada_at = now() where id = p_id;
  elsif p_accion = 'restaurar' then
    if t.eliminada_at is null then
      perform privado.falla('La tarea no está en la papelera');
    end if;
    update public.tareas set eliminada_at = null where id = p_id;
  else
    if t.eliminada_at is not null then
      perform privado.no_existe('La tarea no existe');
    end if;
    if p_accion = 'terminar' then
      if not (t.estado::text = any (v_activos)) then
        perform privado.falla('La tarea ya no está en curso');
      end if;
      update public.tareas set estado = 'terminada' where id = p_id;
    elsif p_accion = 'entregar' then
      if t.tipo <> 'pedido' then
        perform privado.falla('Las tareas internas no se entregan');
      end if;
      if t.estado <> 'terminada' then
        perform privado.falla('Primero hay que terminarla');
      end if;
      update public.tareas set estado = 'entregada' where id = p_id;
    elsif p_accion = 'devolver' then
      -- Siempre hacia atrás: entregada → terminada → el estado en curso que tenía.
      if t.estado = 'entregada' then
        v_estado := 'terminada';
      elsif t.estado = 'terminada' then
        v_estado := case
          when t.estado_anterior::text = any (v_activos) then t.estado_anterior
          else coalesce(privado.estado_antes_de_terminar(p_id), 'pendiente')
        end;
      elsif t.estado_anterior::text = any (v_activos) and t.estado_anterior <> t.estado then
        v_estado := t.estado_anterior;
      end if;
      if v_estado is null then
        perform privado.falla('No hay un estado anterior al que volver');
      end if;
      if v_estado = 'en_espera' and t.motivo_espera is null then
        v_estado := 'pendiente';
      end if;
      perform set_config('co.pista', 'devuelta', true);
      update public.tareas set estado = v_estado where id = p_id;
      perform set_config('co.pista', '', true);
    else
      perform privado.falla('Acción desconocida');
    end if;
  end if;
  return public.co_detalle(p_id);
end;
$$;

-- DELETE /tareas/:id  (solo desde la papelera)
create or replace function public.co_borrar_definitiva(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.tareas;
begin
  perform privado.exigir_acceso();
  select * into t from public.tareas where id = p_id;
  if not found then
    perform privado.no_existe('La tarea no existe');
  end if;
  if t.eliminada_at is null then
    perform privado.falla('Solo se borran tareas de la papelera');
  end if;
  delete from public.tareas where id = p_id;
  return '{"ok": true}'::jsonb;
end;
$$;

-- GET /papelera
create or replace function public.co_papelera()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_dias integer := privado.dias_papelera();
begin
  perform privado.exigir_acceso();
  perform privado.purgar_papelera();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'titulo', t.titulo, 'tipo', t.tipo, 'eliminada_at', t.eliminada_at,
      'eliminada_por', pe.nombre,
      'se_borra_el', t.eliminada_at + make_interval(days => v_dias)
    ) order by t.eliminada_at desc)
    from public.tareas t left join public.personas pe on pe.id = t.eliminada_por
    where t.eliminada_at is not null
  ), '[]'::jsonb);
end;
$$;

-- GET /hechas?desde=
create or replace function public.co_hechas(p_desde timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  if p_desde is null then
    perform privado.falla('Falta el comienzo del día');
  end if;
  return jsonb_build_object(
    'terminadas', coalesce((
      select jsonb_agg(privado.tarjeta(t) order by t.terminada_at desc)
      from public.tareas t
      where t.eliminada_at is null and t.estado = 'terminada' and t.terminada_at >= p_desde
    ), '[]'::jsonb),
    'entregadas', coalesce((
      select jsonb_agg(privado.tarjeta(t) order by t.entregada_at desc)
      from public.tareas t
      where t.eliminada_at is null and t.estado = 'entregada' and t.entregada_at >= p_desde
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Subtareas: POST /tareas/:id/subtareas, PATCH y DELETE /subtareas/:id
-- (registran su historial como el servidor local)
-- -----------------------------------------------------------------------------
create or replace function privado.evento_subtarea(p_tarea uuid, p_accion text, p_cambios jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.tareas;
begin
  select * into t from public.tareas where id = p_tarea;
  insert into public.eventos (tarea_id, proyecto_id, persona_id, accion, cambios)
  values (t.id, t.proyecto_id, privado.persona_actual(), p_accion,
          p_cambios || jsonb_build_object('titulo', t.titulo));
end;
$$;

create or replace function public.co_crear_subtarea(p_tarea uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_titulo text;
  v_resp uuid;
begin
  perform privado.exigir_acceso();
  if not exists (select 1 from public.tareas where id = p_tarea) then
    perform privado.no_existe('La tarea no existe');
  end if;
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Subtarea: formato inválido');
  end if;
  v_titulo := privado.v_texto(p -> 'titulo', 'Subtarea', 200);
  v_resp := privado.v_id_opcional(p -> 'responsable_id', 'Responsable');
  begin
    insert into public.subtareas (tarea_id, titulo, responsable_id, orden)
    values (p_tarea, v_titulo, v_resp,
            (select coalesce(max(s.orden), -1) + 1 from public.subtareas s where s.tarea_id = p_tarea));
  exception when foreign_key_violation then
    perform privado.falla('Datos inválidos');
  end;
  perform privado.evento_subtarea(p_tarea, 'subtarea_creada',
    jsonb_build_object('subtarea', v_titulo, 'responsable', privado.nombre_persona(v_resp)));
  return public.co_detalle(p_tarea);
end;
$$;

create or replace function public.co_editar_subtarea(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.subtareas;
  v_titulo text;
  v_resp uuid;
  v_hecha boolean;
  v_editada jsonb := '{}'::jsonb;
begin
  perform privado.exigir_acceso();
  select * into s from public.subtareas where id = p_id for update;
  if not found then
    perform privado.no_existe('La subtarea no existe');
  end if;
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Subtarea: formato inválido');
  end if;
  v_titulo := case when p ? 'titulo' then privado.v_texto(p -> 'titulo', 'Subtarea', 200) else s.titulo end;
  v_resp := case when p ? 'responsable_id'
    then privado.v_id_opcional(p -> 'responsable_id', 'Responsable') else s.responsable_id end;
  v_hecha := case when p ? 'hecha' then privado.v_booleano(p -> 'hecha', 'Hecha') else s.hecha end;

  begin
    update public.subtareas set titulo = v_titulo, responsable_id = v_resp, hecha = v_hecha
    where id = p_id;
  exception when foreign_key_violation then
    perform privado.falla('Datos inválidos');
  end;

  if v_hecha is distinct from s.hecha then
    perform privado.evento_subtarea(s.tarea_id,
      case when v_hecha then 'subtarea_hecha' else 'subtarea_deshecha' end,
      jsonb_build_object('subtarea', v_titulo));
  end if;
  if v_titulo is distinct from s.titulo then
    v_editada := v_editada || jsonb_build_object('subtarea',
      jsonb_build_object('antes', s.titulo, 'despues', v_titulo));
  end if;
  if v_resp is distinct from s.responsable_id then
    v_editada := v_editada || jsonb_build_object('responsable', jsonb_build_object(
      'antes', privado.nombre_persona(s.responsable_id), 'despues', privado.nombre_persona(v_resp)));
  end if;
  if v_editada <> '{}'::jsonb then
    perform privado.evento_subtarea(s.tarea_id, 'subtarea_editada',
      v_editada || jsonb_build_object('nombre', v_titulo));
  end if;
  return public.co_detalle(s.tarea_id);
end;
$$;

create or replace function public.co_borrar_subtarea(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.subtareas;
begin
  perform privado.exigir_acceso();
  select * into s from public.subtareas where id = p_id;
  if not found then
    perform privado.no_existe('La subtarea no existe');
  end if;
  delete from public.subtareas where id = p_id;
  perform privado.evento_subtarea(s.tarea_id, 'subtarea_eliminada',
    jsonb_build_object('subtarea', s.titulo));
  return public.co_detalle(s.tarea_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Personas y PIN: POST /personas, POST /personas/:id/verificar,
-- PUT /personas/:id/pin, GET /personas/:id/tareas
-- El PIN se guarda solo como hash (bcrypt) en privado.personas_pin.
-- -----------------------------------------------------------------------------
create or replace function public.co_crear_persona(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text;
  v_iniciales text;
  v_id uuid;
begin
  perform privado.exigir_acceso();
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Persona: formato inválido');
  end if;
  v_nombre := regexp_replace(privado.v_texto(p -> 'nombre', 'Nombre', 60), '\s+', ' ', 'g');
  v_iniciales := coalesce(
    privado.v_texto_opcional(p -> 'iniciales', 'Iniciales', 4),
    (select string_agg(upper(left(w, 1)), '' order by n)
     from unnest(string_to_array(v_nombre, ' ')) with ordinality as x(w, n)
     where n <= 2)
  );
  if exists (select 1 from public.personas pe where lower(pe.nombre) = lower(v_nombre) and pe.activa) then
    perform privado.falla('Ya hay una persona con ese nombre');
  end if;
  insert into public.personas (nombre, iniciales, orden)
  values (v_nombre, v_iniciales,
          (select coalesce(max(pe.orden), 0) + 10 from public.personas pe))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'nombre', v_nombre, 'iniciales', v_iniciales);
end;
$$;

create or replace function privado.persona_activa(p_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.personas pe where pe.id = p_id and pe.activa) then
    perform privado.no_existe('La persona no existe');
  end if;
end;
$$;

create or replace function public.co_verificar_pin(p_id uuid, p_pin text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_hash text;
begin
  perform privado.exigir_acceso();
  perform privado.persona_activa(p_id);
  select pp.pin_hash into v_hash from privado.personas_pin pp where pp.persona_id = p_id;
  if v_hash is not null and extensions.crypt(left(coalesce(p_pin, ''), 16), v_hash) <> v_hash then
    perform privado.falla('PIN incorrecto');
  end if;
  return '{"ok": true}'::jsonb;
end;
$$;

create or replace function public.co_cambiar_pin(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_actual text;
  v_nuevo text;
begin
  perform privado.exigir_acceso();
  perform privado.persona_activa(p_id);
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('PIN: formato inválido');
  end if;
  v_actual := case when jsonb_typeof(p -> 'pin_actual') = 'string' then left(p ->> 'pin_actual', 16) end;
  if jsonb_typeof(p -> 'pin_nuevo') = 'null' then
    v_nuevo := null;
  elsif jsonb_typeof(p -> 'pin_nuevo') = 'string' and (p ->> 'pin_nuevo') ~ '^\d{4,8}$' then
    v_nuevo := p ->> 'pin_nuevo';
  else
    perform privado.falla('PIN: de 4 a 8 números');
  end if;

  select pp.pin_hash into v_hash from privado.personas_pin pp where pp.persona_id = p_id;
  if v_hash is not null and (v_actual is null or extensions.crypt(v_actual, v_hash) <> v_hash) then
    perform privado.falla('El PIN actual no es correcto');
  end if;

  if v_nuevo is null then
    delete from privado.personas_pin where persona_id = p_id;
  else
    insert into privado.personas_pin (persona_id, pin_hash)
    values (p_id, extensions.crypt(v_nuevo, extensions.gen_salt('bf')))
    on conflict (persona_id) do update set pin_hash = excluded.pin_hash;
  end if;
  update public.personas set tiene_pin = (v_nuevo is not null) where id = p_id;
  return '{"ok": true}'::jsonb;
end;
$$;

create or replace function public.co_mis_tareas(p_persona uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  if not exists (select 1 from public.personas pe where pe.id = p_persona) then
    perform privado.no_existe('La persona no existe');
  end if;
  return coalesce((
    select jsonb_agg(
      privado.tarjeta(t) || jsonb_build_object('pasos', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'titulo', s.titulo, 'hecha', s.hecha,
          'responsable', case when pe.id is null then null else
            jsonb_build_object('id', pe.id, 'nombre', pe.nombre, 'iniciales', pe.iniciales) end
        ) order by s.orden, s.created_at)
        from public.subtareas s left join public.personas pe on pe.id = s.responsable_id
        where s.tarea_id = t.id
      ), '[]'::jsonb))
      order by t.fecha_entrega nulls last, t.created_at
    )
    from public.tareas t
    where t.eliminada_at is null
      and t.estado in ('pendiente', 'en_proceso', 'en_espera', 'terminada')
      and not (t.tipo = 'interna' and t.estado = 'terminada')
      and t.id in (select r.tarea_id from public.tarea_responsables r where r.persona_id = p_persona)
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- PUT /configuracion/:clave  (lo editable desde la app: confeti y plantilla)
-- -----------------------------------------------------------------------------
create or replace function public.co_guardar_configuracion(p_clave text, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  perform privado.exigir_acceso();
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Configuración: formato inválido');
  end if;
  if p_clave = 'confeti_activado' then
    v := to_jsonb(privado.v_booleano(p -> 'valor', 'Confeti'));
  elsif p_clave = 'plantilla_mensaje' then
    v := to_jsonb(privado.v_texto(p -> 'valor', 'Plantilla del mensaje', 500));
  else
    perform privado.no_existe('Esa configuración no se puede cambiar');
  end if;
  insert into public.configuracion (clave, valor) values (p_clave, v)
  on conflict (clave) do update set valor = excluded.valor;
  return jsonb_build_object('clave', p_clave, 'valor', v);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos: las funciones de la API solo para la cuenta del local (por ahora).
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema privado from public, anon, authenticated;
grant execute on function privado.es_cuenta_local() to authenticated;
grant execute on function privado.encabezado(text) to authenticated;
grant execute on function privado.persona_actual() to authenticated;
grant execute on function privado.diferencias(jsonb, jsonb, text[]) to authenticated;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'co\_%'
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
