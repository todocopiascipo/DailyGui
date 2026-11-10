# Decisiones tomadas con el usuario

Registro de lo que se definió durante el desarrollo y que cambia o completa la
especificación (`ESPECIFICACION.md`).

| Fecha      | Tema                                     | Decisión                                                                                                                                                                                                                                                                      |
| ---------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-06 | Región de Supabase                       | `sa-east-1` (São Paulo), proyecto `todocopias-operaciones`.                                                                                                                                                                                                                   |
| 2026-11-07 | Base de datos del prototipo              | **Hasta terminar el prototipo no se usa Supabase.** Los datos viven en una base SQLite en la PC del local, con un servidor chico (`server/`). El iPad y el monitor se conectan por la red del local. El proyecto de Supabase queda creado, sin uso, para migrar más adelante. |
| 2026-11-07 | Títulos de los cuadrantes                | Se muestran como combinación de urgencia e importancia: "Urgente e importante", "No urgente e importante", "Urgente y no importante", "No urgente y no importante" (sin "Hacer / Planificar / Delegar / Eliminar").                                                           |
| 2026-11-07 | Disposición, umbrales y brillo del fondo | Valores por defecto de la especificación (urgente a la derecha, importante arriba; 2 h / hoy / 24 h / 72 h). El brillo celeste quedó más tenue para cumplir el contraste mínimo.                                                                                              |

| 2026-11-07 | Urgencia manual vs. automática (abierta 7) | Valor por defecto de la especificación: **manda la manual**. En el detalle, el slider muestra la urgencia efectiva y "Urgencia estimada: N"; "Volver a la automática" quita la manual. |
| 2026-11-07 | Nombres del equipo | No se precargan. Mientras no llegue Configuración (Fase 9), las personas se dan de alta con "+ Persona" desde el formulario de la tarea (iniciales automáticas). |
| 2026-11-07 | Atajos de entrega | "Hoy" y "Mañana" cambian el día y conservan la hora elegida (si no hay, proponen la próxima hora en punto). "+1 h / +2 h / +4 h" fijan la hora desde ahora, redondeada a los 15 minutos siguientes. No se asume un horario del local. |
| 2026-11-09 | Sin conexión (abierta 10) | Valor por defecto de la especificación: **se bloquea guardar** con un aviso amable. Lo que se esté cargando en un formulario no se pierde: queda ahí y se guarda cuando vuelve la conexión. |
| 2026-11-09 | Tiempo real local | Canal de avisos del servidor (`/api/cambios`, Server-Sent Events, sin dependencias). Latido cada 5 s; sin latido por 12 s se muestra "Sin conexión" y se reconecta. Al reconectar o volver de suspensión se trae todo de nuevo. |
| 2026-11-09 | Alta optimista | La tarea se ve en la matriz al instante (punteada, "guardando"). La pantalla genera el id y el servidor lo respeta, así nunca hay duplicados. Si el servidor la rechaza, desaparece y el formulario vuelve a abrirse con lo cargado y el motivo. |
| 2026-11-09 | Orden de trabajo (OT) | Pedido del usuario: dos botones para crear, **"+"** (tarea rápida, tecla N) y **"OT"** (tecla O). La OT replica la de papel del local: Fecha inicio, Fecha límite, Detalle (la primera línea es el título), recuadros Seña y Debe con POSNET · EFECTIVO · TRANSFERENCIA, Celular y Nombre; abajo, responsables e Importante Sí/No (lo que necesita la matriz). |
| 2026-11-09 | Medio de pago | Nuevos campos opcionales `sena_medio` y `saldo_medio` (posnet, efectivo, transferencia), también editables en el detalle. Migración local `0002`; la de Supabase queda escrita sin aplicar. |
| 2026-11-09 | Responsables de acceso rápido | Pedido del usuario: las personas aparecen ordenadas por la asignación más reciente, y "+ Persona" busca entre las existentes (sin importar mayúsculas ni tildes) y ofrece elegirla en vez de duplicarla. |
| 2026-11-09 | Atajos en todas las fechas | Pedido del usuario: Hoy, Mañana, +1 h, +2 h y +4 h en todos los campos de fecha (entrega, inicio, fecha límite). |
| 2026-11-09 | Arrastrar y soltar | Sin dependencias. Mouse: se levanta al mover; iPad: manteniendo presionado (350 ms). El tacho aparece abajo al centro solo mientras se arrastra. También se puede eliminar desde el detalle (mismo diálogo). Configuración (por ahora solo la Papelera) se abre con el engranaje discreto abajo a la derecha. |
| 2026-11-10 | Plantilla "Copiar mensaje" (abierta 8) | La de la especificación: _Hola {nombre}, tu trabajo "{trabajo}" ya está listo para retirar. Saldo pendiente: {saldo}._ Editable en Configuración, con vista previa y "Volver al mensaje original". |
| 2026-11-10 | Tareas internas (abierta 9) | Valor por defecto: al terminarlas pasan directo a "Terminadas hoy", sin "Entregada". |
| 2026-11-10 | Devolver al estado anterior | Siempre hacia atrás en el ciclo: entregada → terminada → el estado en curso que tenía (si `estado_anterior` ya no lo dice, sale del historial). Desde el menú, el detalle, el panel "Hechas hoy" o arrastrando un ítem del panel a la matriz. |
| 2026-11-10 | Dónde están Terminar y Entregada | En el menú de tres puntitos y en el detalle; la tarjeta azul de un pedido terminado muestra además el botón "Entregada". Ambos con confirmación. Al terminar un pedido, el aviso ofrece "Copiar mensaje". |
| 2026-11-10 | Panel "Hechas hoy" | En la PC aparece al acercar el mouse al borde derecho; en el iPad, deslizando desde el borde o con la pestaña casi transparente del borde derecho. Se reinicia al cambiar el día (hora de Buenos Aires). |
| 2026-11-10 | Copiar en el iPad | Desde el iPad por la red del local (http) el navegador no habilita el portapapeles moderno: se usa el método clásico como respaldo. |

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
