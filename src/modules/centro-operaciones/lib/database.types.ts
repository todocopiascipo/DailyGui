// Archivo GENERADO desde el esquema de Supabase. No editar a mano:
// regenerarlo después de cada migración.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      categorias: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          nombre: string
          orden: number
          tipo_aplica: Database['public']['Enums']['tipo_categoria']
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          tipo_aplica?: Database['public']['Enums']['tipo_categoria']
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          tipo_aplica?: Database['public']['Enums']['tipo_categoria']
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          id: string
          nombre_apellido: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre_apellido: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre_apellido?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          clave: string
          created_at: string
          updated_at: string
          valor: Json
        }
        Insert: {
          clave: string
          created_at?: string
          updated_at?: string
          valor: Json
        }
        Update: {
          clave?: string
          created_at?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      eventos: {
        Row: {
          accion: string
          cambios: Json
          created_at: string
          id: string
          persona_id: string | null
          proyecto_id: string | null
          tarea_id: string | null
          updated_at: string
        }
        Insert: {
          accion: string
          cambios?: Json
          created_at?: string
          id?: string
          persona_id?: string | null
          proyecto_id?: string | null
          tarea_id?: string | null
          updated_at?: string
        }
        Update: {
          accion?: string
          cambios?: Json
          created_at?: string
          id?: string
          persona_id?: string | null
          proyecto_id?: string | null
          tarea_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'eventos_persona_id_fkey'
            columns: ['persona_id']
            isOneToOne: false
            referencedRelation: 'personas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'eventos_proyecto_id_fkey'
            columns: ['proyecto_id']
            isOneToOne: false
            referencedRelation: 'proyectos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'eventos_tarea_id_fkey'
            columns: ['tarea_id']
            isOneToOne: false
            referencedRelation: 'tareas'
            referencedColumns: ['id']
          },
        ]
      }
      personas: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          iniciales: string | null
          nombre: string
          orden: number
          tiene_pin: boolean
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          iniciales?: string | null
          nombre: string
          orden?: number
          tiene_pin?: boolean
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          iniciales?: string | null
          nombre?: string
          orden?: number
          tiene_pin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      proyectos: {
        Row: {
          categoria_id: string | null
          created_at: string
          descripcion: string | null
          estado: Database['public']['Enums']['estado_proyecto']
          fecha_inicio: string | null
          fecha_objetivo: string | null
          id: string
          nombre: string
          orden: number
          responsable_id: string | null
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database['public']['Enums']['estado_proyecto']
          fecha_inicio?: string | null
          fecha_objetivo?: string | null
          id?: string
          nombre: string
          orden?: number
          responsable_id?: string | null
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database['public']['Enums']['estado_proyecto']
          fecha_inicio?: string | null
          fecha_objetivo?: string | null
          id?: string
          nombre?: string
          orden?: number
          responsable_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'proyectos_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'proyectos_responsable_id_fkey'
            columns: ['responsable_id']
            isOneToOne: false
            referencedRelation: 'personas'
            referencedColumns: ['id']
          },
        ]
      }
      subtareas: {
        Row: {
          created_at: string
          duracion_min: number | null
          hecha: boolean
          hecha_at: string | null
          id: string
          inicio_estimado: string | null
          orden: number
          responsable_id: string | null
          tarea_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duracion_min?: number | null
          hecha?: boolean
          hecha_at?: string | null
          id?: string
          inicio_estimado?: string | null
          orden?: number
          responsable_id?: string | null
          tarea_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duracion_min?: number | null
          hecha?: boolean
          hecha_at?: string | null
          id?: string
          inicio_estimado?: string | null
          orden?: number
          responsable_id?: string | null
          tarea_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subtareas_responsable_id_fkey'
            columns: ['responsable_id']
            isOneToOne: false
            referencedRelation: 'personas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subtareas_tarea_id_fkey'
            columns: ['tarea_id']
            isOneToOne: false
            referencedRelation: 'tareas'
            referencedColumns: ['id']
          },
        ]
      }
      tarea_responsables: {
        Row: {
          created_at: string
          persona_id: string
          tarea_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          persona_id: string
          tarea_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          persona_id?: string
          tarea_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tarea_responsables_persona_id_fkey'
            columns: ['persona_id']
            isOneToOne: false
            referencedRelation: 'personas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tarea_responsables_tarea_id_fkey'
            columns: ['tarea_id']
            isOneToOne: false
            referencedRelation: 'tareas'
            referencedColumns: ['id']
          },
        ]
      }
      tareas: {
        Row: {
          actualizada_por: string | null
          categoria_id: string | null
          cliente_id: string | null
          creada_por: string | null
          created_at: string
          descripcion: string | null
          eliminada_at: string | null
          eliminada_por: string | null
          entregada_at: string | null
          estado: Database['public']['Enums']['estado_tarea']
          estado_anterior: Database['public']['Enums']['estado_tarea'] | null
          fecha_entrega: string | null
          fecha_inicio: string | null
          id: string
          importante: boolean
          mostrar_en_matriz: boolean
          motivo_espera: Database['public']['Enums']['motivo_espera'] | null
          motivo_espera_detalle: string | null
          proyecto_id: string | null
          saldo: number
          saldo_medio: Database['public']['Enums']['medio_pago'] | null
          sena: number
          sena_medio: Database['public']['Enums']['medio_pago'] | null
          terminada_at: string | null
          tipo: Database['public']['Enums']['tipo_tarea']
          titulo: string
          updated_at: string
          urgencia_manual: number | null
        }
        Insert: {
          actualizada_por?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          creada_por?: string | null
          created_at?: string
          descripcion?: string | null
          eliminada_at?: string | null
          eliminada_por?: string | null
          entregada_at?: string | null
          estado?: Database['public']['Enums']['estado_tarea']
          estado_anterior?: Database['public']['Enums']['estado_tarea'] | null
          fecha_entrega?: string | null
          fecha_inicio?: string | null
          id?: string
          importante: boolean
          mostrar_en_matriz?: boolean
          motivo_espera?: Database['public']['Enums']['motivo_espera'] | null
          motivo_espera_detalle?: string | null
          proyecto_id?: string | null
          saldo?: number
          saldo_medio?: Database['public']['Enums']['medio_pago'] | null
          sena?: number
          sena_medio?: Database['public']['Enums']['medio_pago'] | null
          terminada_at?: string | null
          tipo?: Database['public']['Enums']['tipo_tarea']
          titulo: string
          updated_at?: string
          urgencia_manual?: number | null
        }
        Update: {
          actualizada_por?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          creada_por?: string | null
          created_at?: string
          descripcion?: string | null
          eliminada_at?: string | null
          eliminada_por?: string | null
          entregada_at?: string | null
          estado?: Database['public']['Enums']['estado_tarea']
          estado_anterior?: Database['public']['Enums']['estado_tarea'] | null
          fecha_entrega?: string | null
          fecha_inicio?: string | null
          id?: string
          importante?: boolean
          mostrar_en_matriz?: boolean
          motivo_espera?: Database['public']['Enums']['motivo_espera'] | null
          motivo_espera_detalle?: string | null
          proyecto_id?: string | null
          saldo?: number
          saldo_medio?: Database['public']['Enums']['medio_pago'] | null
          sena?: number
          sena_medio?: Database['public']['Enums']['medio_pago'] | null
          terminada_at?: string | null
          tipo?: Database['public']['Enums']['tipo_tarea']
          titulo?: string
          updated_at?: string
          urgencia_manual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'tareas_actualizada_por_fkey'
            columns: ['actualizada_por']
            isOneToOne: false
            referencedRelation: 'personas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tareas_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tareas_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tareas_creada_por_fkey'
            columns: ['creada_por']
            isOneToOne: false
            referencedRelation: 'personas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tareas_eliminada_por_fkey'
            columns: ['eliminada_por']
            isOneToOne: false
            referencedRelation: 'personas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tareas_proyecto_id_fkey'
            columns: ['proyecto_id']
            isOneToOne: false
            referencedRelation: 'proyectos'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      estado_proyecto: 'activo' | 'en_pausa' | 'terminado' | 'cancelado'
      medio_pago: 'posnet' | 'efectivo' | 'transferencia'
      estado_tarea:
        'pendiente' | 'en_proceso' | 'en_espera' | 'terminada' | 'entregada' | 'cancelada'
      motivo_espera: 'archivo_cliente' | 'material' | 'pago' | 'proveedor' | 'otro'
      tipo_categoria: 'pedido' | 'interna' | 'ambos'
      tipo_tarea: 'pedido' | 'interna'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_proyecto: ['activo', 'en_pausa', 'terminado', 'cancelado'],
      medio_pago: ['posnet', 'efectivo', 'transferencia'],
      estado_tarea: ['pendiente', 'en_proceso', 'en_espera', 'terminada', 'entregada', 'cancelada'],
      motivo_espera: ['archivo_cliente', 'material', 'pago', 'proveedor', 'otro'],
      tipo_categoria: ['pedido', 'interna', 'ambos'],
      tipo_tarea: ['pedido', 'interna'],
    },
  },
} as const
