'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

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
  if (m < 1000) return `${Math.round(m)} metros`
  return `${(m / 1000).toFixed(1)} km`
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

// ========== COMPONENTE FIRMA ==========
function PadFirma({ onConfirmar, onLimpiar }: { onConfirmar: (blob: Blob) => void; onLimpiar?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dibujando, setDibujando] = useState(false)
  const [hayTrazo, setHayTrazo] = useState(false)

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const iniciar = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setDibujando(true)
    setHayTrazo(true)
  }

  const mover = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dibujando) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1E2A38'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const terminar = () => setDibujando(false)

  const limpiar = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHayTrazo(false)
    onLimpiar?.()
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
        <button onClick={limpiar}
          className="flex-1 py-2.5 rounded-md text-xs font-semibold uppercase tracking-wider"
          style={{ border: '1px solid var(--line)', color: 'var(--ink)', background: 'transparent' }}>
          Limpiar
        </button>
        <button onClick={confirmar} disabled={!hayTrazo}
          className="flex-1 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider text-white transition-opacity"
          style={{ background: hayTrazo ? 'var(--brand)' : 'var(--line)' }}>
          Confirmar firma
        </button>
      </div>
    </div>
  )
}

// ========== PÁGINA PRINCIPAL ==========
export default function DetalleClientePage() {
  const { lineaId } = useParams<{ lineaId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [linea, setLinea] = useState<any>(null)
  const [remitoActivo, setRemitoActivo] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [fichando, setFichando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertaFuera, setAlertaFuera] = useState<{ lat: number; lng: number; distancia: number } | null>(null)

  // Formulario retiro
  const [buenos, setBuenos] = useState(0)
  const [recuperar, setRecuperar] = useState(0)
  const [scrap, setScrap] = useState(0)
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [alertaSinFoto, setAlertaSinFoto] = useState(false)

  // Firma
  const [firmaNombre, setFirmaNombre] = useState('')
  const [subiendoFirma, setSubiendoFirma] = useState(false)

  const total = buenos + recuperar + scrap

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from('vale_lineas')
        .select(`
          id, cantidad_autorizada, cantidad_retirada, estado,
          clientes ( id, nombre, direccion, localidad, gps_lat, gps_lng, geocerca_radio ),
          vales ( id, numero )
        `)
        .eq('id', lineaId)
        .single()
      setLinea(data)

      const { data: remito } = await supabase
        .from('remitos')
        .select('id, fichada_entrada_at, geocerca_ok, cantidad_buenos, cantidad_recuperar, cantidad_scrap, cantidad_total, foto_url, firma_url, firma_nombre, estado')
        .eq('vale_linea_id', lineaId)
        .eq('estado', 'en_curso')
        .maybeSingle()

      // Si no hay en_curso, buscar firmado/no_conformado reciente (por si volvió atrás)
      if (!remito) {
        const { data: cerrado } = await supabase
          .from('remitos')
          .select('id, fichada_entrada_at, geocerca_ok, cantidad_buenos, cantidad_recuperar, cantidad_scrap, cantidad_total, foto_url, firma_url, firma_nombre, estado, fichada_salida_at')
          .eq('vale_linea_id', lineaId)
          .in('estado', ['firmado', 'no_conformado'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (cerrado && !cerrado.fichada_salida_at) {
          setRemitoActivo(cerrado)
        }
      } else {
        setRemitoActivo(remito)
      }

      if (remito && remito.cantidad_total > 0) {
        setBuenos(remito.cantidad_buenos || 0)
        setRecuperar(remito.cantidad_recuperar || 0)
        setScrap(remito.cantidad_scrap || 0)
      }
      if (remito?.firma_nombre) setFirmaNombre(remito.firma_nombre)
      setCargando(false)
    }
    cargar()
  }, [lineaId])

  // ========== FICHADA ==========
  async function crearRemito(lat: number, lng: number, geocercaOk: boolean) {
    const { data: { user } } = await supabase.auth.getUser()
    const anio = new Date().getFullYear()
    const { count } = await supabase.from('remitos').select('id', { count: 'exact', head: true })
    const numero = `REM-${anio}-${String((count ?? 0) + 1).padStart(4, '0')}`
    const { data: remito, error: err } = await supabase.from('remitos').insert({
      numero, vale_linea_id: lineaId, chofer_id: user!.id,
      estado: 'en_curso', gps_lat: lat, gps_lng: lng,
      geocerca_ok: geocercaOk, fichada_entrada_at: new Date().toISOString(),
    }).select().single()
    if (err) { setError(`No se pudo registrar la fichada: ${err.message}`); setFichando(false); return }
    setAlertaFuera(null); setRemitoActivo(remito); setFichando(false)
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

  // ========== RETIRO ==========
  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setFoto(f); setFotoPreview(URL.createObjectURL(f))
  }

  async function guardarRetiro(forzarSinFoto = false) {
    if (total === 0) { setError('Cargá al menos un pallet.'); return }
    const pendiente = linea.cantidad_autorizada - (linea.cantidad_retirada ?? 0)
    if (total > pendiente) { setError(`No podés retirar más de ${pendiente}.`); return }
    if (!foto && !forzarSinFoto && !remitoActivo?.foto_url) { setAlertaSinFoto(true); return }
    setError(null); setGuardando(true); setAlertaSinFoto(false)

    let fotoUrl = remitoActivo?.foto_url || null
    if (foto) {
      const blob = await comprimirFoto(foto)
      const path = `${remitoActivo.id}.jpg`
      const { error: upErr } = await supabase.storage.from('remito-fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) { setError(`Error foto: ${upErr.message}`); setGuardando(false); return }
      fotoUrl = supabase.storage.from('remito-fotos').getPublicUrl(path).data.publicUrl
    }

    const { error: updErr } = await supabase.from('remitos').update({
      cantidad_buenos: buenos, cantidad_recuperar: recuperar,
      cantidad_scrap: scrap, cantidad_total: total,
      ...(fotoUrl ? { foto_url: fotoUrl } : {}),
    }).eq('id', remitoActivo.id)
    if (updErr) { setError(`Error: ${updErr.message}`); setGuardando(false); return }
    setRemitoActivo({ ...remitoActivo, cantidad_total: total, cantidad_buenos: buenos, cantidad_recuperar: recuperar, cantidad_scrap: scrap, foto_url: fotoUrl })
    setGuardando(false)
  }

  // ========== FIRMA ==========
  async function confirmarFirma(blob: Blob) {
    setSubiendoFirma(true); setError(null)
    if (!firmaNombre.trim()) { setError('Ingresá el nombre de quien firma.'); setSubiendoFirma(false); return }

    const path = `${remitoActivo.id}.png`
    const { error: upErr } = await supabase.storage.from('remito-firmas').upload(path, blob, { contentType: 'image/png', upsert: true })
    if (upErr) { setError(`Error firma: ${upErr.message}`); setSubiendoFirma(false); return }
    const firmaUrl = supabase.storage.from('remito-firmas').getPublicUrl(path).data.publicUrl

    const { error: updErr } = await supabase.from('remitos').update({
      firma_url: firmaUrl, firma_nombre: firmaNombre.trim(), estado: 'firmado',
    }).eq('id', remitoActivo.id)
    if (updErr) { setError(`Error: ${updErr.message}`); setSubiendoFirma(false); return }
    setRemitoActivo({ ...remitoActivo, firma_url: firmaUrl, firma_nombre: firmaNombre.trim(), estado: 'firmado' })
    setSubiendoFirma(false)
  }

  async function marcarNoConformado() {
    setSubiendoFirma(true); setError(null)
    const { error: updErr } = await supabase.from('remitos').update({ estado: 'no_conformado' }).eq('id', remitoActivo.id)
    if (updErr) { setError(`Error: ${updErr.message}`); setSubiendoFirma(false); return }
    setRemitoActivo({ ...remitoActivo, estado: 'no_conformado' })
    setSubiendoFirma(false)
  }

  // ========== CERRAR VISITA ==========
  async function cerrarVisita() {
    setCerrando(true); setError(null)
    const ahora = new Date()
    const entrada = new Date(remitoActivo.fichada_entrada_at)
    const estadiaMin = Math.round((ahora.getTime() - entrada.getTime()) / 60000)

    const { error: err1 } = await supabase.from('remitos').update({
      fichada_salida_at: ahora.toISOString(), estadia_minutos: estadiaMin,
    }).eq('id', remitoActivo.id)
    if (err1) { setError(`Error: ${err1.message}`); setCerrando(false); return }

    const nuevaRetirada = (linea.cantidad_retirada ?? 0) + remitoActivo.cantidad_total
    const nuevoEstado = nuevaRetirada >= linea.cantidad_autorizada ? 'completa' : 'parcial'
    await supabase.from('vale_lineas').update({ cantidad_retirada: nuevaRetirada, estado: nuevoEstado }).eq('id', lineaId)

    if (linea.vales.id) {
      const { data: todasLineas } = await supabase.from('vale_lineas').select('estado').eq('vale_id', linea.vales.id)
      if (todasLineas) {
        const todas = todasLineas.every((l: any) => l.estado === 'completa')
        const alguna = todasLineas.some((l: any) => l.estado !== 'pendiente')
        await supabase.from('vales').update({ estado: todas ? 'completo' : alguna ? 'en_curso' : 'asignado' }).eq('id', linea.vales.id)
      }
    }
    router.push('/ruta'); router.refresh()
  }

  if (cargando) return <p className="text-sm p-4" style={{ color: 'var(--muted)' }}>Cargando…</p>
  if (!linea) return <p className="text-sm p-4" style={{ color: 'var(--muted)' }}>No se encontró el retiro.</p>

  const pendiente = linea.cantidad_autorizada - (linea.cantidad_retirada ?? 0)
  const retiroGuardado = remitoActivo?.cantidad_total > 0
  const firmaHecha = remitoActivo?.estado === 'firmado'
  const noConformado = remitoActivo?.estado === 'no_conformado'
  const listoParaCerrar = retiroGuardado && (firmaHecha || noConformado)
  const esperaFirma = retiroGuardado && !firmaHecha && !noConformado

  return (
    <div>
      <button onClick={() => router.push('/ruta')} className="text-xs uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>← Mi ruta</button>

      {/* Cabecera */}
      <div className="rounded-md p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
        <div className="text-xs font-mono mb-1" style={{ color: 'var(--muted)' }}>{linea.vales.numero}</div>
        <h2 className="text-xl font-medium tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: 'var(--ink)' }}>{linea.clientes.nombre}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {linea.clientes.direccion}{linea.clientes.localidad ? ` · ${linea.clientes.localidad}` : ''}
        </p>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-3xl font-medium" style={{ fontFamily: "'Fraunces', serif", color: 'var(--brand)' }}>{pendiente}</span>
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>pallets a retirar</span>
        </div>
      </div>

      {/* ===== FICHAR LLEGADA ===== */}
      {!remitoActivo && !alertaFuera && (
        <>
          <button onClick={ficharLlegada} disabled={fichando}
            className="w-full py-5 rounded-md text-base font-semibold uppercase tracking-wider text-white transition-opacity"
            style={{ background: 'var(--brand)', opacity: fichando ? 0.6 : 1 }}>
            {fichando ? 'Obteniendo ubicación…' : 'Fichar llegada'}
          </button>
          <p className="text-center text-xs mt-2" style={{ color: 'var(--muted)' }}>Registra hora · GPS · N° de orden</p>
        </>
      )}

      {/* ===== ALERTA GEOCERCA ===== */}
      {alertaFuera && (
        <div className="rounded-md overflow-hidden" style={{ border: '2px solid #B3261E' }}>
          <div className="p-4 text-center" style={{ background: '#B3261E' }}>
            <div className="text-3xl mb-1">⚠️</div>
            <div className="text-white font-bold text-base uppercase tracking-wide leading-snug">Usted no se encuentra<br />cerca del cliente</div>
            {alertaFuera.distancia >= 0 ? (
              <div className="text-white text-sm mt-2 opacity-90">Está a <b>{formatDistancia(alertaFuera.distancia)}</b> de {linea.clientes.nombre}</div>
            ) : (
              <div className="text-white text-sm mt-2 opacity-90">El cliente no tiene ubicación cargada</div>
            )}
          </div>
          <div className="p-4 flex flex-col gap-3" style={{ background: 'var(--surface)' }}>
            <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>La fichada quedará como <b>fuera de geocerca</b> y será visible en la auditoría.</p>
            <button onClick={() => crearRemito(alertaFuera.lat, alertaFuera.lng, false)}
              className="w-full py-4 rounded-md text-sm font-bold uppercase tracking-wider text-white" style={{ background: '#B3261E' }}>Avanzar igual</button>
            <button onClick={() => setAlertaFuera(null)}
              className="w-full py-3 rounded-md text-sm font-semibold uppercase tracking-wider" style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink)' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ===== FORMULARIO DE RETIRO ===== */}
      {remitoActivo && !retiroGuardado && (
        <div className="rounded-md p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: remitoActivo.geocerca_ok ? '#5D7040' : '#B3261E' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Llegada fichada</span>
            <span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>
              {new Date(remitoActivo.fichada_entrada_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
            </span>
          </div>

          <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Clasificación de pallets</div>
          <div className="flex flex-col gap-3 mb-4">
            {[
              { label: 'Buenos', color: '#5D7040', value: buenos, set: setBuenos },
              { label: 'A recuperar', color: '#C99031', value: recuperar, set: setRecuperar },
              { label: 'Scrap', color: '#B3261E', value: scrap, set: setScrap },
            ].map(({ label, color, value, set }) => (
              <div key={label} className="flex items-center justify-between rounded p-3" style={{ background: 'var(--bg)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
                </div>
                <div className="flex items-center gap-0">
                  <button onClick={() => set(Math.max(0, value - 1))}
                    className="w-11 h-11 rounded-l-md flex items-center justify-center text-xl font-bold text-white" style={{ background: 'var(--ink)' }}>−</button>
                  <input type="number" inputMode="numeric" value={value || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => { const v = parseInt(e.target.value) || 0; set(Math.max(0, Math.min(pendiente - (total - value), v))) }}
                    className="w-16 h-11 text-center text-lg font-semibold font-mono outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ background: '#fff', color: 'var(--ink)', border: 'none' }} />
                  <button onClick={() => set(Math.min(pendiente - (total - value), value + 1))}
                    className="w-11 h-11 rounded-r-md flex items-center justify-center text-xl font-bold text-white" style={{ background: 'var(--ink)' }}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded p-3 mb-4" style={{ background: total > 0 ? 'var(--ink)' : 'var(--bg)' }}>
            <span className="text-sm font-bold uppercase tracking-wider" style={{ color: total > 0 ? '#fff' : 'var(--muted)' }}>Total</span>
            <span className="text-2xl font-medium font-mono" style={{ fontFamily: "'Fraunces', serif", color: total > 0 ? '#fff' : 'var(--muted)' }}>
              {total} <span className="text-sm opacity-60">/ {pendiente}</span>
            </span>
          </div>

          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Foto del retiro (opcional)</div>
            {fotoPreview ? (
              <div className="relative">
                <img src={fotoPreview} alt="Foto" className="w-full rounded-md" style={{ maxHeight: '200px', objectFit: 'cover' }} />
                <button onClick={() => { setFoto(null); setFotoPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: 'rgba(0,0,0,0.6)' }}>✕</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-6 rounded-md text-sm font-semibold uppercase tracking-wider flex flex-col items-center gap-1"
                style={{ border: '2px dashed var(--line)', color: 'var(--muted)', background: 'var(--bg)' }}>
                <span className="text-2xl">📷</span>Sacar foto
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
          </div>

          {alertaSinFoto && (
            <div className="rounded-md overflow-hidden mb-4" style={{ border: '2px solid #B3261E' }}>
              <div className="p-4 text-center" style={{ background: '#B3261E' }}>
                <div className="text-3xl mb-1">📷</div>
                <div className="text-white font-bold text-base uppercase tracking-wide leading-snug">No adjuntó foto<br />del retiro</div>
              </div>
              <div className="p-4 flex flex-col gap-3" style={{ background: 'var(--surface-2, #97A3AA)' }}>
                <button onClick={() => guardarRetiro(true)}
                  className="w-full py-4 rounded-md text-sm font-bold uppercase tracking-wider text-white" style={{ background: '#B3261E' }}>Continuar sin foto</button>
                <button onClick={() => { setAlertaSinFoto(false); setTimeout(() => fileRef.current?.click(), 200) }}
                  className="w-full py-3 rounded-md text-sm font-semibold uppercase tracking-wider"
                  style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--ink)' }}>Volver y adjuntar foto</button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md text-center mb-3" style={{ background: '#FDECEA', border: '2px solid #B3261E' }}>
              <p className="text-sm font-bold uppercase tracking-wider" style={{ color: '#B3261E' }}>{error}</p>
            </div>
          )}

          {!alertaSinFoto && (
            <button onClick={() => guardarRetiro(false)} disabled={guardando}
              className="w-full py-4 rounded-md text-sm font-bold uppercase tracking-wider text-white transition-opacity"
              style={{ background: 'var(--brand)', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : 'Guardar retiro'}
            </button>
          )}
        </div>
      )}

      {/* ===== PASO 3: FIRMA DEL CLIENTE ===== */}
      {esperaFirma && (
        <div className="rounded-md p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#5D7040' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Retiro registrado — {remitoActivo.cantidad_total} pallets</span>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
            Buenos: {remitoActivo.cantidad_buenos} · A recuperar: {remitoActivo.cantidad_recuperar} · Scrap: {remitoActivo.cantidad_scrap}
          </p>

          <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
            Firma del responsable
          </div>

          <div className="mb-3">
            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Nombre de quien firma</label>
            <input type="text" value={firmaNombre} onChange={(e) => setFirmaNombre(e.target.value)} placeholder="Nombre y apellido"
              className="w-full px-3 py-2.5 rounded text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
          </div>

          {subiendoFirma ? (
            <div className="text-center py-4 text-sm" style={{ color: 'var(--muted)' }}>Guardando firma…</div>
          ) : (
            <PadFirma onConfirmar={confirmarFirma} />
          )}

          {error && (
            <div className="p-3 rounded-md text-center mt-3" style={{ background: '#FDECEA', border: '2px solid #B3261E' }}>
              <p className="text-sm font-bold" style={{ color: '#B3261E' }}>{error}</p>
            </div>
          )}

          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
            <button onClick={marcarNoConformado} disabled={subiendoFirma}
              className="w-full py-3 rounded-md text-xs font-semibold uppercase tracking-wider"
              style={{ background: 'transparent', border: '1px solid #B3261E', color: '#B3261E' }}>
              El cliente se niega a firmar
            </button>
            <p className="text-[10px] text-center mt-1.5" style={{ color: 'var(--muted)' }}>
              El retiro se registra como no conformado con la evidencia GPS y horaria.
            </p>
          </div>
        </div>
      )}

      {/* ===== PASO 4: CERRAR VISITA ===== */}
      {listoParaCerrar && (
        <div className="rounded-md p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: noConformado ? '#B3261E' : '#5D7040' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {noConformado ? 'Retiro no conformado' : 'Retiro firmado'} — {remitoActivo.cantidad_total} pallets
            </span>
          </div>
          <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
            Buenos: {remitoActivo.cantidad_buenos} · A recuperar: {remitoActivo.cantidad_recuperar} · Scrap: {remitoActivo.cantidad_scrap}
          </p>
          {remitoActivo.firma_nombre && (
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Firmó: {remitoActivo.firma_nombre}</p>
          )}
          {noConformado && (
            <div className="rounded p-2 mb-4 text-xs text-center font-semibold uppercase tracking-wider"
              style={{ background: '#FDECEA', color: '#B3261E' }}>
              Sin firma — registrado como no conformado
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md text-center mb-3" style={{ background: '#FDECEA', border: '2px solid #B3261E' }}>
              <p className="text-sm font-bold" style={{ color: '#B3261E' }}>{error}</p>
            </div>
          )}

          <button onClick={cerrarVisita} disabled={cerrando}
            className="w-full py-4 rounded-md text-sm font-bold uppercase tracking-wider text-white transition-opacity"
            style={{ background: 'var(--ink)', opacity: cerrando ? 0.6 : 1 }}>
            {cerrando ? 'Cerrando…' : 'Fichar salida y cerrar visita'}
          </button>
        </div>
      )}
    </div>
  )
}
