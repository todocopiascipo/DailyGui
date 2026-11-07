-- =============================================================================
-- Semilla: categorías y configuración por defecto (editables desde la app).
-- Es idempotente: se puede correr varias veces sin duplicar.
-- No incluye personas: los nombres del equipo se cargan aparte.
-- =============================================================================

insert into public.categorias (nombre, tipo_aplica, orden) values
  ('Impresión B/N', 'pedido', 10),
  ('Impresión color', 'pedido', 20),
  ('Vinilos y stickers', 'pedido', 30),
  ('Libros y encuadernación', 'pedido', 40),
  ('Anillados', 'pedido', 50),
  ('Papelería', 'pedido', 60),
  ('Regalos empresariales', 'pedido', 70),
  ('Trabajo tercerizado', 'pedido', 80),
  ('Envíos y logística', 'pedido', 90),
  ('Finanzas', 'interna', 110),
  ('Cartelería', 'interna', 120),
  ('Mejoras edilicias', 'interna', 130),
  ('Orden y limpieza', 'interna', 140),
  ('Mantenimiento de máquinas', 'interna', 150),
  ('Marketing', 'interna', 160),
  ('Desarrollo comercial', 'interna', 170)
on conflict (nombre) do nothing;

insert into public.configuracion (clave, valor) values
  ('confeti_activado', 'true'),
  -- Urgencia estimada (sección 6.1). El nivel 4 es "vence hoy" (mismo día calendario).
  ('umbrales_urgencia', '{"nivel_5_horas": 2, "nivel_3_horas": 24, "nivel_2_horas": 72}'),
  -- Disposición de la matriz (sección 6.3): urgente a la derecha, importante arriba.
  ('disposicion_cuadrantes',
   '{"arriba_izquierda": "planificar", "arriba_derecha": "hacer", "abajo_izquierda": "eliminar", "abajo_derecha": "delegar"}'),
  ('plantilla_mensaje',
   '"Hola {nombre}, tu trabajo \"{trabajo}\" ya está listo para retirar. Saldo pendiente: {saldo}."'),
  ('papelera_dias', '30')
on conflict (clave) do nothing;
