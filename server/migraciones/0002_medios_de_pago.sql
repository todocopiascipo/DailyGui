-- Medio de pago de la seña y del saldo, como en la orden de trabajo de papel
-- (POSNET · EFECTIVO · TRANSFERENCIA). Opcionales.
ALTER TABLE tareas ADD COLUMN sena_medio TEXT
  CHECK (sena_medio IN ('posnet', 'efectivo', 'transferencia'));
ALTER TABLE tareas ADD COLUMN saldo_medio TEXT
  CHECK (saldo_medio IN ('posnet', 'efectivo', 'transferencia'));

-- Papelera: búsqueda de vencidas para la purga automática.
CREATE INDEX IF NOT EXISTS tareas_papelera_idx ON tareas (eliminada_at)
  WHERE eliminada_at IS NOT NULL;
