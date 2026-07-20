'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useOnline } from '@/lib/use-online'
import {
  guardarRutaLocal, leerRutaLocal,
  guardarRemitoLocal, leerRemitoLocal, borrarRemitoLocal,
  encolarAccion
} from '@/lib/offline-store'

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
function formatDistancia(m: number) {
  if (m < 1000) return Math.round(m) + ' metros'
  return (m / 1000).toFixed(1) + ' km'
}
function comprimirFoto(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 800
      let w = img.width, h = img.height
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.6)
    }
    img.src = URL.createObjectURL(file)
  })
}
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.readAsDataURL(blob)
  })
}
function PadFirma({ onConfirmar, onLimpiar }: { onConfirmar: (blob: Blob) => void; onLimpiar?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dibujando, setDibujando] = useState(false)
  const [hayTrazo, setHayTrazo] = useState(false)
  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }
  const iniciar = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    setDibujando(true); setHayTrazo(true)
  }
  const mover = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dibujando) return; e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = '#1E2A38'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke()
  }
  const terminar = () => setDibujando(false)
  const limpiar = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHayTrazo(false); onLimpiar?.()
  }
  const confirmar = () => {
    canvasRef.current!.toBlob((blob) => { if (blob) onConfirmar(blob) }, 'image/png')
  }
  return (
    <div>
      <canvas ref={canvasRef} width={320} height={140}
        className="w-full rounded-md touch-none"
        style={{ background: '#fff', border: '1px solid var(--line)', cursor: 'crosshair' }}
        onMouseDown={iniciar} onMouseMove={mover} onMouseUp={terminar} onMouseLeave={terminar}
        onTouchStart={iniciar} onTouchMove={mover} onTouchEnd={terminar} />
      <div className="flex gap-2 mt-2">
        <button onClick={limpiar} className="flex-1 py-2.5 rounded-md text-xs font-semibold uppercase tracking-wider" style={{ border: '1px solid var(--line)', color: 'var(--ink)', background: 'transparent' }}>Limpiar</button>
        <button onClick={confirmar} disabled={!hayTrazo} className="flex-1 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider text-white transition-opacity" style={{ background: hayTrazo ? 'var(--brand)' : 'var(--line)' }}>Confirmar firma</button>
      </div>
    </div>
  )
}
function VistaVisita({ linea, lineaId, supabase, online, onVolver }: { linea: any; lineaId: string; supabase: any; online: boolean; onVolver: () => void }) {
  const [remitoActivo, setRemitoActivo] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [fichando, setFichando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertaFuera, setAlertaFuera] = useState<{ lat: number; lng: number; distancia: number } | null>(null)
  const [buenos, setBuenos] = useState(0)
  const [recuperar, setRecuperar] = useState(0)
  const [scrap, setScrap] = useState(0)
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [alertaSinFoto, setAlertaSinFoto] = useState(false)
  const [firmaNombre, setFirmaNombre] = useState('')
  const [subiendoFirma, setSubiendoFirma] = useState(false)
  const [visitaCerrada, setVisitaCerrada] = useState(false)
  const [datosCierre, setDatosCierre] = useState<any>(null)
  const total = buenos + recuperar + scrap
  useEffect(() => { cargarRemito() }, [lineaId])
  async function cargarRemito() {
    if (navigator.onLine) {
      try {
        const { data: remito } = await supabase.from('remitos').select('id, fichada_entrada_at, geocerca_ok, cantidad_buenos, cantidad_recuperar, cantidad_scrap, cantidad_total, foto_url, firma_url, firma_nombre, estado, fichada_salida_at').eq('vale_linea_id', lineaId).eq('estado', 'en_curso').maybeSingle()
        if (!remito) {
          const { data: cerrado } = await supabase.from('remitos').select('id, fichada_entrada_at, geocerca_ok, cantidad_buenos, cantidad_recuperar, cantidad_scrap, cantidad_total, foto_url, firma_url, firma_nombre, estado, fichada_salida_at').eq('vale_linea_id', lineaId).in('estado', ['firmado', 'no_conformado']).order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (cerrado && !cerrado.fichada_salida_at) setRemitoActivo(cerrado)
        } else { setRemitoActivo(remito) }
        if (remito && remito.cantidad_total > 0) { setBuenos(remito.cantidad_buenos || 0); setRecuperar(remito.cantidad_recuperar || 0); setScrap(remito.cantidad_scrap || 0) }
        if (remito?.firma_nombre) setFirmaNombre(remito.firma_nombre)
        setCargando(false); return
      } catch (e) { console.warn('[visita] Error cargando del servidor:', e) }
    }
    try {
      const remitoLocal = await leerRemitoLocal(lineaId)
      if (remitoLocal) {
        setRemitoActivo(remitoLocal)
        if (remitoLocal.cantidad_total > 0) { setBuenos(remitoLocal.cantidad_buenos || 0); setRecuperar(remitoLocal.cantidad_recuperar || 0); setScrap(remitoLocal.cantidad_scrap || 0) }
        if (remitoLocal.firma_nombre) setFirmaNombre(remitoLocal.firma_nombre)
      }
    } catch (e) { console.warn('[visita] Error cargando local:', e) }
    setCargando(false)
  }
  async function crearRemito(lat: number, lng: number, geocercaOk: boolean) {
    const ahora = new Date().toISOString()
    if (online) {
      const { data: { user } } = await supabase.auth.getUser()
      const anio = new Date().getFullYear()
      const { count } = await supabase.from('remitos').select('id', { count: 'exact', head: true })
      const numero = 'REM-' + anio + '-' + String((count ?? 0) + 1).padStart(4, '0')
      const { data: remito, error: err } = await supabase.from('remitos').insert({ numero, vale_linea_id: lineaId, chofer_id: user!.id, estado: 'en_curso', gps_lat: lat, gps_lng: lng, geocerca_ok: geocercaOk, fichada_entrada_at: ahora }).select().single()
      if (err) { setError('No se pudo registrar la fichada: ' + err.message); setFichando(false); return }
      setAlertaFuera(null); setRemitoActivo(remito); setFichando(false)
    } else {
      const remitoLocal = { id: 'local-' + Date.now(), fichada_entrada_at: ahora, geocerca_ok: geocercaOk, gps_lat: lat, gps_lng: lng, estado: 'en_curso', cantidad_buenos: 0, cantidad_recuperar: 0, cantidad_scrap: 0, cantidad_total: 0, foto_url: null, firma_url: null, firma_nombre: null }
      await guardarRemitoLocal(lineaId, remitoLocal)
      await encolarAccion({ tipo: 'crear_remito', lineaId, datos: { gps_lat: lat, gps_lng: lng, geocerca_ok: geocercaOk, fichada_entrada_at: ahora }, creadoAt: ahora })
      setAlertaFuera(null); setRemitoActivo(remitoLocal); setFichando(false)
    }
  }
  async function ficharLlegada() {
    setError(null); setFichando(true)
    if (!navigator.geolocation) { setError('Este dispositivo no tiene GPS.'); setFichando(false); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude, cli = linea.clientes
        if (cli.gps_lat != null && cli.gps_lng != null) {
          const d = distanciaMetros(lat, lng, cli.gps_lat, cli.gps_lng)
          if (d <= (cli.geocerca_radio ?? 200)) { await crearRemito(lat, lng, true) }
          else { setAlertaFuera({ lat, lng, distancia: d }); setFichando(false) }
        } else { setAlertaFuera({ lat, lng, distancia: -1 }); setFichando(false) }
      },
      (geoErr) => { setError(geoErr.code === 1 ? 'Permiso de ubicación denegado.' : 'No se pudo obtener ubicación.'); setFichando(false) },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }
  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; setFoto(f); setFotoPreview(URL.createObjectURL(f)) }
  async function guardarRetiro(forzarSinFoto = false) {
    const pendiente = linea.cantidad_autorizada - (linea.cantidad_retirada ?? 0)
    if (total === 0) { setError('Carga al menos un pallet.'); return }
    if (total > pendiente) { setError('No podes retirar mas de ' + pendiente + '.'); return }
    if (!foto && !forzarSinFoto && !remitoActivo?.foto_url) { setAlertaSinFoto(true); return }
    setError(null); setGuardando(true); setAlertaSinFoto(false)
    if (online) {
      let fotoUrl = remitoActivo?.foto_url || null
      if (foto) {
        const blob = await comprimirFoto(foto)
        const path = remitoActivo.id + '.jpg'
        const { error: upErr } = await supabase.storage.from('remito-fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
        if (upErr) { setError('Error foto: ' + upErr.message); setGuardando(false); return }
        fotoUrl = supabase.storage.from('remito-fotos').getPublicUrl(path).data.publicUrl
      }
      const updateData: any = { cantidad_buenos: buenos, cantidad_recuperar: recuperar, cantidad_scrap: scrap, cantidad_total: total }
      if (fotoUrl) updateData.foto_url = fotoUrl
      const { error: updErr } = await supabase.from('remitos').update(updateData).eq('id', remitoActivo.id)
      if (updErr) { setError('Error: ' + updErr.message); setGuardando(false); return }
      setRemitoActivo({ ...remitoActivo, cantidad_total: total, cantidad_buenos: buenos, cantidad_recuperar: recuperar, cantidad_scrap: scrap, foto_url: fotoUrl })
    } else {
      let fotoBase64 = null
      if (foto) { const blob = await comprimirFoto(foto); fotoBase64 = await blobToBase64(blob) }
      const remitoLocal = { ...remitoActivo, cantidad_buenos: buenos, cantidad_recuperar: recuperar, cantidad_scrap: scrap, cantidad_total: total, fotoBase64 }
      await guardarRemitoLocal(lineaId, remitoLocal)
      await encolarAccion({ tipo: 'guardar_retiro', lineaId, datos: { buenos, recuperar, scrap, total, fotoBase64 }, creadoAt: new Date().toISOString() })
      setRemitoActivo(remitoLocal)
    }
    setGuardando(false)
  }
  async function confirmarFirma(blob: Blob) {
    setSubiendoFirma(true); setError(null)
    if (!firmaNombre.trim()) { setError('Ingresa el nombre de quien firma.'); setSubiendoFirma(false); return }
    if (online) {
      const path = remitoActivo.id + '.png'
      const { error: upErr } = await supabase.storage.from('remito-firmas').upload(path, blob, { contentType: 'image/png', upsert: true })
      if (upErr) { setError('Error firma: ' + upErr.message); setSubiendoFirma(false); return }
      const firmaUrl = supabase.storage.from('remito-firmas').getPublicUrl(path).data.publicUrl
      const { error: updErr } = await supabase.from('remitos').update({ firma_url: firmaUrl, firma_nombre: firmaNombre.trim(), estado: 'firmado' }).eq('id', remitoActivo.id)
      if (updErr) { setError('Error: ' + updErr.message); setSubiendoFirma(false); return }
      setRemitoActivo({ ...remitoActivo, firma_url: firmaUrl, firma_nombre: firmaNombre.trim(), estado: 'firmado' })
    } else {
      const firmaBase64 = await blobToBase64(blob)
      const remitoLocal = { ...remitoActivo, firma_nombre: firmaNombre.trim(), estado: 'firmado', firmaBase64 }
      await guardarRemitoLocal(lineaId, remitoLocal)
      await encolarAccion({ tipo: 'firmar', lineaId, datos: { firmaNombre: firmaNombre.trim(), firmaBase64 }, creadoAt: new Date().toISOString() })
      setRemitoActivo(remitoLocal)
    }
    setSubiendoFirma(false)
  }
  async function marcarNoConformado() {
    setSubiendoFirma(true); setError(null)
    if (online) {
      const { error: updErr } = await supabase.from('remitos').update({ estado: 'no_conformado' }).eq('id', remitoActivo.id)
      if (updErr) { setError('Error: ' + updErr.message); setSubiendoFirma(false); return }
    } else {
      const remitoLocal = { ...remitoActivo, estado: 'no_conformado' }
      await guardarRemitoLocal(lineaId, remitoLocal)
      await encolarAccion({ tipo: 'no_conformado', lineaId, datos: {}, creadoAt: new Date().toISOString() })
    }
    setRemitoActivo({ ...remitoActivo, estado: 'no_conformado' }); setSubiendoFirma(false)
  }
  async function cerrarVisita() {
    setCerrando(true); setError(null)
    const ahora = new Date()
    const entrada = new Date(remitoActivo.fichada_entrada_at)
    const estadiaMin = Math.round((ahora.getTime() - entrada.getTime()) / 60000)
    const nuevaRetirada = (linea.cantidad_retirada ?? 0) + remitoActivo.cantidad_total
    const nuevoEstadoLinea = nuevaRetirada >= linea.cantidad_autorizada ? 'completa' : 'parcial'
    if (online) {
      const { error: err1 } = await supabase.from('remitos').update({ fichada_salida_at: ahora.toISOString(), estadia_minutos: estadiaMin }).eq('id', remitoActivo.id)
      if (err1) { setError('Error: ' + err1.message); setCerrando(false); return }
      await supabase.from('vale_lineas').update({ cantidad_retirada: nuevaRetirada, estado: nuevoEstadoLinea }).eq('id', lineaId)
      if (linea.vales?.id) {
        const { data: todasLineas } = await supabase.from('vale_lineas').select('estado').eq('vale_id', linea.vales.id)
        if (todasLineas) {
          const todas = todasLineas.every((l: any) => l.estado === 'completa')
          const alguna = todasLineas.some((l: any) => l.estado !== 'pendiente')
          await supabase.from('vales').update({ estado: todas ? 'completo' : alguna ? 'en_curso' : 'asignado' }).eq('id', linea.vales.id)
        }
      }
      // --- Email al cliente ---
      if (linea.clientes?.contacto_email) {
        try {
          const { data: userData } = await supabase.auth.getUser()
          const { data: userProfile } = await supabase.from('users').select('nombre, transportista_id').eq('id', userData.user!.id).single()
          let transportistaNombre = ''
          if (userProfile?.transportista_id) { const { data: transp } = await supabase.from('transportistas').select('nombre').eq('id', userProfile.transportista_id).single(); transportistaNombre = transp?.nombre || '' }
          const { data: { session } } = await supabase.auth.getSession()
          fetch('/api/email-comprobante', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token
                ? { 'Authorization': 'Bearer ' + session.access_token }
                : {})
            },
            body: JSON.stringify({ clienteNombre: linea.clientes.nombre, clienteEmail: linea.clientes.contacto_email, choferNombre: userProfile?.nombre || '', transportistaNombre, valeNumero: linea.vales?.numero || '', cantidadBuenos: remitoActivo.cantidad_buenos, cantidadRecuperar: remitoActivo.cantidad_recuperar, cantidadScrap: remitoActivo.cantidad_scrap, cantidadTotal: remitoActivo.cantidad_total, cantidadAutorizada: linea.cantidad_autorizada, cantidadRetiradaAcumulada: nuevaRetirada, fichadaEntrada: remitoActivo.fichada_entrada_at, fichadaSalida: ahora.toISOString(), estadiaMinutos: estadiaMin, estado: remitoActivo.estado, firmaNombre: remitoActivo.firma_nombre })
          }).catch((emailErr) => console.warn('Email no enviado:', emailErr))
        } catch (emailErr) { console.warn('Email no enviado:', emailErr) }
      }
      // --- Guardar datos para pantalla de cierre ---
      setDatosCierre({
        clienteNombre: linea.clientes.nombre,
        cantidadTotal: remitoActivo.cantidad_total,
        cantidadBuenos: remitoActivo.cantidad_buenos,
        cantidadRecuperar: remitoActivo.cantidad_recuperar,
        cantidadScrap: remitoActivo.cantidad_scrap,
        estadiaMinutos: estadiaMin,
        estado: remitoActivo.estado,
        firmaNombre: remitoActivo.firma_nombre,
      })
      setVisitaCerrada(true)
    } else {
      let nuevoEstadoVale = null
      if (linea.vales?.id) {
        // Misma lógica que online: si esta línea queda completa y era la única pendiente, el vale pasa a completo
        nuevoEstadoVale = nuevoEstadoLinea === 'completa' ? 'parcial' : 'en_curso'
        // Nota: offline no podemos verificar las demás líneas, así que usamos 'parcial' como máximo.
        // El sync recalculará el estado correcto del vale al procesar la cola.
      }
      await encolarAccion({ tipo: 'cerrar_visita', lineaId, datos: { fichada_salida_at: ahora.toISOString(), estadia_minutos: estadiaMin, nueva_cantidad_retirada: nuevaRetirada, nuevo_estado_linea: nuevoEstadoLinea, vale_id: linea.vales?.id, nuevo_estado_vale: nuevoEstadoVale }, creadoAt: ahora.toISOString() })
      await borrarRemitoLocal(lineaId)
      setDatosCierre({
        clienteNombre: linea.clientes.nombre,
        cantidadTotal: remitoActivo.cantidad_total,
        cantidadBuenos: remitoActivo.cantidad_buenos,
        cantidadRecuperar: remitoActivo.cantidad_recuperar,
        cantidadScrap: remitoActivo.cantidad_scrap,
        estadiaMinutos: estadiaMin,
        estado: remitoActivo.estado,
        firmaNombre: remitoActivo.firma_nombre,
      })
      setVisitaCerrada(true)
    }
  }
  if (cargando) return <p className="text-sm p-4" style={{ color: 'var(--muted)' }}>Cargando...</p>

  // --- Pantalla post-cierre con botón WhatsApp ---
  if (visitaCerrada && datosCierre) {
    const whatsappTexto = [
      '\u{1F4CB} *Comprobante VaPal*',
      '',
      '\u{1F3E2} Cliente: ' + datosCierre.clienteNombre,
      '\u{1F4E6} Retirados: ' + datosCierre.cantidadTotal + ' pallets',
      '  \u2705 Buenos: ' + datosCierre.cantidadBuenos,
      '  \u{1F527} Recuperar: ' + datosCierre.cantidadRecuperar,
      '  \u274C Scrap: ' + datosCierre.cantidadScrap,
      '',
      '\u{1F4C5} ' + new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }),
      '\u23F1 Estadía: ' + datosCierre.estadiaMinutos + ' min',
      '',
      datosCierre.estado === 'no_conformado' ? '\u26A0\uFE0F Retiro NO conformado' : '\u2705 Firmado por: ' + datosCierre.firmaNombre,
      '',
      'Enviado desde VaPal'
    ].join('\n')
    const whatsappUrl = 'https://wa.me/?text=' + encodeURIComponent(whatsappTexto)
    return (
      <div>
        <div className="rounded-md p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-full" style={{ background: '#5D7040' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Visita cerrada</span>
          </div>
          <p className="text-sm mb-1" style={{ color: 'var(--ink)' }}>{datosCierre.clienteNombre} — {datosCierre.cantidadTotal} pallets retirados</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Estadía: {datosCierre.estadiaMinutos} min</p>
        </div>
        <div className="flex flex-col gap-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded text-white font-mono text-sm font-semibold uppercase tracking-wide"
            style={{ background: '#25D366' }}
          >
            Compartir por WhatsApp
          </a>
          <button onClick={onVolver} className="w-full py-3 rounded-md text-sm font-semibold uppercase tracking-wider" style={{ background: 'var(--ink)', color: '#fff' }}>
            Volver a mi ruta
          </button>
        </div>
      </div>
    )
  }

  const pendiente = linea.cantidad_autorizada - (linea.cantidad_retirada ?? 0)
  const retiroGuardado = remitoActivo?.cantidad_total > 0
  const firmaHecha = remitoActivo?.estado === 'firmado'
  const noConformado = remitoActivo?.estado === 'no_conformado'
  const listoParaCerrar = retiroGuardado && (firmaHecha || noConformado)
  const esperaFirma = retiroGuardado && !firmaHecha && !noConformado
  return (
    <div>
      <button onClick={onVolver} className="text-xs uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>&#8592; Mi ruta</button>
      {!online && (<div className="rounded-md p-3 mb-4 text-center text-xs font-semibold uppercase tracking-wider" style={{ background: '#FFF3E0', color: '#E65100', border: '1px solid #FFB74D' }}>Sin señal — los datos se guardarán localmente</div>)}
      <div className="rounded-md p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
        <div className="text-xs font-mono mb-1" style={{ color: 'var(--muted)' }}>{linea.vales?.numero}</div>
        <h2 className="text-xl font-medium tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: 'var(--ink)' }}>{linea.clientes.nombre}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{linea.clientes.direccion}{linea.clientes.localidad ? ' — ' + linea.clientes.localidad : ''}</p>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-3xl font-medium" style={{ fontFamily: "'Fraunces', serif", color: 'var(--brand)' }}>{pendiente}</span>
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>pallets a retirar</span>
        </div>
      </div>
      {!remitoActivo && !alertaFuera && (<><button onClick={ficharLlegada} disabled={fichando} className="w-full py-5 rounded-md text-base font-semibold uppercase tracking-wider text-white transition-opacity" style={{ background: 'var(--brand)', opacity: fichando ? 0.6 : 1 }}>{fichando ? 'Obteniendo ubicación...' : 'Fichar llegada'}</button><p className="text-center text-xs mt-2" style={{ color: 'var(--muted)' }}>Registra hora · GPS · N° de orden</p></>)}
      {alertaFuera && (<div className="rounded-md overflow-hidden" style={{ border: '2px solid #B3261E' }}><div className="p-4 text-center" style={{ background: '#B3261E' }}><div className="text-3xl mb-1">&#9888;&#65039;</div><div className="text-white font-bold text-base uppercase tracking-wide leading-snug">Usted no se encuentra<br />cerca del cliente</div>{alertaFuera.distancia >= 0 ? (<div className="text-white text-sm mt-2 opacity-90">Está a <b>{formatDistancia(alertaFuera.distancia)}</b> de {linea.clientes.nombre}</div>) : (<div className="text-white text-sm mt-2 opacity-90">El cliente no tiene ubicación cargada</div>)}</div><div className="p-4 flex flex-col gap-3" style={{ background: 'var(--surface)' }}><p className="text-xs text-center" style={{ color: 'var(--muted)' }}>La fichada quedará como <b>fuera de geocerca</b> y será visible en la auditoría.</p><button onClick={() => crearRemito(alertaFuera.lat, alertaFuera.lng, false)} className="w-full py-4 rounded-md text-sm font-bold uppercase tracking-wider text-white" style={{ background: '#B3261E' }}>Avanzar igual</button><button onClick={() => setAlertaFuera(null)} className="w-full py-3 rounded-md text-sm font-semibold uppercase tracking-wider" style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink)' }}>Cancelar</button></div></div>)}
      {remitoActivo && !retiroGuardado && (<div className="rounded-md p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}><div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--line)' }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: remitoActivo.geocerca_ok ? '#5D7040' : '#B3261E' }} /><span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Llegada fichada</span><span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>{new Date(remitoActivo.fichada_entrada_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</span></div><div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Clasificación de pallets</div><div className="flex flex-col gap-3 mb-4">{[{ label: 'Buenos', color: '#5D7040', value: buenos, set: setBuenos },{ label: 'A recuperar', color: '#C99031', value: recuperar, set: setRecuperar },{ label: 'Scrap', color: '#B3261E', value: scrap, set: setScrap }].map(({ label, color, value, set }) => (<div key={label} className="flex items-center justify-between rounded p-3" style={{ background: 'var(--bg)' }}><div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: color }} /><span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{label}</span></div><div className="flex items-center gap-0"><button onClick={() => set(Math.max(0, value - 1))} className="w-11 h-11 rounded-l-md flex items-center justify-center text-xl font-bold text-white" style={{ background: 'var(--ink)' }}>-</button><input type="number" inputMode="numeric" value={value || ''} onFocus={(e) => e.target.select()} onChange={(e) => { const v = parseInt(e.target.value) || 0; set(Math.max(0, Math.min(pendiente - (total - value), v))) }} className="w-16 h-11 text-center text-lg font-semibold font-mono outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" style={{ background: '#fff', color: 'var(--ink)', border: 'none' }} /><button onClick={() => set(Math.min(pendiente - (total - value), value + 1))} className="w-11 h-11 rounded-r-md flex items-center justify-center text-xl font-bold text-white" style={{ background: 'var(--ink)' }}>+</button></div></div>))}</div><div className="flex items-center justify-between rounded p-3 mb-4" style={{ background: total > 0 ? 'var(--ink)' : 'var(--bg)' }}><span className="text-sm font-bold uppercase tracking-wider" style={{ color: total > 0 ? '#fff' : 'var(--muted)' }}>Total</span><span className="text-2xl font-medium font-mono" style={{ fontFamily: "'Fraunces', serif", color: total > 0 ? '#fff' : 'var(--muted)' }}>{total} <span className="text-sm opacity-60">/ {pendiente}</span></span></div><div className="mb-4"><div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Foto del retiro (opcional)</div>{fotoPreview ? (<div className="relative"><img src={fotoPreview} alt="Foto" className="w-full rounded-md" style={{ maxHeight: '200px', objectFit: 'cover' }} /><button onClick={() => { setFoto(null); setFotoPreview(null); if (fileRef.current) fileRef.current.value = '' }} className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: 'rgba(0,0,0,0.6)' }}>X</button></div>) : (<button onClick={() => fileRef.current?.click()} className="w-full py-6 rounded-md text-sm font-semibold uppercase tracking-wider flex flex-col items-center gap-1" style={{ border: '2px dashed var(--line)', color: 'var(--muted)', background: 'var(--bg)' }}>Sacar foto</button>)}<input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" /></div>{alertaSinFoto && (<div className="rounded-md overflow-hidden mb-4" style={{ border: '2px solid #B3261E' }}><div className="p-4 text-center" style={{ background: '#B3261E' }}><div className="text-3xl mb-1">&#128247;</div><div className="text-white font-bold text-base uppercase tracking-wide leading-snug">No adjuntó foto<br />del retiro</div></div><div className="p-4 flex flex-col gap-3" style={{ background: 'var(--surface-2, #97A3AA)' }}><button onClick={() => guardarRetiro(true)} className="w-full py-4 rounded-md text-sm font-bold uppercase tracking-wider text-white" style={{ background: '#B3261E' }}>Continuar sin foto</button><button onClick={() => { setAlertaSinFoto(false); setTimeout(() => fileRef.current?.click(), 200) }} className="w-full py-3 rounded-md text-sm font-semibold uppercase tracking-wider" style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--ink)' }}>Volver y adjuntar foto</button></div></div>)}{error && (<div className="p-3 rounded-md text-center mb-3" style={{ background: '#FDECEA', border: '2px solid #B3261E' }}><p className="text-sm font-bold uppercase tracking-wider" style={{ color: '#B3261E' }}>{error}</p></div>)}{!alertaSinFoto && (<button onClick={() => guardarRetiro(false)} disabled={guardando} className="w-full py-4 rounded-md text-sm font-bold uppercase tracking-wider text-white transition-opacity" style={{ background: 'var(--brand)', opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando...' : 'Guardar retiro'}</button>)}</div>)}
      {esperaFirma && (<div className="rounded-md p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}><div className="flex items-center gap-2 mb-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#5D7040' }} /><span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Retiro registrado - {remitoActivo.cantidad_total} pallets</span></div><p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Buenos: {remitoActivo.cantidad_buenos} - A recuperar: {remitoActivo.cantidad_recuperar} - Scrap: {remitoActivo.cantidad_scrap}</p><div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>Firma del responsable</div><div className="mb-3"><label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Nombre de quien firma</label><input type="text" value={firmaNombre} onChange={(e) => setFirmaNombre(e.target.value)} placeholder="Nombre y apellido" className="w-full px-3 py-2.5 rounded text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} /></div>{subiendoFirma ? (<div className="text-center py-4 text-sm" style={{ color: 'var(--muted)' }}>Guardando firma...</div>) : (<PadFirma onConfirmar={confirmarFirma} />)}{error && (<div className="p-3 rounded-md text-center mt-3" style={{ background: '#FDECEA', border: '2px solid #B3261E' }}><p className="text-sm font-bold" style={{ color: '#B3261E' }}>{error}</p></div>)}<div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--line)' }}><button onClick={marcarNoConformado} disabled={subiendoFirma} className="w-full py-3 rounded-md text-xs font-semibold uppercase tracking-wider" style={{ background: 'transparent', border: '1px solid #B3261E', color: '#B3261E' }}>El cliente se niega a firmar</button><p className="text-[10px] text-center mt-1.5" style={{ color: 'var(--muted)' }}>El retiro se registra como no conformado con la evidencia GPS y horaria.</p></div></div>)}
      {listoParaCerrar && (<div className="rounded-md p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}><div className="flex items-center gap-2 mb-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: noConformado ? '#B3261E' : '#5D7040' }} /><span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{noConformado ? 'Retiro no conformado' : 'Retiro firmado'} - {remitoActivo.cantidad_total} pallets</span></div><p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Buenos: {remitoActivo.cantidad_buenos} - A recuperar: {remitoActivo.cantidad_recuperar} - Scrap: {remitoActivo.cantidad_scrap}</p>{remitoActivo.firma_nombre && (<p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Firmó: {remitoActivo.firma_nombre}</p>)}{noConformado && (<div className="rounded p-2 mb-4 text-xs text-center font-semibold uppercase tracking-wider" style={{ background: '#FDECEA', color: '#B3261E' }}>Sin firma - registrado como no conformado</div>)}{error && (<div className="p-3 rounded-md text-center mb-3" style={{ background: '#FDECEA', border: '2px solid #B3261E' }}><p className="text-sm font-bold" style={{ color: '#B3261E' }}>{error}</p></div>)}<button onClick={cerrarVisita} disabled={cerrando} className="w-full py-4 rounded-md text-sm font-bold uppercase tracking-wider text-white transition-opacity" style={{ background: 'var(--ink)', opacity: cerrando ? 0.6 : 1 }}>{cerrando ? 'Cerrando...' : 'Fichar salida y cerrar visita'}</button></div>)}
    </div>
  )
}
export default function RutaPage() {
  const supabase = createClient()
  const online = useOnline()
  const [lineas, setLineas] = useState<any[] | null>(null)
  const [visitaActiva, setVisitaActiva] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [origen, setOrigen] = useState<'servidor' | 'local' | null>(null)
  const [vista, setVista] = useState<'lista' | 'visita'>('lista')
  const [lineaSeleccionada, setLineaSeleccionada] = useState<any>(null)
  useEffect(() => { cargarRuta() }, [])
  useEffect(() => { if (online && origen === 'local') cargarRuta() }, [online])
  async function cargarRuta() {
    setCargando(true)
    if (navigator.onLine) {
      try {
        const datos = await cargarDesdeServidor()
        if (datos) { setLineas(datos.lineas); setVisitaActiva(datos.visitaActiva); setOrigen('servidor'); if (datos.lineas && datos.lineas.length > 0) await guardarRutaLocal(datos.lineas); setCargando(false); return }
      } catch (e) { console.warn('[ruta] Error cargando del servidor, intentando local:', e) }
    }
    try { const local = await leerRutaLocal(); if (local.length > 0) { setLineas(local); setOrigen('local') } else { setLineas([]); setOrigen('local') } } catch { setLineas([]); setOrigen('local') }
    setCargando(false)
  }
  async function cargarDesdeServidor() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: perfil } = await supabase.from('users').select('transportista_id').eq('id', user.id).single()
    if (!perfil) return null
    const { data: lineasDB } = await supabase.from('vale_lineas').select('id, cantidad_autorizada, cantidad_retirada, estado, orden_ruta, clientes ( id, nombre, direccion, localidad, gps_lat, gps_lng, geocerca_radio, contacto_email, contacto_nombre ), vales!inner ( id, numero, estado, transportista_id )').eq('vales.transportista_id', perfil.transportista_id).in('vales.estado', ['asignado', 'en_curso', 'parcial']).neq('estado', 'completa').order('orden_ruta', { ascending: true })
    let activa = null
    if (lineasDB && lineasDB.length > 0) {
      const lineaIds = lineasDB.map((l: any) => l.id)
      const { data: remitosEnCurso } = await supabase.from('remitos').select('id, vale_linea_id, fichada_entrada_at').in('vale_linea_id', lineaIds).eq('estado', 'en_curso').limit(1).maybeSingle()
      activa = remitosEnCurso
    }
    return { lineas: lineasDB || [], visitaActiva: activa }
  }
  function abrirVisita(linea: any) { setLineaSeleccionada(linea); setVista('visita') }
  function volverALista() { setVista('lista'); setLineaSeleccionada(null); cargarRuta() }
  const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  if (cargando) return <p className="text-sm p-4" style={{ color: 'var(--muted)' }}>Cargando ruta...</p>
  if (vista === 'visita' && lineaSeleccionada) return <VistaVisita linea={lineaSeleccionada} lineaId={lineaSeleccionada.id} supabase={supabase} online={online} onVolver={volverALista} />
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-medium tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: 'var(--ink)' }}>Mi ruta</h2>
        <p className="text-sm capitalize" style={{ color: 'var(--muted)' }}>{hoy}</p>
        {origen === 'local' && (<p className="text-[10px] font-mono uppercase tracking-wider mt-1" style={{ color: 'var(--amber, #C99031)' }}>Datos locales — se actualizará con señal</p>)}
      </div>
      {visitaActiva && (<div className="rounded-md p-3 mb-4 text-center text-xs font-semibold uppercase tracking-wider" style={{ background: '#FFF3E0', color: '#E65100', border: '1px solid #FFB74D' }}>Tenes una visita en curso - completala antes de pasar al siguiente cliente.</div>)}
      {(!lineas || lineas.length === 0) && (<div className="rounded-md p-10 text-center text-sm" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>No hay retiros asignados por ahora.</div>)}
      <div className="relative">
        {lineas && lineas.length > 1 && (<div className="absolute left-[19px] top-[40px] bottom-[40px] w-[2px]" style={{ background: 'var(--line)' }} />)}
        <div className="flex flex-col gap-0">
          {lineas?.map((linea: any, i: number) => {
            const pendiente = linea.cantidad_autorizada - (linea.cantidad_retirada ?? 0)
            const esActiva = visitaActiva?.vale_linea_id === linea.id
            const bloqueada = visitaActiva && !esActiva
            return (
              <div key={linea.id} className="relative flex gap-3 py-3">
                <div className="relative z-10 shrink-0 flex flex-col items-center"><div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: esActiva ? 'var(--brand)' : bloqueada ? 'var(--surface-2, #97A3AA)' : 'var(--ink)', color: '#fff', opacity: bloqueada ? 0.5 : 1 }}>{linea.orden_ruta ?? i + 1}</div></div>
                {esActiva ? (
                  <button onClick={() => abrirVisita(linea)} className="flex-1 text-left rounded-md p-4 transition-transform active:scale-[.98]" style={{ background: 'var(--surface)', border: '2px solid var(--brand)' }}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--brand)' }}>En curso</div><div className="font-semibold" style={{ color: 'var(--ink)' }}>{linea.clientes.nombre}</div><div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{linea.clientes.direccion}{linea.clientes.localidad ? ' — ' + linea.clientes.localidad : ''}</div><div className="text-xs mt-1 font-mono" style={{ color: 'var(--muted)' }}>{(linea.vales as any).numero}</div></div><div className="text-right shrink-0"><div className="text-2xl font-medium" style={{ fontFamily: "'Fraunces', serif", color: 'var(--brand)' }}>{pendiente}</div><div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>a retirar</div></div></div><div className="mt-3 py-2.5 rounded text-center text-xs font-bold uppercase tracking-wider text-white" style={{ background: 'var(--brand)' }}>Continuar visita</div></button>
                ) : bloqueada ? (
                  <div className="flex-1 rounded-md p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)', opacity: 0.45 }}><div className="flex items-start justify-between gap-3"><div><div className="font-semibold" style={{ color: 'var(--ink)' }}>{linea.clientes.nombre}</div><div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{linea.clientes.direccion}{linea.clientes.localidad ? ' — ' + linea.clientes.localidad : ''}</div></div><div className="text-right shrink-0"><div className="text-2xl font-medium" style={{ fontFamily: "'Fraunces', serif", color: 'var(--muted)' }}>{pendiente}</div><div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>a retirar</div></div></div></div>
                ) : (
                  <button onClick={() => abrirVisita(linea)} className="flex-1 text-left rounded-md p-4 transition-transform active:scale-[.98]" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}><div className="flex items-start justify-between gap-3"><div><div className="font-semibold" style={{ color: 'var(--ink)' }}>{linea.clientes.nombre}</div><div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{linea.clientes.direccion}{linea.clientes.localidad ? ' — ' + linea.clientes.localidad : ''}</div><div className="text-xs mt-1 font-mono" style={{ color: 'var(--muted)' }}>{(linea.vales as any).numero}</div></div><div className="text-right shrink-0"><div className="text-2xl font-medium" style={{ fontFamily: "'Fraunces', serif", color: 'var(--brand)' }}>{pendiente}</div><div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>a retirar</div></div></div>{linea.estado === 'parcial' && (<div className="mt-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--amber, #C99031)' }}>Retiro parcial — quedan {pendiente}</div>)}</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
