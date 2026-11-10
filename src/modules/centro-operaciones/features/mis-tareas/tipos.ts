import type { PersonaBreve, TareaMatriz } from '../matriz/tipos'

/** Un paso (subtarea) de una tarea, con quién lo hace. */
export interface Paso {
  id: string
  titulo: string
  hecha: boolean
  responsable: PersonaBreve | null
}

export interface TareaMia extends TareaMatriz {
  pasos: Paso[]
}
