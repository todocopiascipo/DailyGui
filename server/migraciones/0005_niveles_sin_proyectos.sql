-- Fase 12 (pedido del usuario, 2026-11-16):
-- * Las tareas tienen importancia y urgencia de 0 a 10 (6 a 10 = "sí"). La
--   urgencia ya no se calcula sola por la fecha. `importante` queda derivada.
-- * La matriz es solo de tareas: las órdenes de trabajo van a su propio espacio.
-- * Los proyectos dejan de existir en la app: sus tareas quedan como tareas
--   comunes (la tabla `proyectos` se conserva, con sus datos, por las dudas).
-- * Nuevo orden de cuadrantes: urgente e importante arriba a la izquierda.
ALTER TABLE tareas ADD COLUMN nivel_importancia INTEGER NOT NULL DEFAULT 0
  CHECK (nivel_importancia BETWEEN 0 AND 10);
ALTER TABLE tareas ADD COLUMN nivel_urgencia INTEGER NOT NULL DEFAULT 0
  CHECK (nivel_urgencia BETWEEN 0 AND 10);

UPDATE tareas SET
  nivel_importancia = CASE WHEN importante = 1 THEN 7 ELSE 3 END,
  nivel_urgencia = CASE urgencia_manual
    WHEN 5 THEN 10 WHEN 4 THEN 8 WHEN 3 THEN 6 WHEN 2 THEN 4 WHEN 1 THEN 2 ELSE 3 END,
  urgencia_manual = NULL
WHERE tipo = 'interna';

UPDATE tareas SET proyecto_id = NULL, mostrar_en_matriz = 1, orden_proyecto = 0
WHERE proyecto_id IS NOT NULL OR mostrar_en_matriz = 0;

UPDATE configuracion
SET valor = '{"arriba_izquierda":"hacer","arriba_derecha":"planificar","abajo_izquierda":"delegar","abajo_derecha":"eliminar"}'
WHERE clave = 'disposicion_cuadrantes';
