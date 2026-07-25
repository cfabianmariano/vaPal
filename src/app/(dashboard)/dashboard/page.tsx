'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const C = {
  ink: '#1b3a4b',
  muted: '#6a8494',
  green: '#2a9d6e',
  greenDark: '#1a7a52',
  blue: '#2c6382',
  blueLight: '#3b8ea8',
  amber: '#c49a3c',
  red: '#b04040',
  bg: '#e4ecf0',
  card: '#f4f7f9',
  cardBorder: '#dce6ec',
  barTrack: '#dce6ec',
  barGreen: '#2a9d6e',
  barBlue: '#3b8ea8',
  barSoft: '#a0c4b4',
}

interface Resumen {
  retiros_mes: number
  pallets_mes: number
  cumplimiento_pct: number
  estadia_promedio_min: number
  pendientes: number
}

interface TransportistaKpi {
  transportista: string
  pallets_mes: number
  retiros_mes: number
}

interface EstadiaCliente {
  cliente: string
  estadia_promedio: number
  visitas: number
}

interface SaldoCliente {
  cliente_nombre: string
  saldo_deuda: number
  total_despachados: number
  total_retirados: number
}

interface Clasificacion {
  total_buenos: number
  total_recuperar: number
  total_scrap: number
  total_general: number
  pct_buenos: number
  pct_recuperar: number
  pct_scrap: number
}

interface RetiroSemana {
  semana: string
  pallets: number
  retiros: number
}

export default function DashboardPage() {
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [transportistas, setTransportistas] = useState<TransportistaKpi[]>([])
  const [estadias, setEstadias] = useState<EstadiaCliente[]>([])
  const [saldos, setSaldos] = useState<SaldoCliente[]>([])
  const [clasificacion, setClasificacion] = useState<Clasificacion | null>(null)
  const [semanas, setSemanas] = useState<RetiroSemana[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      const [resR, transR, estR, salR, clasR, semR] = await Promise.all([
        supabase.from('kpi_resumen').select('*').single(),
        supabase.from('kpi_retiros_por_transportista').select('*'),
        supabase.from('kpi_estadias_por_cliente').select('*').limit(10),
        supabase.from('kpi_saldo_por_cliente').select('*').limit(10),
        supabase.from('kpi_clasificacion').select('*').single(),
        supabase.from('kpi_retiros_por_semana').select('*'),
      ])

      if (resR.data) setResumen(resR.data)
      if (transR.data) setTransportistas(transR.data)
      if (estR.data) setEstadias(estR.data)
      if (salR.data) setSaldos(salR.data)
      if (clasR.data) setClasificacion(clasR.data)
      if (semR.data) setSemanas(semR.data)

      setLoading(false)
    }
    cargar()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: C.muted }}>Cargando dashboard...</p>
      </div>
    )
  }

  const maxPalletsTrans = Math.max(...transportistas.map(t => t.pallets_mes), 1)
  const maxEstadia = Math.max(...estadias.map(e => e.estadia_promedio), 1)
  const maxPalletsSem = Math.max(...semanas.map(s => s.pallets), 1)

  const mesActual = new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.green, letterSpacing: '.14em' }}>
          Dashboard
        </p>
        <h1 className="text-2xl font-bold" style={{ color: C.ink }}>
          {mesActual}
        </h1>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          valor={resumen?.retiros_mes ?? 0}
          label="Retiros del mes"
          color={C.blue}
          detalle={`${resumen?.pallets_mes ?? 0} pallets`}
        />
        <KpiCard
          valor={`${resumen?.cumplimiento_pct ?? 0}%`}
          label="Cumplimiento"
          color={C.greenDark}
        />
        <KpiCard
          valor={`${resumen?.estadia_promedio_min ?? 0}m`}
          label="Estadía promedio"
          color={C.blue}
        />
        <KpiCard
          valor={resumen?.pendientes ?? 0}
          label="Pendientes"
          color={C.red}
        />
      </div>

      {/* Fila 2: Transportistas + Saldo pendiente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel titulo="Retiros por transportista" subtitulo="Pallets del mes">
          {transportistas.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>Sin datos aún</p>
          ) : (
            <div className="space-y-3">
              {transportistas.map((t, i) => (
                <div key={t.transportista}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: C.ink }}>{t.transportista}</span>
                    <span className="text-xs font-bold" style={{ color: C.ink }}>
                      {t.pallets_mes}
                    </span>
                  </div>
                  <div className="h-4 rounded overflow-hidden" style={{ background: C.barTrack }}>
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${(t.pallets_mes / maxPalletsTrans) * 100}%`,
                        background: i === 0 ? C.barGreen : i === 1 ? C.barBlue : C.barSoft,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel titulo="Saldo pendiente" subtitulo="Pallets por cliente">
          {saldos.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>Sin deuda registrada</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                  <th className="text-left py-2 text-xs uppercase font-semibold"
                      style={{ color: C.muted, letterSpacing: '.08em' }}>Cliente</th>
                  <th className="text-right py-2 text-xs uppercase font-semibold"
                      style={{ color: C.muted, letterSpacing: '.08em' }}>Deuda</th>
                </tr>
              </thead>
              <tbody>
                {saldos.map((s) => (
                  <tr key={s.cliente_nombre} style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                    <td className="py-2" style={{ color: C.ink }}>{s.cliente_nombre}</td>
                    <td className="py-2 text-right font-extrabold" style={{ color: C.greenDark }}>
                      {s.saldo_deuda}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Fila 3: Estadías + Clasificación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel titulo="Estadía por cliente" subtitulo="Promedio en minutos">
          {estadias.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>Sin datos de estadía</p>
          ) : (
            <div className="space-y-3">
              {estadias.map((e) => (
                <div key={e.cliente}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: C.ink }}>{e.cliente}</span>
                    <span className="text-xs font-bold" style={{ color: C.muted }}>
                      {e.estadia_promedio}m · {e.visitas} visitas
                    </span>
                  </div>
                  <div className="h-4 rounded overflow-hidden" style={{ background: C.barTrack }}>
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(e.estadia_promedio / maxEstadia) * 100}%`,
                        background: e.estadia_promedio > 45 ? C.blue : C.blueLight,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel titulo="Clasificación acumulada" subtitulo="Distribución por estado">
          {!clasificacion || clasificacion.total_general === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>Sin datos de clasificación</p>
          ) : (
            <div className="space-y-4">
              <div className="h-6 rounded overflow-hidden flex">
                <div
                  style={{ width: `${clasificacion.pct_buenos}%`, background: C.green }}
                  title={`Buenos: ${clasificacion.pct_buenos}%`}
                />
                <div
                  style={{ width: `${clasificacion.pct_recuperar}%`, background: C.blueLight }}
                  title={`A recuperar: ${clasificacion.pct_recuperar}%`}
                />
                <div
                  style={{ width: `${clasificacion.pct_scrap}%`, background: C.amber }}
                  title={`Scrap: ${clasificacion.pct_scrap}%`}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-extrabold" style={{ color: C.greenDark }}>
                    {clasificacion.total_buenos}
                  </div>
                  <div className="text-xs" style={{ color: C.muted }}>
                    Buenos ({clasificacion.pct_buenos}%)
                  </div>
                </div>
                <div>
                  <div className="text-lg font-extrabold" style={{ color: C.blue }}>
                    {clasificacion.total_recuperar}
                  </div>
                  <div className="text-xs" style={{ color: C.muted }}>
                    A recuperar ({clasificacion.pct_recuperar}%)
                  </div>
                </div>
                <div>
                  <div className="text-lg font-extrabold" style={{ color: C.amber }}>
                    {clasificacion.total_scrap}
                  </div>
                  <div className="text-xs" style={{ color: C.muted }}>
                    Scrap ({clasificacion.pct_scrap}%)
                  </div>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Fila 4: Tendencia semanal */}
      {semanas.length > 1 && (
        <Panel titulo="Tendencia semanal" subtitulo="Pallets retirados por semana">
          <div className="flex items-end gap-2" style={{ height: '120px' }}>
            {semanas.map((s, i) => (
              <div
                key={s.semana}
                className="flex-1 flex flex-col items-center justify-end"
              >
                <span className="text-xs font-bold mb-1" style={{ color: C.ink }}>
                  {s.pallets}
                </span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${(s.pallets / maxPalletsSem) * 100}%`,
                    minHeight: '4px',
                    background: i % 2 === 0 ? C.barGreen : C.barBlue,
                  }}
                />
                <span className="mt-1" style={{ fontSize: '0.6rem', color: C.muted }}>
                  {new Date(s.semana).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

// ---- Componentes auxiliares ----

function KpiCard({
  valor,
  label,
  color,
  detalle,
}: {
  valor: number | string
  label: string
  color: string
  detalle?: string
}) {
  return (
    <div className="rounded-lg p-4" style={{ background: C.card }}>
      <div className="text-3xl font-extrabold" style={{ color, letterSpacing: '-0.02em' }}>
        {typeof valor === 'number' ? valor.toLocaleString('es-AR') : valor}
      </div>
      <div className="text-xs uppercase font-semibold mt-1" style={{ color: C.muted, letterSpacing: '.1em' }}>
        {label}
      </div>
      {detalle && (
        <div className="text-xs mt-1" style={{ color: C.muted }}>{detalle}</div>
      )}
    </div>
  )
}

function Panel({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg p-4" style={{ background: C.card }}>
      <div className="mb-4">
        <h3 className="font-bold text-sm" style={{ color: C.ink }}>{titulo}</h3>
        {subtitulo && (
          <p className="text-xs uppercase font-semibold" style={{ color: C.muted, letterSpacing: '.08em' }}>
            {subtitulo}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
