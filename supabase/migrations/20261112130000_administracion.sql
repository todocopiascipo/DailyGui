-- Fase 9: personas y categorías desde Configuración, configuración completa,
-- historial global con filtros y respaldo. Equivale a server/administracion.ts
-- y a validarConfiguracion (server/validar.ts).

-- Tiempo real: las categorías también avisan (las pantallas recargan los catálogos).
create trigger zz_aviso after insert or update or delete on public.categorias
  for each statement execute function privado.avisar_cambio('catalogos');

-- La matriz también trae los días de la papelera (los muestra Configuración).
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
                        'plantilla_mensaje', 'papelera_dias')
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- PUT /configuracion/:clave  (ahora también umbrales, disposición y papelera)
-- -----------------------------------------------------------------------------
create or replace function public.co_guardar_configuracion(p_clave text, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  o jsonb;
  k integer;
  claves constant text[] := array['nivel_5_horas', 'nivel_3_horas', 'nivel_2_horas'];
  h5 numeric; h3 numeric; h2 numeric;
begin
  perform privado.exigir_acceso();
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Configuración: formato inválido');
  end if;
  o := p -> 'valor';
  if p_clave = 'confeti_activado' then
    v := to_jsonb(privado.v_booleano(o, 'Confeti'));
  elsif p_clave = 'plantilla_mensaje' then
    v := to_jsonb(privado.v_texto(o, 'Plantilla del mensaje', 500));
  elsif p_clave = 'papelera_dias' then
    if jsonb_typeof(o) is distinct from 'number' or (o #>> '{}') !~ '^\d+$'
       or (o #>> '{}')::numeric not between 1 and 365 then
      perform privado.falla('Días en la papelera: de 1 a 365');
    end if;
    v := o;
  elsif p_clave = 'umbrales_urgencia' then
    if jsonb_typeof(o) is distinct from 'object' then
      perform privado.falla('Umbrales: formato inválido');
    end if;
    for k in 1..3 loop
      if jsonb_typeof(o -> claves[k]) is distinct from 'number'
         or (o ->> claves[k])::numeric <= 0 or (o ->> claves[k])::numeric > 720 then
        perform privado.falla((array['Crítica', 'Alta', 'Media'])[k] || ': entre 0 y 720 horas');
      end if;
    end loop;
    h5 := round((o ->> 'nivel_5_horas')::numeric, 2);
    h3 := round((o ->> 'nivel_3_horas')::numeric, 2);
    h2 := round((o ->> 'nivel_2_horas')::numeric, 2);
    if not (h5 < h3 and h3 < h2) then
      perform privado.falla('Las horas tienen que ir de menor a mayor: crítica < alta < media');
    end if;
    v := jsonb_build_object('nivel_5_horas', h5, 'nivel_3_horas', h3, 'nivel_2_horas', h2);
  elsif p_clave = 'disposicion_cuadrantes' then
    if jsonb_typeof(o) is distinct from 'object' then
      perform privado.falla('Disposición: formato inválido');
    end if;
    v := jsonb_build_object(
      'arriba_izquierda', o -> 'arriba_izquierda', 'arriba_derecha', o -> 'arriba_derecha',
      'abajo_izquierda', o -> 'abajo_izquierda', 'abajo_derecha', o -> 'abajo_derecha');
    if (select count(distinct x) from jsonb_each_text(v) as e(lugar, x)
        where x in ('hacer', 'planificar', 'delegar', 'eliminar')) <> 4 then
      perform privado.falla('Disposición: cada cuadrante tiene que aparecer una vez');
    end if;
  else
    perform privado.no_existe('Esa configuración no se puede cambiar');
  end if;
  insert into public.configuracion (clave, valor) values (p_clave, v)
  on conflict (clave) do update set valor = excluded.valor;
  return jsonb_build_object('clave', p_clave, 'valor', v);
end;
$$;

-- -----------------------------------------------------------------------------
-- Personas: lista completa, editar (nombre, iniciales, baja) y orden
-- -----------------------------------------------------------------------------
create or replace function public.co_personas()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'iniciales', p.iniciales,
                                        'activa', p.activa, 'tiene_pin', p.tiene_pin)
           order by p.activa desc, p.orden, p.nombre)
    from public.personas p
  ), '[]'::jsonb);
end;
$$;

create or replace function public.co_editar_persona(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.personas;
begin
  perform privado.exigir_acceso();
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Persona: formato inválido');
  end if;
  select * into v from public.personas where id = p_id for update;
  if not found then
    perform privado.no_existe('La persona no existe');
  end if;
  if p ? 'nombre' then
    v.nombre := regexp_replace(privado.v_texto(p -> 'nombre', 'Nombre', 60), '\s+', ' ', 'g');
  end if;
  if p ? 'iniciales' then
    v.iniciales := coalesce(
      privado.v_texto_opcional(p -> 'iniciales', 'Iniciales', 4),
      (select string_agg(upper(left(w, 1)), '' order by n)
       from unnest(string_to_array(v.nombre, ' ')) with ordinality as x(w, n)
       where n <= 2)
    );
  end if;
  if p ? 'activa' then
    v.activa := privado.v_booleano(p -> 'activa', 'Activa');
  end if;
  if v.activa and exists (
    select 1 from public.personas pe
    where lower(pe.nombre) = lower(v.nombre) and pe.activa and pe.id <> p_id
  ) then
    perform privado.falla('Ya hay una persona con ese nombre');
  end if;
  begin
    update public.personas set nombre = v.nombre, iniciales = v.iniciales, activa = v.activa
    where id = p_id;
  exception
    when check_violation or not_null_violation then
      perform privado.falla('Datos inválidos');
  end;
  return public.co_personas();
end;
$$;

-- Orden de una lista (personas o categorías): de 10 en 10, solo lo que cambia.
create or replace function privado.ids_orden(v jsonb, p_nombre text)
returns uuid[] language plpgsql stable set search_path = '' as $$
declare
  r uuid[];
begin
  if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v) > 500 then
    perform privado.falla(p_nombre || ': formato inválido');
  end if;
  select coalesce(array_agg(privado.v_id(x, p_nombre) order by i), '{}')
    into r from jsonb_array_elements(v) with ordinality as a(x, i);
  return r;
end;
$$;

create or replace function public.co_ordenar_personas(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  update public.personas pe set orden = n.i * 10
  from unnest(privado.ids_orden(p -> 'personas', 'Orden')) with ordinality as n(id, i)
  where pe.id = n.id and pe.orden <> n.i * 10;
  return public.co_personas();
end;
$$;

-- -----------------------------------------------------------------------------
-- Categorías: lista completa, alta, editar (nombre, para qué es, activa) y orden
-- -----------------------------------------------------------------------------
create or replace function public.co_categorias()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre,
                                        'tipo_aplica', c.tipo_aplica, 'activa', c.activa)
           order by c.orden, c.nombre)
    from public.categorias c
  ), '[]'::jsonb);
end;
$$;

create or replace function public.co_crear_categoria(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text;
  v_tipo text := 'ambos';
  v_id uuid;
begin
  perform privado.exigir_acceso();
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Categoría: formato inválido');
  end if;
  v_nombre := regexp_replace(privado.v_texto(p -> 'nombre', 'Nombre de la categoría', 60), '\s+', ' ', 'g');
  if p ? 'tipo_aplica' then
    v_tipo := privado.v_opcion(p -> 'tipo_aplica', array['pedido', 'interna', 'ambos'], 'Para qué es');
  end if;
  if exists (select 1 from public.categorias c where lower(c.nombre) = lower(v_nombre)) then
    perform privado.falla('Ya hay una categoría con ese nombre');
  end if;
  insert into public.categorias (nombre, tipo_aplica, orden)
  values (v_nombre, v_tipo::public.tipo_categoria,
          (select coalesce(max(c.orden), 0) + 10 from public.categorias c))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'nombre', v_nombre, 'tipo_aplica', v_tipo, 'activa', true);
end;
$$;

create or replace function public.co_editar_categoria(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.categorias;
begin
  perform privado.exigir_acceso();
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Categoría: formato inválido');
  end if;
  select * into v from public.categorias where id = p_id for update;
  if not found then
    perform privado.no_existe('La categoría no existe');
  end if;
  if p ? 'nombre' then
    v.nombre := regexp_replace(privado.v_texto(p -> 'nombre', 'Nombre de la categoría', 60), '\s+', ' ', 'g');
  end if;
  if p ? 'tipo_aplica' then
    v.tipo_aplica := privado.v_opcion(p -> 'tipo_aplica', array['pedido', 'interna', 'ambos'],
                                      'Para qué es')::public.tipo_categoria;
  end if;
  if p ? 'activa' then
    v.activa := privado.v_booleano(p -> 'activa', 'Activa');
  end if;
  if exists (select 1 from public.categorias c where lower(c.nombre) = lower(v.nombre) and c.id <> p_id) then
    perform privado.falla('Ya hay una categoría con ese nombre');
  end if;
  update public.categorias set nombre = v.nombre, tipo_aplica = v.tipo_aplica, activa = v.activa
  where id = p_id;
  return public.co_categorias();
end;
$$;

create or replace function public.co_ordenar_categorias(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  update public.categorias c set orden = n.i * 10
  from unnest(privado.ids_orden(p -> 'categorias', 'Orden')) with ordinality as n(id, i)
  where c.id = n.id and c.orden <> n.i * 10;
  return public.co_categorias();
end;
$$;

-- -----------------------------------------------------------------------------
-- GET /historial  (filtros: persona, tarea, desde, hasta, texto; antes = página)
-- -----------------------------------------------------------------------------
create or replace function public.co_historial(p jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_persona uuid;
  v_tarea uuid;
  v_desde timestamptz;
  v_hasta timestamptz;
  v_texto text;
  v_antes_fecha timestamptz;
  v_antes_id uuid;
  v_filas jsonb;
  v_total integer;
begin
  perform privado.exigir_acceso();
  if jsonb_typeof(p) is distinct from 'object' then
    perform privado.falla('Filtros: formato inválido');
  end if;
  v_persona := privado.v_id_opcional(p -> 'persona', 'Persona');
  v_tarea := privado.v_id_opcional(p -> 'tarea', 'Tarea');
  v_desde := privado.v_fecha(p -> 'desde', 'Desde');
  v_hasta := privado.v_fecha(p -> 'hasta', 'Hasta');
  v_texto := nullif(left(btrim(coalesce(p ->> 'texto', '')), 100), '');
  if p ? 'antes' then
    if (p ->> 'antes') !~* '^[^|]+\|[0-9a-f-]{36}$' then
      perform privado.falla('Página inválida');
    end if;
    begin
      v_antes_fecha := split_part(p ->> 'antes', '|', 1)::timestamptz;
      v_antes_id := split_part(p ->> 'antes', '|', 2)::uuid;
    exception when others then
      perform privado.falla('Página inválida');
    end;
  end if;

  select coalesce(jsonb_agg(x order by f desc, i desc), '[]'::jsonb), count(*)
    into v_filas, v_total
  from (
    select jsonb_build_object(
             'id', e.id, 'accion', e.accion, 'persona', pe.nombre, 'persona_id', e.persona_id,
             'tarea_id', e.tarea_id, 'tarea_titulo', t.titulo, 'proyecto_id', e.proyecto_id,
             'proyecto_nombre', y.nombre, 'cambios', e.cambios, 'created_at', e.created_at
           ) as x, e.created_at as f, e.id as i
    from public.eventos e
    left join public.personas pe on pe.id = e.persona_id
    left join public.tareas t on t.id = e.tarea_id
    left join public.proyectos y on y.id = e.proyecto_id
    where (v_persona is null or e.persona_id = v_persona)
      and (v_tarea is null or e.tarea_id = v_tarea)
      and (v_desde is null or e.created_at >= v_desde)
      and (v_hasta is null or e.created_at < v_hasta)
      and (v_texto is null
           or strpos(lower(e.cambios::text), lower(v_texto)) > 0
           or strpos(lower(coalesce(t.titulo, '')), lower(v_texto)) > 0
           or strpos(lower(coalesce(pe.nombre, '')), lower(v_texto)) > 0
           or strpos(lower(coalesce(y.nombre, '')), lower(v_texto)) > 0)
      and (v_antes_fecha is null or e.created_at < v_antes_fecha
           or (e.created_at = v_antes_fecha and e.id < v_antes_id))
    order by e.created_at desc, e.id desc
    limit 51
  ) s;

  if v_total > 50 then
    v_filas := v_filas - 50;
    return jsonb_build_object(
      'eventos', v_filas,
      'siguiente', (v_filas -> 49 ->> 'created_at') || '|' || (v_filas -> 49 ->> 'id')
    );
  end if;
  return jsonb_build_object('eventos', v_filas, 'siguiente', null);
end;
$$;

-- -----------------------------------------------------------------------------
-- GET /respaldo  (todas las tablas de la app; los PIN no viajan)
-- -----------------------------------------------------------------------------
create or replace function public.co_respaldo()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  return jsonb_build_object(
    'aplicacion', 'TODOCOPIAS · Centro de operaciones',
    'version', 1,
    'generado', now(),
    'tablas', jsonb_build_object(
      'personas', coalesce((select jsonb_agg(to_jsonb(x)) from public.personas x), '[]'::jsonb),
      'clientes', coalesce((select jsonb_agg(to_jsonb(x)) from public.clientes x), '[]'::jsonb),
      'categorias', coalesce((select jsonb_agg(to_jsonb(x)) from public.categorias x), '[]'::jsonb),
      'proyectos', coalesce((select jsonb_agg(to_jsonb(x)) from public.proyectos x), '[]'::jsonb),
      'tareas', coalesce((select jsonb_agg(to_jsonb(x)) from public.tareas x), '[]'::jsonb),
      'tarea_responsables', coalesce((select jsonb_agg(to_jsonb(x)) from public.tarea_responsables x), '[]'::jsonb),
      'subtareas', coalesce((select jsonb_agg(to_jsonb(x)) from public.subtareas x), '[]'::jsonb),
      'eventos', coalesce((select jsonb_agg(to_jsonb(x)) from public.eventos x), '[]'::jsonb),
      'configuracion', coalesce((select jsonb_agg(to_jsonb(x)) from public.configuracion x), '[]'::jsonb)
    )
  );
end;
$$;

-- Permisos: ayudante privado cerrado; la API, para la app (exige la clave).
revoke execute on function privado.ids_orden(jsonb, text) from public, anon, authenticated;
do $do$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'co_personas', 'co_editar_persona', 'co_ordenar_personas', 'co_categorias',
      'co_crear_categoria', 'co_editar_categoria', 'co_ordenar_categorias', 'co_historial',
      'co_respaldo', 'co_matriz', 'co_guardar_configuracion')
  loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end;
$do$;
