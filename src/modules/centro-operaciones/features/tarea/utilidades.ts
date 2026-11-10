import { useEffect, useState } from 'react'
import type { BorradorCliente, MedioPago } from './borrador'
import { buscarClientes } from './datos'
import type { Cliente } from './tipos'

/** Para comparar nombres sin importar mayúsculas ni tildes. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

/** Como en la orden de trabajo de papel: POSNET · EFECTIVO · TRANSFERENCIA. */
export const MEDIOS_PAGO: { valor: MedioPago; texto: string }[] = [
  { valor: 'posnet', texto: 'Posnet' },
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transferencia' },
]

/** Clientes ya cargados con ese teléfono (si el cliente todavía no está vinculado). */
export function useClientesPorTelefono(valor: BorradorCliente): Cliente[] {
  // Resultado de la última búsqueda, junto con el teléfono buscado.
  const [busqueda, setBusqueda] = useState<{ telefono: string; clientes: Cliente[] } | null>(null)
  const telefono = valor.telefono.trim()
  const buscar = !valor.id && telefono.length >= 6

  useEffect(() => {
    if (!buscar) return
    let vigente = true
    const espera = setTimeout(() => {
      buscarClientes(telefono)
        .then((clientes) => vigente && setBusqueda({ telefono, clientes }))
        .catch(() => vigente && setBusqueda(null))
    }, 350)
    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [telefono, buscar])

  return buscar && busqueda?.telefono === telefono ? busqueda.clientes : []
}
