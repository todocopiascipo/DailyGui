-- Fase 14 (pedido del usuario): tareas encadenadas. Una tarea puede esperar a
-- otras de la misma orden de trabajo (se arma un diagrama de flujo en
-- columnas). Al borrar una tarea, sus enlaces se van con ella.
CREATE TABLE tarea_dependencias (
  tarea_id TEXT NOT NULL REFERENCES tareas (id) ON DELETE CASCADE,
  depende_de_id TEXT NOT NULL REFERENCES tareas (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tarea_id, depende_de_id),
  CHECK (tarea_id <> depende_de_id)
);
CREATE INDEX tarea_dependencias_depende_idx ON tarea_dependencias (depende_de_id);
