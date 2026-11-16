-- Fase 13: espacio "Órdenes de trabajo". Equivale a cargarPedidos y
-- cargarTareasDePedido (server/consultas.ts).

-- OT abiertas, con el avance de sus tareas.
create or replace function public.co_pedidos()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  return coalesce((
    select jsonb_agg(
      privado.tarjeta(t) || jsonb_build_object('tareas_ot', jsonb_build_object(
        'total', (select count(*) from public.tareas x
                  where x.pedido_id = t.id and x.eliminada_at is null and x.estado <> 'cancelada'),
        'hechas', (select count(*) from public.tareas x
                   where x.pedido_id = t.id and x.eliminada_at is null and x.estado = 'terminada')
      ))
      order by t.fecha_entrega nulls last, t.created_at)
    from public.tareas t
    where t.eliminada_at is null and t.tipo = 'pedido'
      and t.estado in ('pendiente', 'en_proceso', 'en_espera', 'terminada')
  ), '[]'::jsonb);
end;
$$;

-- Las tareas de una OT (terminadas incluidas).
create or replace function public.co_pedido_tareas(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_acceso();
  if not exists (select 1 from public.tareas t where t.id = p_id and t.tipo = 'pedido') then
    perform privado.no_existe('La orden de trabajo no existe');
  end if;
  return coalesce((
    select jsonb_agg(privado.tarjeta(t) order by t.created_at)
    from public.tareas t
    where t.pedido_id = p_id and t.eliminada_at is null and t.tipo = 'interna'
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.co_pedido_tareas(uuid) from public;
grant execute on function public.co_pedido_tareas(uuid) to anon, authenticated;
