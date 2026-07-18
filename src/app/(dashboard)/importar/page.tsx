'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import * as XLSX from 'xlsx'

interface FilaPreview {
  fecha: string
  codigo_cliente: string
  cliente_nombre?: string
  cliente_id?: string
  codigo_producto: string
  producto_desc?: string
  producto_id?: string
  cantidad: number
  pallets: number
  referencia: string
  ok: boolean
  error?: string
}

export default function ImportarPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [filas, setFilas] = useState<FilaPreview[]>([])
  const [archivo, setArchivo] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: number; err: number; importacionId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { cargarBase() }, [])

  async function cargarBase() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data: profile } = await supabase.from('users').select('organization_id').eq('id', userData.user.id).single()
    if (!profile) return
    setOrgId(profile.organization_id)
    const { data: cli } = await supabase.from('clientes').select('id, nombre, codigo_erp').eq('organization_id', profile.organization_id)
    const { data: prod } = await supabase.from('productos_retornables').select('id, codigo_producto, descripcion, pallets_por_unidad').eq('organization_id', profile.organization_id)
    setClientes(cli || [])
    setProductos(prod || [])
  }

  function procesarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivo(file.name)
    setResultado(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (rows.length === 0) { setError('El archivo está vacío.'); return }

        // Detectar columnas (flexible)
        const colMap = detectarColumnas(Object.keys(rows[0]))
        if (!colMap) {
          setError('No se reconocen las columnas. El archivo debe tener: fecha, cliente (código ERP), producto, cantidad. Opcionalmente: referencia.')
          return
        }

        const preview: FilaPreview[] = rows.map((row, i) => {
          const codCli = String(row[colMap.cliente] || '').trim()
          const codProd = String(row[colMap.producto] || '').trim()
          const cant = parseFloat(row[colMap.cantidad]) || 0
          const ref = colMap.referencia ? String(row[colMap.referencia] || '').trim() : ''
          let fechaRaw = row[colMap.fecha]
          let fecha = ''
          if (fechaRaw instanceof Date) {
            fecha = fechaRaw.toISOString().split('T')[0]
          } else {
            fecha = String(fechaRaw || '').trim()
          }

          const cli = clientes.find(c => c.codigo_erp === codCli)
          const prod = productos.find(p => p.codigo_producto === codProd)

          const errores: string[] = []
          if (!fecha) errores.push('sin fecha')
          if (!codCli) errores.push('sin cliente')
          if (!cli) errores.push('cliente no encontrado')
          if (!codProd) errores.push('sin producto')
          if (!prod) errores.push('producto no retornable')
          if (cant <= 0) errores.push('cantidad inválida')

          return {
            fecha,
            codigo_cliente: codCli,
            cliente_nombre: cli?.nombre,
            cliente_id: cli?.id,
            codigo_producto: codProd,
            producto_desc: prod?.descripcion,
            producto_id: prod?.id,
            cantidad: cant,
            pallets: cant * (prod?.pallets_por_unidad || 1),
            referencia: ref,
            ok: errores.length === 0,
            error: errores.length > 0 ? errores.join(', ') : undefined,
          }
        })

        setFilas(preview)
      } catch (err) {
        setError('Error leyendo el archivo. Verificá que sea CSV o Excel válido.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function detectarColumnas(headers: string[]): { fecha: string; cliente: string; producto: string; cantidad: string; referencia?: string } | null {
    const lower = headers.map(h => ({ orig: h, low: h.toLowerCase().trim() }))
    const fecha = lower.find(h => ['fecha', 'date', 'fecha_despacho', 'fecha despacho'].includes(h.low))
    const cliente = lower.find(h => ['cliente', 'codigo_cliente', 'cod_cliente', 'codigo cliente', 'client', 'customer', 'codigo_erp'].includes(h.low))
    const producto = lower.find(h => ['producto', 'codigo_producto', 'cod_producto', 'codigo producto', 'product', 'sku', 'codigo', 'código'].includes(h.low))
    const cantidad = lower.find(h => ['cantidad', 'qty', 'quantity', 'cant', 'unidades'].includes(h.low))
    const referencia = lower.find(h => ['referencia', 'remito', 'factura', 'ref', 'nro_remito', 'comprobante', 'reference'].includes(h.low))
    if (!fecha || !cliente || !producto || !cantidad) return null
    return { fecha: fecha.orig, cliente: cliente.orig, producto: producto.orig, cantidad: cantidad.orig, referencia: referencia?.orig }
  }

  async function confirmarImportacion() {
    const validas = filas.filter(f => f.ok)
    if (validas.length === 0) { setError('No hay filas válidas para importar.'); return }
    setImportando(true); setError(null)

    const { data: userData } = await supabase.auth.getUser()

    // Crear registro de importación
    const { data: imp, error: impErr } = await supabase.from('importaciones').insert({
      organization_id: orgId,
      archivo_nombre: archivo,
      registros_total: filas.length,
      registros_procesados: validas.length,
      registros_error: filas.length - validas.length,
      created_by: userData.user!.id,
    }).select('id').single()

    if (impErr) { setError('Error creando importación: ' + impErr.message); setImportando(false); return }

    // Insertar despachos
    const despachos = validas.map(f => ({
      organization_id: orgId,
      cliente_id: f.cliente_id,
      fecha: f.fecha,
      producto_id: f.producto_id,
      cantidad: f.cantidad,
      cantidad_pallets: f.pallets,
      referencia_erp: f.referencia || null,
      importacion_id: imp.id,
    }))

    const { error: despErr } = await supabase.from('despachos').insert(despachos)
    if (despErr) { setError('Error insertando despachos: ' + despErr.message); setImportando(false); return }

    setResultado({ ok: validas.length, err: filas.length - validas.length, importacionId: imp.id })
    setImportando(false)
  }

  function limpiar() {
    setFilas([]); setArchivo(null); setResultado(null); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const validas = filas.filter(f => f.ok)
  const invalidas = filas.filter(f => !f.ok)
  const totalPallets = validas.reduce((sum, f) => sum + f.pallets, 0)

  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight mb-1" style={{ fontFamily: "'Fraunces', serif", color: 'var(--ink)' }}>
        Importar despachos del ERP
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Subí un archivo CSV o Excel con los despachos. El sistema cruza los códigos de cliente y producto con los que ya están cargados.
      </p>

      {/* Resultado */}
      {resultado && (
        <div className="rounded-md p-5 mb-6 text-center" style={{ background: '#E8F5E9', border: '1px solid #81C784' }}>
          <div className="text-3xl mb-2">✓</div>
          <div className="text-lg font-semibold" style={{ color: '#2E7D32' }}>Importación completa</div>
          <p className="text-sm mt-1" style={{ color: '#4E5C68' }}>
            {resultado.ok} despachos importados · {resultado.err > 0 ? resultado.err + ' filas con error' : 'sin errores'}
          </p>
          <button onClick={limpiar} className="mt-4 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-white"
            style={{ background: 'var(--brand)' }}>
            Importar otro archivo
          </button>
        </div>
      )}

      {!resultado && (
        <>
          {/* Info formato */}
          <div className="rounded-md p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Formato esperado</div>
            <p className="text-sm mb-2" style={{ color: 'var(--ink)' }}>
              El archivo debe tener estas columnas (el nombre es flexible):
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th className="text-left py-1.5 px-2 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Columna</th>
                    <th className="text-left py-1.5 px-2 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Ejemplo</th>
                    <th className="text-left py-1.5 px-2 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(140,153,161,0.3)' }}><td className="py-1.5 px-2 font-mono">fecha</td><td className="py-1.5 px-2">2026-07-15</td><td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>Fecha del despacho</td></tr>
                  <tr style={{ borderBottom: '1px solid rgba(140,153,161,0.3)' }}><td className="py-1.5 px-2 font-mono">cliente</td><td className="py-1.5 px-2">CLI-001</td><td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>Código ERP del cliente</td></tr>
                  <tr style={{ borderBottom: '1px solid rgba(140,153,161,0.3)' }}><td className="py-1.5 px-2 font-mono">producto</td><td className="py-1.5 px-2">PAL-001</td><td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>Código de producto retornable</td></tr>
                  <tr style={{ borderBottom: '1px solid rgba(140,153,161,0.3)' }}><td className="py-1.5 px-2 font-mono">cantidad</td><td className="py-1.5 px-2">50</td><td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>Unidades despachadas</td></tr>
                  <tr><td className="py-1.5 px-2 font-mono">referencia</td><td className="py-1.5 px-2">REM-4521</td><td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>Opcional — N° remito/factura</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
              Productos retornables configurados: <strong>{productos.length}</strong> · Clientes con código ERP: <strong>{clientes.filter(c => c.codigo_erp).length}</strong>
            </p>
          </div>

          {/* Subir archivo */}
          {filas.length === 0 && (
            <div>
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-8 rounded-md text-sm font-semibold uppercase tracking-wider flex flex-col items-center gap-2"
                style={{ border: '2px dashed var(--line)', color: 'var(--muted)', background: 'var(--surface)' }}>
                <span className="text-3xl">📄</span>
                Seleccionar archivo CSV o Excel
              </button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={procesarArchivo} className="hidden" />
            </div>
          )}

          {/* Preview */}
          {filas.length > 0 && !resultado && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  Previsualización — <span className="font-mono">{archivo}</span>
                </div>
                <button onClick={limpiar} className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>
                  Cambiar archivo
                </button>
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded p-3 text-center" style={{ background: 'var(--surface)' }}>
                  <div className="text-xl font-medium font-mono" style={{ color: 'var(--ink)' }}>{filas.length}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Total filas</div>
                </div>
                <div className="rounded p-3 text-center" style={{ background: '#E8F5E9' }}>
                  <div className="text-xl font-medium font-mono" style={{ color: '#2E7D32' }}>{validas.length}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: '#4E5C68' }}>Válidas</div>
                </div>
                <div className="rounded p-3 text-center" style={{ background: invalidas.length > 0 ? '#FFF3E0' : 'var(--surface)' }}>
                  <div className="text-xl font-medium font-mono" style={{ color: invalidas.length > 0 ? '#E65100' : 'var(--muted)' }}>{invalidas.length}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Con error</div>
                </div>
                <div className="rounded p-3 text-center" style={{ background: 'var(--surface)' }}>
                  <div className="text-xl font-medium font-mono" style={{ color: 'var(--brand)' }}>{totalPallets}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Pallets</div>
                </div>
              </div>

              {/* Errores primero */}
              {invalidas.length > 0 && (
                <div className="rounded-md p-3 mb-4" style={{ background: '#FFF3E0', border: '1px solid #FFB74D' }}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#E65100' }}>
                    Filas con error (no se importarán)
                  </div>
                  {invalidas.slice(0, 10).map((f, i) => (
                    <div key={i} className="text-xs py-1" style={{ color: '#BF360C', borderBottom: '1px solid rgba(255,183,77,0.4)' }}>
                      <span className="font-mono">{f.codigo_cliente || '?'}</span> · <span className="font-mono">{f.codigo_producto || '?'}</span> · {f.error}
                    </div>
                  ))}
                  {invalidas.length > 10 && (
                    <div className="text-xs mt-1" style={{ color: '#E65100' }}>…y {invalidas.length - 10} más</div>
                  )}
                </div>
              )}

              {/* Tabla preview */}
              <div className="overflow-x-auto rounded-md mb-4" style={{ border: '1px solid var(--line)' }}>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
                      <th className="text-left py-2 px-2 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}></th>
                      <th className="text-left py-2 px-2 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Fecha</th>
                      <th className="text-left py-2 px-2 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Cliente</th>
                      <th className="text-left py-2 px-2 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Producto</th>
                      <th className="text-right py-2 px-2 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Cant</th>
                      <th className="text-right py-2 px-2 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Pallets</th>
                      <th className="text-left py-2 px-2 font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validas.slice(0, 20).map((f, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(140,153,161,0.2)' }}>
                        <td className="py-1.5 px-2" style={{ color: '#5D7040' }}>✓</td>
                        <td className="py-1.5 px-2 font-mono" style={{ color: 'var(--ink)' }}>{f.fecha}</td>
                        <td className="py-1.5 px-2" style={{ color: 'var(--ink)' }}>{f.cliente_nombre || f.codigo_cliente}</td>
                        <td className="py-1.5 px-2" style={{ color: 'var(--ink)' }}>{f.producto_desc || f.codigo_producto}</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: 'var(--ink)' }}>{f.cantidad}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-semibold" style={{ color: 'var(--brand)' }}>{f.pallets}</td>
                        <td className="py-1.5 px-2 font-mono" style={{ color: 'var(--muted)' }}>{f.referencia || '—'}</td>
                      </tr>
                    ))}
                    {validas.length > 20 && (
                      <tr><td colSpan={7} className="py-2 px-2 text-center" style={{ color: 'var(--muted)' }}>…y {validas.length - 20} filas más</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="p-3 rounded-md text-center mb-3" style={{ background: '#FDECEA', border: '2px solid #B3261E' }}>
                  <p className="text-sm font-bold" style={{ color: '#B3261E' }}>{error}</p>
                </div>
              )}

              {validas.length > 0 && (
                <button onClick={confirmarImportacion} disabled={importando}
                  className="w-full py-4 rounded-md text-sm font-bold uppercase tracking-wider text-white transition-opacity"
                  style={{ background: 'var(--brand)', opacity: importando ? 0.6 : 1 }}>
                  {importando ? 'Importando…' : 'Confirmar importación — ' + validas.length + ' despachos · ' + totalPallets + ' pallets'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
