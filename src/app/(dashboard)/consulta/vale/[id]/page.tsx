'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import Link from 'next/link';

type Evento = { id: string; estado_anterior: string | null; estado_nuevo: string; notas: string | null; created_at: string; user: { nombre: string } | null };
type Remito = { id: string; numero: string; estado: string; cantidad_buenos: number; cantidad_recuperar: number; cantidad_scrap: number; cantidad_total: number; firma_nombre: string | null; geocerca_ok: boolean | null; fichada_entrada_at: string | null; fichada_salida_at: string | null; estadia_minutos: number | null; created_at: string; chofer: { nombre: string } | null };
type Linea = { id: string; cantidad_autorizada: number; cantidad_retirada: number; estado: string; cliente: { nombre: string } | null; remitos: Remito[] };
type Vale = { id: string; numero: string; estado: string; fecha_creacion: string; fecha_cierre: string | null; notas: string | null; transportista: { nombre: string } | null };

const chipStyle: Record<string, { bg: string; color: string }> = {
  sin_asignar: { bg: '#dce6ec', color: '#6a8494' },
  asignado: { bg: '#2c6382', color: '#fff' },
  en_curso: { bg: '#2a9d6e', color: '#fff' },
  parcial: { bg: '#c49a3c', color: '#fff' },
  completo: { bg: '#1a7a52', color: '#fff' },
  cerrado: { bg: '#dce6ec', color: '#6a8494' },
  pendiente: { bg: '#dce6ec', color: '#6a8494' },
  firmado: { bg: '#1a7a52', color: '#fff' },
  no_conformado: { bg: '#b04040', color: '#fff' },
};

function formatFecha(iso: string) { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) }
function formatHora(iso: string) { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }

export default function ValeDetallePage() {
  const params = useParams();
  const valeId = params.id as string;
  const supabase = createClient();
  const [vale, setVale] = useState<Vale | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { cargarDetalle() }, [valeId]);

  async function cargarDetalle() {
    setLoading(true);
    const { data: valeData } = await supabase.from('vales').select('id, numero, estado, fecha_creacion, fecha_cierre, notas, transportista:transportistas(nombre)').eq('id', valeId).single();
    if (valeData) setVale(valeData as unknown as Vale);
    const { data: eventosData } = await supabase.from('vale_eventos').select('id, estado_anterior, estado_nuevo, notas, created_at, user:users(nombre)').eq('vale_id', valeId).order('created_at', { ascending: true });
    if (eventosData) setEventos(eventosData as unknown as Evento[]);
    const { data: lineasData } = await supabase.from('vale_lineas').select(`id, cantidad_autorizada, cantidad_retirada, estado, cliente:clientes(nombre), remitos(id, numero, estado, cantidad_buenos, cantidad_recuperar, cantidad_scrap, cantidad_total, firma_nombre, geocerca_ok, fichada_entrada_at, fichada_salida_at, estadia_minutos, created_at, chofer:users!remitos_chofer_id_fkey(nombre))`).eq('vale_id', valeId).order('orden_ruta', { ascending: true });
    if (lineasData) setLineas(lineasData as unknown as Linea[]);
    setLoading(false);
  }

  if (loading) return <p className="text-[#6a8494]">Cargando...</p>;
  if (!vale) return <p className="text-[#b04040]">Vale no encontrado.</p>;

  const totalAut = lineas.reduce((s, l) => s + l.cantidad_autorizada, 0);
  const totalRet = lineas.reduce((s, l) => s + l.cantidad_retirada, 0);

  return (
    <div>
      <div className="mb-6">
        <Link href="/consulta" className="text-sm text-[#2c6382] hover:underline mb-2 inline-block">← Volver a consulta</Link>
        <div className="flex items-center gap-4 mt-1">
          <h1 className="text-2xl font-bold text-[#1b3a4b]">{vale.numero}</h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase" style={{ background: (chipStyle[vale.estado] || chipStyle.sin_asignar).bg, color: (chipStyle[vale.estado] || chipStyle.sin_asignar).color }}>{vale.estado.replace('_', ' ')}</span>
        </div>
        <div className="mt-2 text-sm text-[#6a8494] space-y-1">
          <p><span className="font-semibold text-[#1b3a4b]">Transportista:</span> {vale.transportista?.nombre || 'Sin asignar'}</p>
          <p><span className="font-semibold text-[#1b3a4b]">Creado:</span> {formatFecha(vale.fecha_creacion)}</p>
          {vale.fecha_cierre && <p><span className="font-semibold text-[#1b3a4b]">Cerrado:</span> {formatFecha(vale.fecha_cierre)}</p>}
          <p><span className="font-semibold text-[#1b3a4b]">Pallets:</span> {totalRet} retirados de {totalAut} autorizados</p>
          {vale.notas && <p><span className="font-semibold text-[#1b3a4b]">Notas:</span> {vale.notas}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#f4f7f9] rounded-lg p-5">
          <h2 className="text-xs uppercase tracking-wider text-[#6a8494] mb-4 font-semibold" style={{ letterSpacing: '.1em' }}>Historial del vale</h2>
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#c5d3dc]" />
            {eventos.map((ev, i) => (
              <div key={ev.id} className="relative pb-5 last:pb-0">
                <div className={`absolute left-[-21px] top-1 w-3 h-3 rounded-full border-2 ${i === eventos.length - 1 ? 'bg-[#2a9d6e] border-[#2a9d6e]' : 'bg-[#2c6382] border-[#2c6382]'}`} />
                <div className="text-xs text-[#6a8494]">{formatFecha(ev.created_at)} · {formatHora(ev.created_at)}</div>
                <div className="font-semibold text-[#1b3a4b] text-sm mt-0.5">{ev.estado_anterior ? `${ev.estado_anterior.replace('_', ' ')} → ${ev.estado_nuevo.replace('_', ' ')}` : `Creado como "${ev.estado_nuevo.replace('_', ' ')}"`}</div>
                {ev.user && <div className="text-xs text-[#6a8494] mt-0.5">por {ev.user.nombre}</div>}
                {ev.notas && <div className="text-xs text-[#6a8494] italic mt-0.5">{ev.notas}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs uppercase tracking-wider text-[#6a8494] font-semibold" style={{ letterSpacing: '.1em' }}>Detalle por cliente</h2>
          {lineas.map((linea) => {
            const lcs = chipStyle[linea.estado] || chipStyle.pendiente;
            return (
              <div key={linea.id} className="bg-[#f4f7f9] rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold text-[#1b3a4b]">{linea.cliente?.nombre || 'Cliente'}</div>
                    <div className="text-xs text-[#6a8494] mt-0.5">{linea.cantidad_retirada} / {linea.cantidad_autorizada} pallets</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase" style={{ background: lcs.bg, color: lcs.color }}>{linea.estado}</span>
                </div>
                <div className="w-full h-2 bg-[#dce6ec] rounded-full mb-3">
                  <div className="h-2 bg-[#2c6382] rounded-full transition-all" style={{ width: `${Math.min(100, (linea.cantidad_retirada / linea.cantidad_autorizada) * 100)}%` }} />
                </div>
                {linea.remitos.length > 0 ? (
                  <div className="space-y-2">
                    {linea.remitos.map((rem) => {
                      const rcs = chipStyle[rem.estado] || chipStyle.pendiente;
                      return (
                        <div key={rem.id} className="bg-[#e4ecf0] rounded p-3 text-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-[#2c6382]">{rem.numero}</span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase" style={{ background: rcs.bg, color: rcs.color }}>{rem.estado.replace('_', ' ')}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs text-[#6a8494]">
                            <div>Buenos: <span className="font-semibold text-[#1b3a4b]">{rem.cantidad_buenos}</span></div>
                            <div>A recup.: <span className="font-semibold text-[#1b3a4b]">{rem.cantidad_recuperar}</span></div>
                            <div>Scrap: <span className="font-semibold text-[#1b3a4b]">{rem.cantidad_scrap}</span></div>
                          </div>
                          <div className="mt-2 text-xs text-[#6a8494] space-y-0.5">
                            {rem.chofer && <div>Chofer: {rem.chofer.nombre}</div>}
                            {rem.fichada_entrada_at && <div>Llegada: {formatFecha(rem.fichada_entrada_at)} {formatHora(rem.fichada_entrada_at)}{rem.geocerca_ok === false && <span className="text-[#b04040] ml-1">⚠ fuera de geocerca</span>}</div>}
                            {rem.fichada_salida_at && <div>Salida: {formatHora(rem.fichada_salida_at)} · Estadía: {rem.estadia_minutos} min</div>}
                            {rem.firma_nombre && <div>Firmó: {rem.firma_nombre}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#6a8494] italic">Sin retiros registrados</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
