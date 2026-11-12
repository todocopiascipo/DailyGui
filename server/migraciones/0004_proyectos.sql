-- Fase 8: proyectos internos. Orden de las tareas dentro de su proyecto
-- (se reordenan desde la vista del proyecto).
ALTER TABLE tareas ADD COLUMN orden_proyecto INTEGER NOT NULL DEFAULT 0;

CREATE INDEX tareas_proyecto_orden_idx ON tareas (proyecto_id, orden_proyecto)
  WHERE proyecto_id IS NOT NULL;
