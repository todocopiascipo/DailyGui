# Decisiones tomadas con el usuario

Registro de lo que se definió durante el desarrollo y que cambia o completa la
especificación (`ESPECIFICACION.md`).

| Fecha      | Tema                                     | Decisión                                                                                                                                                                                                                                                                      |
| ---------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-06 | Región de Supabase                       | `sa-east-1` (São Paulo), proyecto `todocopias-operaciones`.                                                                                                                                                                                                                   |
| 2026-11-07 | Base de datos del prototipo              | **Hasta terminar el prototipo no se usa Supabase.** Los datos viven en una base SQLite en la PC del local, con un servidor chico (`server/`). El iPad y el monitor se conectan por la red del local. El proyecto de Supabase queda creado, sin uso, para migrar más adelante. |
| 2026-11-07 | Títulos de los cuadrantes                | Se muestran como combinación de urgencia e importancia: "Urgente e importante", "No urgente e importante", "Urgente y no importante", "No urgente y no importante" (sin "Hacer / Planificar / Delegar / Eliminar").                                                           |
| 2026-11-07 | Disposición, umbrales y brillo del fondo | Valores por defecto de la especificación (urgente a la derecha, importante arriba; 2 h / hoy / 24 h / 72 h). El brillo celeste quedó más tenue para cumplir el contraste mínimo.                                                                                              |

## Consecuencias del prototipo local

- **Acceso:** mientras sea local, no hay pantalla de ingreso: la app solo es
  accesible dentro de la red del local. La cuenta compartida (sección 4.3) se
  implementa al migrar a Supabase.
- **Migración:** la interfaz accede a los datos solo a través de
  `src/modules/centro-operaciones/lib/api.ts`. Las reglas automáticas e
  historial están en `server/reglas.ts` y `server/servicio.ts`, equivalentes a
  los triggers de `supabase/migrations/`.
- **Tiempo real (Fase 4):** se hará entre el servidor local y los dispositivos
  (no con Supabase Realtime).
