-- =============================================================================
-- Fase 1 · Esquema base del Centro de operaciones (especificación, sección 5)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Esquema privado: no lo expone la API de Supabase. Guarda datos sensibles
-- (hashes de PIN, cuentas habilitadas) y funciones internas.
create schema if not exists privado;
revoke all on schema privado from public;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.tipo_tarea as enum ('pedido', 'interna');
create type public.tipo_categoria as enum ('pedido', 'interna', 'ambos');
create type public.estado_tarea as enum (
  'pendiente', 'en_proceso', 'en_espera', 'terminada', 'entregada', 'cancelada'
);
create type public.estado_proyecto as enum ('activo', 'en_pausa', 'terminado', 'cancelado');
create type public.motivo_espera as enum ('archivo_cliente', 'material', 'pago', 'proveedor', 'otro');

-- -----------------------------------------------------------------------------
-- Cuentas de Supabase Auth habilitadas para usar la app (la cuenta del local).
-- Aunque alguien lograra registrarse, sin estar acá no ve nada.
-- -----------------------------------------------------------------------------
create table privado.cuentas_local (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- personas
-- -----------------------------------------------------------------------------
create table public.personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 60),
  iniciales text check (iniciales is null or length(btrim(iniciales)) between 1 and 4),
  -- El hash del PIN vive en privado.personas_pin para que nunca llegue al navegador.
  tiene_pin boolean not null default false,
  activa boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table privado.personas_pin (
  persona_id uuid primary key references public.personas (id) on delete cascade,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- clientes
-- -----------------------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre_apellido text not null check (length(btrim(nombre_apellido)) between 1 and 120),
  telefono text check (telefono is null or length(btrim(telefono)) between 3 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clientes_telefono_idx on public.clientes (telefono);

-- -----------------------------------------------------------------------------
-- categorias
-- -----------------------------------------------------------------------------
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(btrim(nombre)) between 1 and 60),
  tipo_aplica public.tipo_categoria not null default 'ambos',
  activa boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- proyectos
-- -----------------------------------------------------------------------------
create table public.proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  descripcion text,
  estado public.estado_proyecto not null default 'activo',
  fecha_inicio timestamptz,
  fecha_objetivo timestamptz,
  responsable_id uuid references public.personas (id) on delete set null,
  categoria_id uuid references public.categorias (id) on delete set null,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proyectos_fechas_validas
    check (fecha_objetivo is null or fecha_inicio is null or fecha_objetivo >= fecha_inicio)
);
create index proyectos_responsable_idx on public.proyectos (responsable_id);
create index proyectos_categoria_idx on public.proyectos (categoria_id);

-- -----------------------------------------------------------------------------
-- tareas
-- -----------------------------------------------------------------------------
create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_tarea not null default 'pedido',
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  descripcion text,
  categoria_id uuid references public.categorias (id) on delete set null,
  proyecto_id uuid references public.proyectos (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  sena numeric(12, 2) not null default 0 check (sena >= 0),
  saldo numeric(12, 2) not null default 0 check (saldo >= 0),
  importante boolean not null,
  urgencia_manual smallint check (urgencia_manual between 1 and 5),
  estado public.estado_tarea not null default 'pendiente',
  estado_anterior public.estado_tarea,
  motivo_espera public.motivo_espera,
  motivo_espera_detalle text,
  fecha_inicio timestamptz,
  fecha_entrega timestamptz,
  terminada_at timestamptz,
  entregada_at timestamptz,
  mostrar_en_matriz boolean not null default true,
  eliminada_at timestamptz,
  eliminada_por uuid references public.personas (id) on delete set null,
  creada_por uuid references public.personas (id) on delete set null,
  actualizada_por uuid references public.personas (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tareas_cliente_solo_pedidos check (cliente_id is null or tipo = 'pedido'),
  constraint tareas_proyecto_solo_internas check (proyecto_id is null or tipo = 'interna'),
  constraint tareas_entregada_solo_pedidos check (estado <> 'entregada' or tipo = 'pedido'),
  constraint tareas_espera_con_motivo check (estado <> 'en_espera' or motivo_espera is not null)
);
create index tareas_categoria_idx on public.tareas (categoria_id);
create index tareas_proyecto_idx on public.tareas (proyecto_id);
create index tareas_cliente_idx on public.tareas (cliente_id);
create index tareas_eliminada_por_idx on public.tareas (eliminada_por);
create index tareas_creada_por_idx on public.tareas (creada_por);
create index tareas_actualizada_por_idx on public.tareas (actualizada_por);
-- Tareas visibles (no eliminadas): lo que lee la matriz.
create index tareas_activas_idx on public.tareas (estado, fecha_entrega) where eliminada_at is null;
-- Papelera.
create index tareas_eliminadas_idx on public.tareas (eliminada_at) where eliminada_at is not null;

-- -----------------------------------------------------------------------------
-- tarea_responsables
-- -----------------------------------------------------------------------------
create table public.tarea_responsables (
  tarea_id uuid not null references public.tareas (id) on delete cascade,
  persona_id uuid not null references public.personas (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tarea_id, persona_id)
);
create index tarea_responsables_persona_idx on public.tarea_responsables (persona_id);

-- -----------------------------------------------------------------------------
-- subtareas
-- -----------------------------------------------------------------------------
create table public.subtareas (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas (id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  responsable_id uuid references public.personas (id) on delete set null,
  hecha boolean not null default false,
  hecha_at timestamptz,
  orden integer not null default 0,
  inicio_estimado timestamptz,
  duracion_min integer check (duracion_min is null or duracion_min between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subtareas_tarea_idx on public.subtareas (tarea_id, orden);
create index subtareas_responsable_idx on public.subtareas (responsable_id);

-- -----------------------------------------------------------------------------
-- eventos (historial global). Solo lo escriben los triggers.
-- -----------------------------------------------------------------------------
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid references public.tareas (id) on delete set null,
  proyecto_id uuid references public.proyectos (id) on delete set null,
  persona_id uuid references public.personas (id) on delete set null,
  accion text not null check (accion in (
    'creada', 'editada', 'estado', 'devuelta', 'movida_cuadrante',
    'eliminada', 'restaurada', 'borrada_definitiva', 'reasignada',
    'subtarea_creada', 'subtarea_editada', 'subtarea_hecha', 'subtarea_deshecha',
    'subtarea_eliminada',
    'proyecto_creado', 'proyecto_editado', 'proyecto_estado', 'proyecto_eliminado'
  )),
  cambios jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index eventos_fecha_idx on public.eventos (created_at desc);
create index eventos_tarea_idx on public.eventos (tarea_id, created_at desc);
create index eventos_proyecto_idx on public.eventos (proyecto_id);
create index eventos_persona_idx on public.eventos (persona_id);

-- -----------------------------------------------------------------------------
-- configuracion (clave / valor)
-- -----------------------------------------------------------------------------
create table public.configuracion (
  clave text primary key check (clave ~ '^[a-z][a-z0-9_]{0,59}$'),
  valor jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
