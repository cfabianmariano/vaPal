export type UserRole = 'dueno' | 'intermediario' | 'transportista_admin' | 'chofer'
export type ValeEstado = 'sin_asignar' | 'asignado' | 'en_curso' | 'parcial' | 'completo' | 'cerrado' | 'revertido'
export type ValeLineaEstado = 'pendiente' | 'parcial' | 'completa'
export type RemitoEstado = 'firmado' | 'no_conformado'
export interface Organization {
  id: string; nombre: string; cuit: string | null; created_at: string
  dias_vencimiento_default: number
}
export interface User {
  id: string; organization_id: string; role: UserRole; nombre: string
  email: string; telefono: string | null; transportista_id: string | null
  activo: boolean; created_at: string
}
export interface Transportista {
  id: string; organization_id: string; nombre: string; cuit: string | null
  contacto_nombre: string | null; contacto_telefono: string | null
  activo: boolean; created_at: string
}
export interface Camion {
  id: string; transportista_id: string; patente: string
  descripcion: string | null; capacidad_pallets: number | null
  activo: boolean; created_at: string
}
export interface Cliente {
  id: string; organization_id: string; nombre: string
  direccion: string | null; localidad: string | null; provincia: string | null
  gps_lat: number | null; gps_lng: number | null; geocerca_radio: number
  contacto_nombre: string | null; contacto_email: string | null
  contacto_telefono: string | null; codigo_erp: string | null
  activo: boolean; created_at: string
}
export interface Vale {
  id: string; numero: string; organization_id: string
  transportista_id: string | null; camion_id: string | null
  estado: ValeEstado; created_by: string | null; fecha_creacion: string
  fecha_cierre: string | null; fecha_vencimiento: string | null
  notas: string | null
}
export interface ValeLinea {
  id: string; vale_id: string; cliente_id: string
  cantidad_autorizada: number; cantidad_retirada: number
  estado: ValeLineaEstado; orden_ruta: number | null; created_at: string
}
export interface ValeEvento {
  id: string; vale_id: string; estado_anterior: string | null
  estado_nuevo: string; user_id: string | null; notas: string | null
  created_at: string
}
export interface Remito {
  id: string; numero: string; vale_linea_id: string; chofer_id: string
  cantidad_buenos: number; cantidad_recuperar: number; cantidad_scrap: number
  cantidad_total: number; foto_url: string | null; firma_url: string | null
  firma_nombre: string | null; estado: RemitoEstado; geocerca_ok: boolean | null
  gps_lat: number | null; gps_lng: number | null
  fichada_entrada_at: string | null; fichada_salida_at: string | null
  estadia_minutos: number | null; offline: boolean; synced_at: string | null
  created_at: string
}
// Vista vieja — mantener para compatibilidad
export interface CuentaCorriente {
  cliente_id: string; organization_id: string; cliente_nombre: string
  total_despachados: number; total_retirados: number; saldo_deuda: number
}
// Vista nueva — BLOQUE 0: incluye reservado y disponible
export interface CuentaCorrienteCompleta {
  cliente_id: string; organization_id: string; cliente_nombre: string
  codigo_erp: string | null; deuda_total: number; cantidad_retirada: number
  saldo_pendiente: number; cantidad_reservada: number; cantidad_disponible: number
  fecha_mas_antigua: string | null
}
// ============================================================
// AGREGAR al final de src/types/database.ts
// ============================================================

export type HojaRutaEstado = 'borrador' | 'definitiva' | 'en_ejecucion' | 'finalizada'

export interface HojaRuta {
  id: string
  organization_id: string
  transportista_id: string
  chofer_id: string
  camion_id: string | null
  fecha: string
  estado: HojaRutaEstado
  notas: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface HojaRutaVisita {
  id: string
  hoja_ruta_id: string
  cliente_id: string
  cantidad_planificada: number
  cantidad_retirada: number
  orden: number
  estado: 'pendiente' | 'en_curso' | 'completada' | 'saltada'
  notas: string | null
}

export interface HojaImputacion {
  id: string
  visita_id: string
  vale_linea_id: string
  cantidad_imputada: number
}

export interface ValeLineaPlanificable {
  vale_linea_id: string
  vale_id: string
  cliente_id: string
  organization_id: string
  transportista_id: string
  vale_numero: string
  fecha_vencimiento: string | null
  cantidad_autorizada: number
  cantidad_retirada: number
  pendiente: number
  reservado_en_hojas: number
  planificable: number
}
// ============================================================
// AGREGAR al final de src/types/database.ts
// ============================================================

export type HojaRutaEstado = 'borrador' | 'definitiva' | 'en_ejecucion' | 'finalizada'

export interface HojaRuta {
  id: string
  organization_id: string
  transportista_id: string
  chofer_id: string
  camion_id: string | null
  fecha: string
  estado: HojaRutaEstado
  notas: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface HojaRutaVisita {
  id: string
  hoja_ruta_id: string
  cliente_id: string
  cantidad_planificada: number
  cantidad_retirada: number
  orden: number
  estado: 'pendiente' | 'en_curso' | 'completada' | 'saltada'
  notas: string | null
}

export interface HojaImputacion {
  id: string
  visita_id: string
  vale_linea_id: string
  cantidad_imputada: number
}

export interface ValeLineaPlanificable {
  vale_linea_id: string
  vale_id: string
  cliente_id: string
  organization_id: string
  transportista_id: string
  vale_numero: string
  fecha_vencimiento: string | null
  cantidad_autorizada: number
  cantidad_retirada: number
  pendiente: number
  reservado_en_hojas: number
  planificable: number
}
