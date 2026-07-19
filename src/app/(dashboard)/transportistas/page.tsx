'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const C = {
  ink: '#1E2A38',
  muted: '#4E5C68',
  steel: '#2E4A63',
  brand: '#C55A2F',
  olive: '#5D7040',
  bg: '#B4BEC4',
  surface: '#CDD5DA',
  line: '#8C99A1',
}

interface Camion {
  id: string
  patente: string
  descripcion: string
  capacidad_pallets: number | null
  activo: boolean
}

interface Transportista {
  id: string
  nombre: string
  cuit: string
  contacto_nombre: string
  contacto_telefono: string
  activo: boolean
  camiones: Camion[]
}

export default function TransportistasPage() {
  const [transportistas, setTransportistas] = useState<Transportista[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCamionForm, setShowCamionForm] = useState<string | null>(null)

  // Form state
  const [nombre, setNombre] = useState('')
  const [cuit, setCuit] = useState('')
  const [contactoNombre, setContactoNombre] = useState('')
  const [contactoTelefono, setContactoTelefono] = useState('')

  // Camión form state
  const [camPatente, setCamPatente] = useState('')
  const [camDescripcion, setCamDescripcion] = useState('')
  const [camCapacidad, setCamCapacidad] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function cargar() {
    const { data: trans } = await supabase
      .from('transportistas')
      .select('*')
      .order('nombre')

    if (trans) {
      // Cargar camiones para cada transportista
      const { data: camiones } = await supabase
        .from('camiones')
        .select('*')
        .order('patente')

      const result = trans.map(t => ({
        ...t,
        camiones: (camiones || []).filter(c => c.transportista_id === t.id),
      }))

      setTransportistas(result)
    }
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  function resetForm() {
    setNombre('')
    setCuit('')
    setContactoNombre('')
    setContactoTelefono('')
    setEditId(null)
    setShowForm(false)
    setError('')
  }

  function resetCamionForm() {
    setCamPatente('')
    setCamDescripcion('')
    setCamCapacidad('')
    setShowCamionForm(null)
    setError('')
  }

  function abrirEditar(t: Transportista) {
    setNombre(t.nombre)
    setCuit(t.cuit || '')
    setContactoNombre(t.contacto_nombre || '')
    setContactoTelefono(t.contacto_telefono || '')
    setEditId(t.id)
    setShowForm(true)
    setError('')
  }

  async function guardar() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }

    setSaving(true)
    setError('')

    const datos = {
      nombre: nombre.trim(),
      cuit: cuit.trim() || null,
      contacto_nombre: contactoNombre.trim() || null,
      contacto_telefono: contactoTelefono.trim() || null,
    }

    if (editId) {
      const { error: err } = await supabase
        .from('transportistas')
        .update(datos)
        .eq('id', editId)

      if (err) {
        setError('Error al actualizar: ' + err.message)
        setSaving(false)
        return
      }
    } else {
      // Obtener organization_id del usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('No hay sesión'); setSaving(false); return }

      const { data: profile } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile) { setError('No se encontró el perfil'); setSaving(false); return }

      const { error: err } = await supabase
        .from('transportistas')
        .insert({ ...datos, organization_id: profile.organization_id, activo: true })

      if (err) {
        setError('Error al crear: ' + err.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    resetForm()
    cargar()
  }

  async function toggleActivo(t: Transportista) {
    await supabase
      .from('transportistas')
      .update({ activo: !t.activo })
      .eq('id', t.id)
    cargar()
  }

  async function guardarCamion(transportistaId: string) {
    if (!camPatente.trim()) {
      setError('La patente es obligatoria')
      return
    }

    setSaving(true)
    setError('')

    const { error: err } = await supabase
      .from('camiones')
      .insert({
        transportista_id: transportistaId,
        patente: camPatente.trim().toUpperCase(),
        descripcion: camDescripcion.trim() || null,
        capacidad_pallets: camCapacidad ? parseInt(camCapacidad) : null,
        activo: true,
      })

    if (err) {
      setError('Error al agregar camión: ' + err.message)
      setSaving(false)
      return
    }

    setSaving(false)
    resetCamionForm()
    cargar()
  }

  async function toggleCamionActivo(camion: Camion) {
    await supabase
      .from('camiones')
      .update({ activo: !camion.activo })
      .eq('id', camion.id)
    cargar()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: C.muted }}>Cargando transportistas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider font-mono" style={{ color: C.muted }}>
            Administración
          </p>
          <h1 className="text-2xl font-semibold" style={{ color: C.ink }}>
            Transportistas
          </h1>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="px-3 py-2 rounded text-sm font-semibold text-white"
            style={{ background: C.brand }}
          >
            + Nuevo transportista
          </button>
        )}
      </div>

      {/* Formulario (crear / editar) */}
      {showForm && (
        <div className="rounded p-4 space-y-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <h3 className="font-semibold text-sm" style={{ color: C.ink }}>
            {editId ? 'Editar transportista' : 'Nuevo transportista'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                Nombre *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Rutas del Litoral"
                className="w-full px-3 py-2 rounded text-sm border outline-none"
                style={{ background: '#fff', borderColor: C.line, color: C.ink }}
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                CUIT
              </label>
              <input
                type="text"
                value={cuit}
                onChange={e => setCuit(e.target.value)}
                placeholder="Ej: 30-12345678-9"
                className="w-full px-3 py-2 rounded text-sm border outline-none"
                style={{ background: '#fff', borderColor: C.line, color: C.ink }}
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                Contacto
              </label>
              <input
                type="text"
                value={contactoNombre}
                onChange={e => setContactoNombre(e.target.value)}
                placeholder="Nombre de la persona de contacto"
                className="w-full px-3 py-2 rounded text-sm border outline-none"
                style={{ background: '#fff', borderColor: C.line, color: C.ink }}
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                Teléfono
              </label>
              <input
                type="text"
                value={contactoTelefono}
                onChange={e => setContactoTelefono(e.target.value)}
                placeholder="Ej: +54 11 2345-6789"
                className="w-full px-3 py-2 rounded text-sm border outline-none"
                style={{ background: '#fff', borderColor: C.line, color: C.ink }}
              />
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: '#c53030' }}>{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={saving}
              className="px-4 py-2 rounded text-sm font-semibold text-white transition-opacity"
              style={{ background: C.brand, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded text-sm border"
              style={{ borderColor: C.line, color: C.muted }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {transportistas.length === 0 ? (
        <div className="text-center py-12">
          <p style={{ color: C.muted }}>No hay transportistas cargados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transportistas.map(t => (
            <div
              key={t.id}
              className="rounded overflow-hidden"
              style={{ background: C.surface, border: `1px solid ${C.line}40` }}
            >
              {/* Fila principal */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: t.activo ? C.ink : C.muted }}>
                        {t.nombre}
                      </span>
                      {!t.activo && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: `${C.line}40`, color: C.muted }}>
                          Inactivo
                        </span>
                      )}
                    </div>
                    {t.cuit && (
                      <p className="font-mono text-xs mt-0.5" style={{ color: C.muted }}>{t.cuit}</p>
                    )}
                    {(t.contacto_nombre || t.contacto_telefono) && (
                      <p className="text-sm mt-1" style={{ color: C.muted }}>
                        {[t.contacto_nombre, t.contacto_telefono].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="text-xs mt-1 font-mono" style={{ color: C.muted }}>
                      {t.camiones.filter(c => c.activo).length} camión{t.camiones.filter(c => c.activo).length !== 1 ? 'es' : ''}
                    </p>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                      className="px-2 py-1 rounded text-xs border"
                      style={{ borderColor: C.line, color: C.muted }}
                    >
                      {expandedId === t.id ? 'Cerrar' : 'Camiones'}
                    </button>
                    <button
                      onClick={() => abrirEditar(t)}
                      className="px-2 py-1 rounded text-xs border"
                      style={{ borderColor: C.line, color: C.steel }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActivo(t)}
                      className="px-2 py-1 rounded text-xs border"
                      style={{
                        borderColor: C.line,
                        color: t.activo ? C.brand : C.olive,
                      }}
                    >
                      {t.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Camiones (expandible) */}
              {expandedId === t.id && (
                <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: `${C.line}40` }}>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-mono uppercase tracking-wider" style={{ color: C.muted }}>
                        Camiones
                      </p>
                      <button
                        onClick={() => {
                          resetCamionForm()
                          setShowCamionForm(showCamionForm === t.id ? null : t.id)
                        }}
                        className="text-xs font-semibold"
                        style={{ color: C.brand }}
                      >
                        + Agregar
                      </button>
                    </div>

                    {/* Form agregar camión */}
                    {showCamionForm === t.id && (
                      <div className="rounded p-3 mb-3 space-y-2" style={{ background: C.bg }}>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={camPatente}
                            onChange={e => setCamPatente(e.target.value)}
                            placeholder="Patente *"
                            className="px-2 py-1.5 rounded text-sm border outline-none"
                            style={{ background: '#fff', borderColor: C.line, color: C.ink }}
                          />
                          <input
                            type="text"
                            value={camDescripcion}
                            onChange={e => setCamDescripcion(e.target.value)}
                            placeholder="Descripción"
                            className="px-2 py-1.5 rounded text-sm border outline-none"
                            style={{ background: '#fff', borderColor: C.line, color: C.ink }}
                          />
                          <input
                            type="number"
                            value={camCapacidad}
                            onChange={e => setCamCapacidad(e.target.value)}
                            placeholder="Capacidad"
                            className="px-2 py-1.5 rounded text-sm border outline-none"
                            style={{ background: '#fff', borderColor: C.line, color: C.ink }}
                          />
                        </div>
                        {error && <p className="text-xs" style={{ color: '#c53030' }}>{error}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => guardarCamion(t.id)}
                            disabled={saving}
                            className="px-3 py-1.5 rounded text-xs font-semibold text-white"
                            style={{ background: C.brand, opacity: saving ? 0.6 : 1 }}
                          >
                            Guardar
                          </button>
                          <button
                            onClick={resetCamionForm}
                            className="px-3 py-1.5 rounded text-xs border"
                            style={{ borderColor: C.line, color: C.muted }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Lista de camiones */}
                    {t.camiones.length === 0 ? (
                      <p className="text-sm" style={{ color: C.muted }}>Sin camiones cargados</p>
                    ) : (
                      <div className="space-y-1">
                        {t.camiones.map(cam => (
                          <div
                            key={cam.id}
                            className="flex items-center justify-between py-1.5 px-2 rounded text-sm"
                            style={{ background: cam.activo ? C.bg : `${C.bg}80` }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-semibold" style={{ color: cam.activo ? C.ink : C.muted }}>
                                {cam.patente}
                              </span>
                              {cam.descripcion && (
                                <span style={{ color: C.muted }}>{cam.descripcion}</span>
                              )}
                              {cam.capacidad_pallets && (
                                <span className="font-mono text-xs" style={{ color: C.muted }}>
                                  {cam.capacidad_pallets} pallets
                                </span>
                              )}
                              {!cam.activo && (
                                <span className="text-xs" style={{ color: C.muted }}>(inactivo)</span>
                              )}
                            </div>
                            <button
                              onClick={() => toggleCamionActivo(cam)}
                              className="text-xs"
                              style={{ color: cam.activo ? C.brand : C.olive }}
                            >
                              {cam.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
