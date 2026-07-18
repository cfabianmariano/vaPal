'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import Link from 'next/link';

type Evento = {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  notas: string | null;
  created_at: string;
  user: { nombre: string } | null;
};

type Remito = {
  id: string;
  numero: string;
  estado: string;
  cantidad_buenos: number;
  cantidad_recuperar: number;
  cantidad_scrap: number;
  cantidad_total: number;
  firma_nombre: string | null;
  geocerca_ok: boolean | null;
  fichada_entrada_at: string | null;
  fichada_salida_at: string | null;
  estadia_minutos: number | null;
  created_at: string;
  chofer: { nombre: string } | null;
};

type Linea = {
  id: string;
  cantidad_autorizada: number;
  cantidad_retirada: number;
  estado: string;
  cliente: { nombre: string } | null;
  remitos: Remito[];
};

type Vale = {
  id: string;
  numero: string;
  estado: string;
  fecha_creacion: string;
  fecha_cierre: string | null;
  notas: string | null;
  transportista: { nombre: string } | null;
};

const chipColor: Record<string, string> = {
  sin_asignar: 'bg-gray-200 text-gray-600',
  asignado: 'bg-blue-100 text-blue-700',
  en_curso: 'bg-amber-100 text-amber-700',
  parcial: 'bg-orange-100 text-orange-700',
  completo: 'bg-green-100 text-green-700',
  cerrado: 'bg-gray-300 text-gray-600',
  pendiente: 'bg-gray-200 text-gray-600',
  firmado: 'bg-green-100 text-green-700',
  no_conformado: 'bg-red-100 text-red-700',
};

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function ValeDetallePage() {
  const params = useParams();
  const valeId = params.id as string;
  const supabase = createClient();

  const [vale, setVale] = useState<Vale | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDetalle();
  }, [valeId]);

  async function cargarDetalle() {
    setLoading(true);

    // Vale
    const { data: valeData } = await supabase
      .from('vales')
      .select('id, numero, estado, fecha_creacion, fecha_cierre, notas, transportista:transportistas(nombre)')
      .eq('id', valeId)
      .single();

    if (valeData) setVale(valeData as unknown as Vale);

    // Eventos
    const { data: eventosData } = await supabase
      .from('vale_eventos')
      .select('id, estado_anterior, estado_nuevo, notas, created_at, user:users(nombre)')
      .eq('vale_id', valeId)
      .order('created_at', { ascending: true });

    if (eventosData) setEventos(eventosData as unknown as Evento[]);

    // Líneas con remitos
    const { data: lineasData } = await supabase
      .from('vale_lineas')
      .select(`
        id, cantidad_autorizada, cantidad_retirada, estado,
        cliente:clientes(nombre),
        remitos(
          id, numero, estado, cantidad_buenos, cantidad_recuperar, cantidad_scrap, cantidad_total,
          firma_nombre, geocerca_ok, fichada_entrada_at, fichada_salida_at, estadia_minutos, created_at,
          chofer:users!remitos_chofer_id_fkey(nombre)
        )
      `)
      .eq('vale_id', valeId)
      .order('orden_ruta', { ascending: true });

    if (lineasData) setLineas(lineasData as unknown as Linea[]);

    setLoading(false);
  }

  if (loading) return <p className="text-[#4E5C68]">Cargando...</p>;
  if (!vale) return <p className="text-red-600">Vale no encontrado.</p>;

  const totalAut = lineas.reduce((s, l) => s + l.cantidad_autorizada, 0);
  const totalRet = lineas.reduce((s, l) => s + l.cantidad_retirada, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/consulta" className="text-sm text-[#2E4A63] hover:underline mb-2 inline-block">
          ← Volver a consulta
        </Link>
        <div className="flex items-center gap-4 mt-1">
          <h1 className="text-2xl font-semibold text-[#1E2A38] font-mono">{vale.numero}</h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold uppercase ${chipColor[vale.estado] || ''}`}>
            {vale.estado.replace('_', ' ')}
          </span>
        </div>
        <div className="mt-2 text-sm text-[#4E5C68] space-y-1">
          <p><span className="font-medium text-[#1E2A38]">Transportista:</span> {vale.transportista?.nombre || 'Sin asignar'}</p>
          <p><span className="font-medium text-[#1E2A38]">Creado:</span> {formatFecha(vale.fecha_creacion)}</p>
          {vale.fecha_cierre && <p><span className="font-medium text-[#1E2A38]">Cerrado:</span> {formatFecha(vale.fecha_cierre)}</p>}
          <p><span className="font-medium text-[#1E2A38]">Pallets:</span> {totalRet} retirados de {totalAut} autorizados</p>
          {vale.notas && <p><span className="font-medium text-[#1E2A38]">Notas:</span> {vale.notas}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline de eventos */}
        <div className="bg-[#CDD5DA] rounded-lg p-5">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#4E5C68] mb-4 font-semibold">
            Historial del vale
          </h2>
          <div className="relative pl-6">
            {/* Línea vertical */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#8C99A1]" />

            {eventos.map((ev, i) => (
              <div key={ev.id} className="relative pb-5 last:pb-0">
                {/* Dot */}
                <div className={`absolute left-[-21px] top-1 w-3 h-3 rounded-full border-2 ${
                  i === eventos.length - 1
                    ? 'bg-[#C55A2F] border-[#C55A2F]'
                    : 'bg-[#2E4A63] border-[#2E4A63]'
                }`} />
                <div className="font-mono text-xs text-[#4E5C68]">
                  {formatFecha(ev.created_at)} · {formatHora(ev.created_at)}
                </div>
                <div className="font-medium text-[#1E2A38] text-sm mt-0.5">
                  {ev.estado_anterior
                    ? `${ev.estado_anterior.replace('_', ' ')} → ${ev.estado_nuevo.replace('_', ' ')}`
                    : `Creado como "${ev.estado_nuevo.replace('_', ' ')}"`
                  }
                </div>
                {ev.user && (
                  <div className="text-xs text-[#4E5C68] mt-0.5">por {ev.user.nombre}</div>
                )}
                {ev.notas && (
                  <div className="text-xs text-[#4E5C68] italic mt-0.5">{ev.notas}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Líneas (clientes) con remitos */}
        <div className="space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#4E5C68] font-semibold">
            Detalle por cliente
          </h2>

          {lineas.map((linea) => (
            <div key={linea.id} className="bg-[#CDD5DA] rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium text-[#1E2A38]">{linea.cliente?.nombre || 'Cliente'}</div>
                  <div className="font-mono text-xs text-[#4E5C68] mt-0.5">
                    {linea.cantidad_retirada} / {linea.cantidad_autorizada} pallets
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold uppercase ${chipColor[linea.estado] || ''}`}>
                  {linea.estado}
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="w-full h-2 bg-[#B4BEC4] rounded-full mb-3">
                <div
                  className="h-2 bg-[#2E4A63] rounded-full transition-all"
                  style={{ width: `${Math.min(100, (linea.cantidad_retirada / linea.cantidad_autorizada) * 100)}%` }}
                />
              </div>

              {/* Remitos de esta línea */}
              {linea.remitos.length > 0 ? (
                <div className="space-y-2">
                  {linea.remitos.map((rem) => (
                    <div key={rem.id} className="bg-[#B4BEC4] rounded p-3 text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono text-xs font-medium text-[#2E4A63]">{rem.numero}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${chipColor[rem.estado] || ''}`}>
                          {rem.estado.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-[#4E5C68]">
                        <div>Buenos: <span className="font-medium text-[#1E2A38]">{rem.cantidad_buenos}</span></div>
                        <div>A recup.: <span className="font-medium text-[#1E2A38]">{rem.cantidad_recuperar}</span></div>
                        <div>Scrap: <span className="font-medium text-[#1E2A38]">{rem.cantidad_scrap}</span></div>
                      </div>
                      <div className="mt-2 text-xs text-[#4E5C68] space-y-0.5">
                        {rem.chofer && <div>Chofer: {rem.chofer.nombre}</div>}
                        {rem.fichada_entrada_at && (
                          <div>
                            Llegada: {formatFecha(rem.fichada_entrada_at)} {formatHora(rem.fichada_entrada_at)}
                            {rem.geocerca_ok === false && <span className="text-red-600 ml-1">⚠ fuera de geocerca</span>}
                          </div>
                        )}
                        {rem.fichada_salida_at && (
                          <div>Salida: {formatHora(rem.fichada_salida_at)} · Estadía: {rem.estadia_minutos} min</div>
                        )}
                        {rem.firma_nombre && <div>Firmó: {rem.firma_nombre}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#4E5C68] italic">Sin retiros registrados</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
