-- =============================================================================
-- Acceso por link secreto (decisión del usuario, 2026-11-11): sin pantalla de
-- ingreso. Cada dispositivo abre una vez el link con la clave del local; la app
-- la recuerda y la manda en cada pedido (encabezado x-co-acceso).
-- La base guarda solo el hash (sha256) de la clave, nunca la clave.
-- Para cambiarla: agregar una clave nueva y desactivar la anterior.
-- =============================================================================

create table privado.claves_acceso (
  hash text primary key check (hash ~ '^[0-9a-f]{64}$'),
  descripcion text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
alter table privado.claves_acceso enable row level security;
revoke all on privado.claves_acceso from public, anon, authenticated;

-- Reemplaza la llave cerrada: abre si el pedido trae una clave vigente.
create or replace function privado.acceso_publico()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_clave text := privado.encabezado('x-co-acceso');
begin
  if v_clave is null or length(v_clave) < 20 or length(v_clave) > 200 then
    return false;
  end if;
  return exists (
    select 1 from privado.claves_acceso c
    where c.activa and c.hash = encode(extensions.digest(v_clave, 'sha256'), 'hex')
  );
end;
$$;
revoke execute on function privado.acceso_publico() from public, anon, authenticated;

-- Las funciones de la API se pueden llamar sin cuenta; cada una exige la clave
-- (privado.exigir_acceso → puede_operar → acceso_publico).
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'co\_%'
  loop
    execute format('grant execute on function %s to anon', f);
  end loop;
end;
$$;
