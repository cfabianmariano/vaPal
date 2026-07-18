// ========== SINCRONIZACIÓN OFFLINE → SUPABASE ==========
// Procesa la cola de acciones pendientes cuando hay conexión

import { createClient } from '@/lib/supabase-browser'
import { leerCola, borrarAccion, borrarRemitoLocal, type AccionPendiente } from './offline-store'

export async function sincronizar(): Promise<{ ok: number; errores: number }> {
  if (!navigator.onLine) return { ok: 0, errores: 0 }

  const cola = await leerCola()
  if (cola.length === 0) return { ok: 0, errores: 0 }

  const supabase = createClient()
  let ok = 0
  let errores = 0

  for (const accion of cola) {
    try {
      const exito = await procesarAccion(supabase, accion)
      if (exito) {
        await borrarAccion(accion.id!)
        ok++
      } else {
        errores++
      }
    } catch (e) {
      console.error('[sync] Error procesando acción:', accion, e)
      errores++
    }
  }

  return { ok, errores }
}

async function procesarAccion(supabase: any, accion: AccionPendiente): Promise<boolean> {
  const d = accion.datos

  switch (accion.tipo) {
    case 'crear_remito': {
      // Verificar si ya existe (por si se sincronizó parcialmente)
      const { data: existente } = await supabase
        .from('remitos')
        .select('id')
        .eq('vale_linea_id', accion.lineaId)
        .eq('estado', 'en_curso')
        .maybeSingle()
      if (existente) return true // Ya existe, marcar como OK

      const { data: { user } } = await supabase.auth.getUser()
      const anio = new Date().getFullYear()
      const { count } = await supabase.from('remitos').select('id', { count: 'exact', head: true })
      const numero = `REM-${anio}-${String((count ?? 0) + 1).padStart(4, '0')}`

      const { error } = await supabase.from('remitos').insert({
        numero,
        vale_linea_id: accion.lineaId,
        chofer_id: user!.id,
        estado: 'en_curso',
        gps_lat: d.gps_lat,
        gps_lng: d.gps_lng,
        geocerca_ok: d.geocerca_ok,
        fichada_entrada_at: d.fichada_entrada_at,
        offline: true,
      }).select().single()

      return !error
    }

    case 'guardar_retiro': {
      const { data: remito } = await supabase
        .from('remitos')
        .select('id')
        .eq('vale_linea_id', accion.lineaId)
        .in('estado', ['en_curso'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!remito) return false

      // Subir foto si hay
      let fotoUrl = null
      if (d.fotoBase64) {
        const blob = base64ToBlob(d.fotoBase64, 'image/jpeg')
        const path = `${remito.id}.jpg`
        await supabase.storage.from('remito-fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
        fotoUrl = supabase.storage.from('remito-fotos').getPublicUrl(path).data.publicUrl
      }

      const { error } = await supabase.from('remitos').update({
        cantidad_buenos: d.buenos,
        cantidad_recuperar: d.recuperar,
        cantidad_scrap: d.scrap,
        cantidad_total: d.total,
        ...(fotoUrl ? { foto_url: fotoUrl } : {}),
      }).eq('id', remito.id)

      return !error
    }

    case 'firmar': {
      const { data: remito } = await supabase
        .from('remitos')
        .select('id')
        .eq('vale_linea_id', accion.lineaId)
        .in('estado', ['en_curso'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!remito) return false

      // Subir firma
      let firmaUrl = null
      if (d.firmaBase64) {
        const blob = base64ToBlob(d.firmaBase64, 'image/png')
        const path = `${remito.id}.png`
        await supabase.storage.from('remito-firmas').upload(path, blob, { contentType: 'image/png', upsert: true })
        firmaUrl = supabase.storage.from('remito-firmas').getPublicUrl(path).data.publicUrl
      }

      const { error } = await supabase.from('remitos').update({
        firma_url: firmaUrl,
        firma_nombre: d.firmaNombre,
        estado: 'firmado',
      }).eq('id', remito.id)

      return !error
    }

    case 'no_conformado': {
      const { data: remito } = await supabase
        .from('remitos')
        .select('id')
        .eq('vale_linea_id', accion.lineaId)
        .in('estado', ['en_curso'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!remito) return false

      const { error } = await supabase.from('remitos').update({
        estado: 'no_conformado',
      }).eq('id', remito.id)

      return !error
    }

    case 'cerrar_visita': {
      const { data: remito } = await supabase
        .from('remitos')
        .select('id, fichada_entrada_at')
        .eq('vale_linea_id', accion.lineaId)
        .in('estado', ['firmado', 'no_conformado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!remito) return false

      const { error: err1 } = await supabase.from('remitos').update({
        fichada_salida_at: d.fichada_salida_at,
        estadia_minutos: d.estadia_minutos,
      }).eq('id', remito.id)
      if (err1) return false

      const { error: err2 } = await supabase.from('vale_lineas').update({
        cantidad_retirada: d.nueva_cantidad_retirada,
        estado: d.nuevo_estado_linea,
      }).eq('id', accion.lineaId)
      if (err2) return false

      if (d.vale_id && d.nuevo_estado_vale) {
        await supabase.from('vales').update({
          estado: d.nuevo_estado_vale,
        }).eq('id', d.vale_id)
      }

      await borrarRemitoLocal(accion.lineaId)
      return true
    }

    default:
      return false
  }
}

function base64ToBlob(base64: string, type: string): Blob {
  const byteChars = atob(base64)
  const byteArrays = []
  for (let i = 0; i < byteChars.length; i += 512) {
    const slice = byteChars.slice(i, i + 512)
    const byteNums = new Array(slice.length)
    for (let j = 0; j < slice.length; j++) {
      byteNums[j] = slice.charCodeAt(j)
    }
    byteArrays.push(new Uint8Array(byteNums))
  }
  return new Blob(byteArrays, { type })
}
