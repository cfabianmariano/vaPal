'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import * as XLSX from 'xlsx'

interface FilaPreview {
  fecha: string; codigo_cliente: string; cliente_nombre?: string; cliente_id?: string
  codigo_producto: string; producto_desc?: string; producto_id?: string
  cantidad: number; pallets: number; referencia: string; ok: boolean; error?: string
}

export default function ImportarPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [refExistentes, setRefExistentes] = useState<Set<string>>(new Set())
  const [filas, setFilas] = useState<FilaPreview[]>([])
  const [archivo, setArchivo] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: number; err: number; dup: number; importacionId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { cargarBase() }, [])

  async function cargarBase() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data: profile } = await supabase.from('users').select('organization_id').eq('id', userData.user.id).single()
    if (!profile) return
    setOrgId(profile.organization_id)
    const [cli, prod, refs] = await Promise.all([
      supabase.from('clientes').select('id, nombre, codigo_erp').eq('organization_id', profile.organization_id),
      supabase.from('productos_retornables').select('id, codigo_producto, descripcion, pallets_por_unidad').eq('organization_id', profile.organization_id),
      supabase.from('despachos').select('referencia_erp').eq('organization_id', profile.organization_id).not('referencia_erp', 'is', null),
    ])
    setClientes(cli.data || [])
    setProductos(prod.data || [])
    setRefExistentes(new Set((refs.data || []).map((r: any) => r.referencia_erp)))
  }

  function procesarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setArchivo(file.name); setResultado(null); setError(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (rows.length === 0) { setError('El archivo está vacío.'); return }
        const colMap = detectarColumnas(Object.keys(rows[0]))
        if (!colMap) { setError('No se reconocen las columnas. El archivo debe tener: fecha, cliente, producto, cantidad.'); return }

        // Track refs within this file to detect intra-file duplicates
        const refsEnArchivo = new Set<string>()

        const preview: FilaPreview[] = rows.map((row) => {
          const codCli = String(row[colMap.cliente] || '').trim()
          const codProd = String(row[colMap.producto] || '').trim()
          const cant = parseFloat(row[colMap.cantidad]) || 0
          const ref = colMap.referencia ? String(row[colMap.referencia] || '').trim() : ''
          let fechaRaw = row[colMap.fecha]; let fecha = ''
          if (fechaRaw instanceof Date) { fecha = fechaRaw.toISOString().split('T')[0] } else { fecha = String(fechaRaw || '').trim() }
          const cli = clientes.find(c => c.codigo_erp === codCli)
          const prod = productos.find(p => p.codigo_producto === codProd)
          const errores: string[] = []
          if (!fecha) errores.push('sin fecha')
          if (!codCli) errores.push('sin cliente')
          if (!cli) errores.push('cliente no encontrado')
          if (!codProd) errores.push('sin producto')
          if (!prod) errores.push('producto no retornable')
          if (cant <= 0) errores.push('cantidad inválida')

          // Check for duplicate referencia_erp
          if (ref) {
            if (refExistentes.has(ref)) {
              errores.push('ya importado')
            } else if (refsEnArchivo.has(ref)) {
              errores.push('duplicado en archivo')
            } else {
              refsEnArchivo.add(ref)
            }
          }

          return { fecha, codigo_cliente: codCli, cliente_nombre: cli?.nombre, cliente_id: cli?.id, codigo_producto: codProd, producto_desc: prod?.descripcion, producto_id: prod?.id, cantidad: cant, pallets: cant * (prod?.pallets_por_unidad || 1), referencia: ref, ok: errores.length === 0, error: errores.length > 0 ? errores.join(', ') : undefined }
        })
        setFilas(preview)
      } catch { setError('Error leyendo el archivo. Verificá que sea CSV o Excel válido.') }
    }
    reader.readAsArrayBuffer(file)
  }

  function detectarColumnas(headers: string[]) {
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

    const duplicadas = filas.filter(f => f.error?.includes('ya importado') || f.error?.includes('duplicado en archivo'))

    const { data: imp, error: impErr } = await supabase.from('importaciones').insert({
      organization_id: orgId,
      archivo_nombre: archivo,
      registros_total: filas.length,
      registros_procesados: validas.length,
      registros_error: filas.length - validas.length,
      created_by: userData.user!.id,
    }).select('id').single()
    if (impErr) { setError('Error creando importación: ' + impErr.message); setImportando(false); return }

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

    setResultado({
      ok: validas.length,
      err: filas.length - validas.length - duplicadas.length,
      dup: duplicadas.length,
      importacionId: imp.id,
    })
    setImportando(false)
  }

  function limpiar() {
    setFilas([]); setArchivo(null); setResultado(null); setError(null)
    if (fileRef.current) fileRef.current.value = ''
    // Reload refs in case new ones were just imported
    cargarBase()
  }

  const validas = filas.filter(f => f.ok)
  const invalidas = filas.filter(f => !f.ok)
  const duplicadas = invalidas.filter(f => f.error?.includes('ya importado') || f.error?.includes('duplicado en archivo'))
  const otrosErrores = invalidas.filter(f => !f.error?.includes('ya importado') && !f.error?.includes('duplicado en archivo'))
  const totalPallets = validas.reduce((sum, f) => sum + f.pallets, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--ink)' }}>Importar despachos del ERP</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Subí un archivo CSV o Excel con los despachos. El sistema cruza los códigos de cliente y producto con los que ya están cargados.</p>

      {resultado && (
        <div className="rounded-lg p-5 mb-6 text-center" style={{ background: 'rgba(42,157,110,.12)', border: '1px solid var(--green)' }}>
          <div className="text-3xl mb-2">✓</div>
          <div className="text-lg font-bold" style={{ color: 'var(--green-dark)' }}>Importación completa</div>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {resultado.ok} despachos importados
            {resultado.dup > 0 ? ` · ${resultado.dup} ya existían (salteados)` : ''}
            {resultado.err > 0 ? ` · ${resultado.err} con error` : ''}
          </p>
          <button onClick={limpiar} className="mt-4 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-white" style={{ background: 'var(--green)' }}>Importar otro archivo</button>
        </div>
      )}

      {!resultado && (
        <>
          <div className="rounded-lg p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--green)', letterSpacing: '.1em' }}>Formato esperado</div>
            <p className="text-sm mb-2" style={{ color: 'var(--ink)' }}>El archivo debe tener estas columnas (el nombre es flexible):</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full" style={{ borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th className="text-left py-1.5 px-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Columna</th>
                  <th className="text-left py-1.5 px-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Ejemplo</th>
                  <th className="text-left py-1.5 px-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Nota</th>
                </tr></thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}><td className="py-1.5 px-2 text-xs">fecha</td><td className="py-1.5 px-2">2026-07-15</td><td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>Fecha del despacho</td></tr>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}><td className="py-1.5 px-2 text-xs">cliente</td><td className="py-1.5 px-2">CLI-001</td><td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>Código ERP del cliente</td></tr>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}><td className="py-1.5 px-2 text-xs">producto</td><td className="py-1.5 px-2">PAL-001</td><td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>Código de producto retornable</td></tr>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}><td className="py-1.5 px-2 text-xs">cantidad</td><td className="py-1.5 px-2">50</td><td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>Unidades despachadas</td></tr>
                  <tr><td className="py-1.5 px-2 text-xs">referencia</td><td className="py-1.5 px-2">REM-4521</td><td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>Opcional — N° remito/factura</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>Productos retornables configurados: <strong>{productos.length}</strong> · Clientes con código ERP: <strong>{clientes.filter(c => c.codigo_erp).length}</strong></p>
          </div>

          {filas.length === 0 && (
            <div>
              <button onClick={() => fileRef.current?.click()} className="w-full py-8 rounded-lg text-sm font-semibold uppercase tracking-wider flex flex-col items-center gap-2" style={{ border: '2px dashed var(--line)', color: 'var(--muted)', background: 'var(--surface)' }}>
                <span className="text-3xl">📄</span>Seleccionar archivo CSV o Excel
              </button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={procesarArchivo} className="hidden" />
            </div>
          )}

          {filas.length > 0 && !resultado && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Previsualización — <span>{archivo}</span></div>
                <button onClick={limpiar} className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>Cambiar archivo</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface)' }}>
                  <div className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{filas.length}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Total filas</div>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(42,157,110,.12)' }}>
                  <div className="text-xl font-bold" style={{ color: 'var(--green-dark)' }}>{validas.length}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Válidas</div>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ background: invalidas.length > 0 ? 'rgba(196,154,60,.12)' : 'var(--surface)' }}>
                  <div className="text-xl font-bold" style={{ color: invalidas.length > 0 ? 'var(--amber)' : 'var(--muted)' }}>{invalidas.length}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {duplicadas.length > 0 ? `${otrosErrores.length} error · ${duplicadas.length} dup` : 'Con error'}
                  </div>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface)' }}>
                  <div className="text-xl font-bold" style={{ color: 'var(--green-dark)' }}>{totalPallets}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Pallets</div>
                </div>
              </div>

              {/* Duplicados (ya importados) */}
              {duplicadas.length > 0 && (
                <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(44,99,130,.08)', border: '1px solid var(--blue-light)' }}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--blue)' }}>
                    {duplicadas.length} fila{duplicadas.length !== 1 ? 's' : ''} ya importada{duplicadas.length !== 1 ? 's' : ''} (se saltean)
                  </div>
                  {duplicadas.slice(0, 5).map((f, i) => (
                    <div key={i} className="text-xs py-1" style={{ color: 'var(--blue)', borderBottom: '1px solid rgba(44,99,130,.15)' }}>
                      <span>{f.referencia}</span> · <span>{f.codigo_cliente}</span> · {f.error}
                    </div>
                  ))}
                  {duplicadas.length > 5 && <div className="text-xs mt-1" style={{ color: 'var(--blue)' }}>…y {duplicadas.length - 5} más</div>}
                </div>
              )}

              {/* Otros errores */}
              {otrosErrores.length > 0 && (
                <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(196,154,60,.08)', border: '1px solid var(--amber)' }}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--amber)' }}>Filas con error (no se importarán)</div>
                  {otrosErrores.slice(0, 10).map((f, i) => (
                    <div key={i} className="text-xs py-1" style={{ color: 'var(--amber)', borderBottom: '1px solid rgba(196,154,60,.2)' }}>
                      <span>{f.codigo_cliente || '?'}</span> · <span>{f.codigo_producto || '?'}</span> · {f.error}
                    </div>
                  ))}
                  {otrosErrores.length > 10 && <div className="text-xs mt-1" style={{ color: 'var(--amber)' }}>…y {otrosErrores.length - 10} más</div>}
                </div>
              )}

              <div className="overflow-x-auto rounded-lg mb-4" style={{ border: '1px solid var(--line)' }}>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
                    <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}></th>
                    <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Fecha</th>
                    <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Cliente</th>
                    <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Producto</th>
                    <th className="text-right py-2 px-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Cant</th>
                    <th className="text-right py-2 px-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Pallets</th>
                    <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Ref</th>
                  </tr></thead>
                  <tbody>
                    {validas.slice(0, 20).map((f, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td className="py-1.5 px-2" style={{ color: 'var(--green-dark)' }}>✓</td>
                        <td className="py-1.5 px-2 text-xs" style={{ color: 'var(--ink)' }}>{f.fecha}</td>
                        <td className="py-1.5 px-2" style={{ color: 'var(--ink)' }}>{f.cliente_nombre || f.codigo_cliente}</td>
                        <td className="py-1.5 px-2" style={{ color: 'var(--ink)' }}>{f.producto_desc || f.codigo_producto}</td>
                        <td className="py-1.5 px-2 text-right" style={{ color: 'var(--ink)' }}>{f.cantidad}</td>
                        <td className="py-1.5 px-2 text-right font-bold" style={{ color: 'var(--green-dark)' }}>{f.pallets}</td>
                        <td className="py-1.5 px-2" style={{ color: 'var(--muted)' }}>{f.referencia || '—'}</td>
                      </tr>
                    ))}
                    {validas.length > 20 && <tr><td colSpan={7} className="py-2 px-2 text-center" style={{ color: 'var(--muted)' }}>…y {validas.length - 20} filas más</td></tr>}
                  </tbody>
                </table>
              </div>
              {error && <div className="p-3 rounded-lg text-center mb-3" style={{ background: 'rgba(176,64,64,.1)', border: '2px solid var(--red)' }}><p className="text-sm font-bold" style={{ color: 'var(--red)' }}>{error}</p></div>}
              {validas.length > 0 && (
                <button onClick={confirmarImportacion} disabled={importando} className="w-full py-4 rounded-lg text-sm font-bold uppercase tracking-wider text-white transition-opacity" style={{ background: 'var(--green)', opacity: importando ? 0.6 : 1 }}>
                  {importando ? 'Importando…' : `Confirmar importación — ${validas.length} despachos · ${totalPallets} pallets`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
