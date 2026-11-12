-- Corrección: la purga de la papelera corría un DELETE en cada lectura de la
-- matriz. Aunque no borrara nada, el aviso de tiempo real (trigger por
-- sentencia) se disparaba, las pantallas volvían a leer la matriz y se armaba
-- un ciclo sin fin. Ahora solo borra (y avisa) si hay algo vencido.
create or replace function privado.purgar_papelera()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite timestamptz := now() - make_interval(days => privado.dias_papelera());
begin
  if exists (
    select 1 from public.tareas t where t.eliminada_at is not null and t.eliminada_at < v_limite
  ) then
    delete from public.tareas t where t.eliminada_at is not null and t.eliminada_at < v_limite;
  end if;
end;
$$;
revoke execute on function privado.purgar_papelera() from public, anon, authenticated;
