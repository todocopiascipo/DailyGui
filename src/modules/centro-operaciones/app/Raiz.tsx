/**
 * Contenedor raíz del módulo. Todo el estilo del módulo vive debajo de `.co-app`
 * para no afectar a otras herramientas de la suite.
 */
export function Raiz() {
  return (
    <div className="co-app co-fondo" data-testid="co-raiz">
      <main className="co:relative co:flex co:h-full co:items-center co:justify-center">
        {/* Marcador de la Fase 0: se reemplaza por la matriz en la Fase 2. */}
        <p className="co-etiqueta co:text-white/70">Centro de operaciones</p>
      </main>
    </div>
  )
}
