import { createClient } from '@supabase/supabase-js'

export default async function ComprobantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Buscar remito con datos relacionados
  const { data: remito, error } = await supabase
    .from('remitos')
    .select(`
      id, numero, cantidad_buenos, cantidad_recuperar, cantidad_scrap, cantidad_total,
      firma_nombre, estado, fichada_entrada_at, fichada_salida_at, estadia_minutos,
      chofer_id,
      vale_lineas (
        cantidad_autorizada, cantidad_retirada,
        clientes ( nombre ),
        vales ( numero )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !remito) {
    return (
      <div style={{ minHeight: '100vh', background: '#B4BEC4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: '8px', padding: '3rem', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <h1 style={{ fontSize: '1.2rem', color: '#1E2A38', margin: '0 0 0.5rem' }}>Comprobante no encontrado</h1>
          <p style={{ fontSize: '0.9rem', color: '#4E5C68' }}>El enlace puede estar vencido o ser incorrecto.</p>
        </div>
      </div>
    )
  }

  // Datos del chofer y transportista
  let choferNombre = ''
  let transportistaNombre = ''
  if (remito.chofer_id) {
    const { data: chofer } = await supabase
      .from('users')
      .select('nombre, transportista_id')
      .eq('id', remito.chofer_id)
      .single()
    if (chofer) {
      choferNombre = chofer.nombre || ''
      if (chofer.transportista_id) {
        const { data: transp } = await supabase
          .from('transportistas')
          .select('nombre')
          .eq('id', chofer.transportista_id)
          .single()
        transportistaNombre = transp?.nombre || ''
      }
    }
  }

  const valeLinea = remito.vale_lineas as any
  const clienteNombre = valeLinea?.clientes?.nombre || ''
  const valeNumero = valeLinea?.vales?.numero || ''
  const cantidadAutorizada = valeLinea?.cantidad_autorizada || 0
  const cantidadRetirada = valeLinea?.cantidad_retirada || 0
  const saldoPendiente = cantidadAutorizada - cantidadRetirada
  const esNoConformado = remito.estado === 'no_conformado'

  const fecha = remito.fichada_entrada_at
    ? new Date(remito.fichada_entrada_at).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : ''
  const horaEntrada = remito.fichada_entrada_at
    ? new Date(remito.fichada_entrada_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : ''
  const horaSalida = remito.fichada_salida_at
    ? new Date(remito.fichada_salida_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div style={{ minHeight: '100vh', background: '#B4BEC4', padding: '2rem 1rem', fontFamily: "'Inter', Helvetica, Arial, sans-serif" }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: '#2E4A63', padding: '24px 32px', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/VaPal__logo.png" alt="VaPal" style={{ height: '44px' }} />
          <div>
            <h1 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 600 }}>Comprobante de retiro</h1>
            <p style={{ margin: '2px 0 0', color: '#B8C4CE', fontSize: '13px' }}>{remito.numero}</p>
          </div>
        </div>

        {/* Body */}
        <div style={{ background: '#fff', padding: '32px', borderRadius: '0 0 8px 8px' }}>

          <p style={{ fontSize: '15px', margin: '0 0 8px', color: '#1E2A38' }}>
            Cliente: <strong>{clienteNombre}</strong>
          </p>
          <p style={{ fontSize: '14px', color: '#4E5C68', margin: '0 0 24px', lineHeight: 1.6 }}>
            Retiro realizado el <strong>{fecha}</strong>.
            {esNoConformado && (
              <span style={{ color: '#C55A2F', fontWeight: 600, display: 'block', marginTop: '8px' }}>
                ⚠ Este retiro no fue conformado con firma.
              </span>
            )}
          </p>

          {/* Datos del retiro */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '24px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '10px 0', color: '#4E5C68' }}>Vale</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600 }}>{valeNumero}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '10px 0', color: '#4E5C68' }}>Transportista</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600 }}>{transportistaNombre}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '10px 0', color: '#4E5C68' }}>Chofer</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600 }}>{choferNombre}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '10px 0', color: '#4E5C68' }}>Llegada</td>
                <td style={{ padding: '10px 0', textAlign: 'right' }}>{horaEntrada}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '10px 0', color: '#4E5C68' }}>Salida</td>
                <td style={{ padding: '10px 0', textAlign: 'right' }}>{horaSalida}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '10px 0', color: '#4E5C68' }}>Estadía</td>
                <td style={{ padding: '10px 0', textAlign: 'right' }}>{remito.estadia_minutos ?? '—'} min</td>
              </tr>
              {remito.firma_nombre && (
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '10px 0', color: '#4E5C68' }}>Firmado por</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600 }}>{remito.firma_nombre}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Clasificación */}
          <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '20px', marginBottom: '24px' }}>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#4E5C68', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Detalle del retiro
            </p>
            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', color: '#5D7040' }}>✓ Buenos</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{remito.cantidad_buenos}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: '#C99031' }}>↻ A recuperar</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{remito.cantidad_recuperar}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: '#999' }}>✕ Scrap</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{remito.cantidad_scrap}</td>
                </tr>
                <tr style={{ borderTop: '2px solid #2E4A63' }}>
                  <td style={{ padding: '10px 0', fontWeight: 700, fontSize: '15px' }}>Total retirado</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: '#2E4A63' }}>{remito.cantidad_total}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Saldo pendiente */}
          <div style={{ background: '#2E4A63', color: '#fff', borderRadius: '6px', padding: '16px 20px', textAlign: 'center', marginBottom: '24px' }}>
            <p style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B8C4CE' }}>
              Saldo pendiente de retiro
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '32px', fontWeight: 700 }}>{saldoPendiente}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#B8C4CE' }}>pallets</p>
          </div>

          <p style={{ fontSize: '11px', color: '#999', lineHeight: 1.5, margin: 0, textAlign: 'center' }}>
            Comprobante generado por VaPal · Trazabilidad de pallets
          </p>
        </div>
      </div>
    </div>
  )
}
