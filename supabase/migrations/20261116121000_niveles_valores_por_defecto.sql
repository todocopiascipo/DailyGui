-- Corrección de la Fase 12: las funciones insertan la fila completa (con nulos
-- donde no hay dato), así que el trigger completa los niveles y el orden.
-- (Ya incluido en 20261116120000; se aplicó aparte en Supabase.)
create or replace function privado.tareas_niveles()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.nivel_importancia := coalesce(new.nivel_importancia, 0);
  new.nivel_urgencia := coalesce(new.nivel_urgencia, 0);
  new.orden_proyecto := 0;
  if new.tipo = 'interna' then
    new.importante := new.nivel_importancia >= 6;
  else
    new.importante := false;
    new.nivel_importancia := 0;
    new.nivel_urgencia := 0;
  end if;
  new.urgencia_manual := null;
  new.proyecto_id := null;
  new.mostrar_en_matriz := true;
  return new;
end;
$$;
