-- Una tarea interna puede estar relacionada con un pedido (una orden de
-- trabajo ya cargada): así no hay que volver a cargar cliente, teléfono ni
-- saldo. Si el pedido se borra definitivamente, el enlace se quita.
ALTER TABLE tareas ADD COLUMN pedido_id TEXT REFERENCES tareas (id) ON DELETE SET NULL;

CREATE INDEX tareas_pedido_idx ON tareas (pedido_id) WHERE pedido_id IS NOT NULL;
