'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import Link from 'next/link';

type Vale = {
  id: string; numero: string; estado: string; fecha_creacion: string; fecha_cierre: string | null; notas: string | null;
  transportista: { nombre: string } | null;
  lineas: { cantidad_autorizada: number; cantidad_retirada: number; cliente: { nombre: string } | null }[];
};

const ESTADOS = [
  { value: '', label: 'Todos' }, { value: 'sin_asignar', label: 'Sin asignar' },
  { value: 'asignado', label: 'Asignado' }, { value: 'en_curso', label: 'En curso' },
  { value: 'parcial', label: 'Parcial' }, { value: 'completo', label: 'Completo' },
  { value: 'cerrado', label: 'Cerrado' },
];

const chipStyle: Record<string, { bg: string; color: string }> = {
  sin_asignar: { bg: '#dce6ec', color: '#6a8494' },
  asignado:    { bg: '#2c6382', color: '#fff' },
  en_curso:    { bg: '#2a9d6e', color: '#fff' },
  parcial:     { bg: '#c49a3c', color: '#fff' },
  completo:    { bg: '#1a7a52', color: '#fff' },
  cerrado:     { bg: '#dce6ec', color: '#6a8494' },
};

export default function ConsultaPage() {
  const supabase = createClient();
  const [vales, setVales] = useState<Vale[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => { cargarVales() }, []);

  async function cargarVales() {
    setLoading(true);
    const { data, error } = await supabase.from('vales').select(`id, numero, estado, fecha_creacion, fecha_cierre, notas, transportista:transportistas(nombre), lineas:vale_lineas(cantidad_autorizada, cantidad_retirada, cliente:clientes(nombre))`).order('fecha_creacion', { ascending: false });
    if (!error && data) setVales(data as unknown as Vale[]);
    setLoading(false);
  }

  const valesFiltrados = vales.filter((v) => {
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!v.numero.toLowerCase().includes(q) && !v.transportista?.nombre?.toLowerCase().includes(q) && !v.lineas.some((l) => l.cliente?.nombre?.toLowerCase().includes(q))) return false;
    }
    if (estadoFiltro && v.estado !== estadoFiltro) return false;
    if (fechaDesde && v.fecha_creacion < fechaDesde) return false;
    if (fechaHasta && v.fecha_creacion > fechaHasta + 'T23:59:59') return false;
    return true;
  });

  const totalAut = (v: Vale) => v.lineas.reduce((s, l) => s + l.cantidad_autorizada, 0);
  const totalRet = (v: Vale) => v.lineas.reduce((s, l) => s + l.cantidad_retirada, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1b3a4b] mb-6">Consulta de vales</h1>

      <div className="bg-[#f4f7f9] rounded-lg p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-[#6a8494] font-semibold mb-1 block">Buscar</label>
          <input type="text" placeholder="Nº vale, transportista o cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-[#c5d3dc] text-sm focus:outline-none focus:border-[#2c6382]" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-[#6a8494] font-semibold mb-1 block">Estado</label>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-[#c5d3dc] text-sm focus:outline-none focus:border-[#2c6382]">
            {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-[#6a8494] font-semibold mb-1 block">Desde</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-[#c5d3dc] text-sm focus:outline-none focus:border-[#2c6382]" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-[#6a8494] font-semibold mb-1 block">Hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-[#c5d3dc] text-sm focus:outline-none focus:border-[#2c6382]" />
        </div>
      </div>

      {loading ? (
        <p className="text-[#6a8494]">Cargando...</p>
      ) : valesFiltrados.length === 0 ? (
        <p className="text-[#6a8494]">No se encontraron vales con esos filtros.</p>
      ) : (
        <>
          <div className="hidden md:block bg-[#f4f7f9] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#c5d3dc]">
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#6a8494] font-semibold">Nº Vale</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#6a8494] font-semibold">Transportista</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#6a8494] font-semibold">Clientes</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-[#6a8494] font-semibold">Aut.</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-[#6a8494] font-semibold">Ret.</th>
                  <th className="text-center px-4 py-3 text-xs uppercase tracking-wider text-[#6a8494] font-semibold">Estado</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#6a8494] font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {valesFiltrados.map((v) => {
                  const cs = chipStyle[v.estado] || chipStyle.sin_asignar;
                  return (
                    <tr key={v.id} className="border-b border-[#dce6ec] hover:bg-[#e4ecf0] transition-colors">
                      <td className="px-4 py-3"><Link href={`/consulta/vale/${v.id}`} className="text-[#2c6382] hover:underline font-medium text-xs">{v.numero}</Link></td>
                      <td className="px-4 py-3 text-[#1b3a4b]">{v.transportista?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-[#6a8494]">{v.lineas.map((l) => l.cliente?.nombre).filter(Boolean).join(', ')}</td>
                      <td className="px-4 py-3 text-right">{totalAut(v)}</td>
                      <td className="px-4 py-3 text-right">{totalRet(v)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold uppercase" style={{ background: cs.bg, color: cs.color }}>{v.estado.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6a8494]">{new Date(v.fecha_creacion).toLocaleDateString('es-AR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {valesFiltrados.map((v) => {
              const cs = chipStyle[v.estado] || chipStyle.sin_asignar;
              return (
                <Link key={v.id} href={`/consulta/vale/${v.id}`} className="block bg-[#f4f7f9] rounded-lg p-4 active:bg-[#e4ecf0] transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[#2c6382] font-semibold text-xs">{v.numero}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase" style={{ background: cs.bg, color: cs.color }}>{v.estado.replace('_', ' ')}</span>
                  </div>
                  <div className="text-sm text-[#1b3a4b] mb-1">{v.transportista?.nombre || 'Sin transportista'}</div>
                  <div className="text-xs text-[#6a8494] mb-2">{v.lineas.map((l) => l.cliente?.nombre).filter(Boolean).join(', ')}</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6a8494]"><span className="font-medium text-[#1b3a4b]">{totalRet(v)}</span> / {totalAut(v)} pallets</span>
                    <span className="text-[#6a8494]">{new Date(v.fecha_creacion).toLocaleDateString('es-AR')}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#dce6ec] rounded-full mt-2">
                    <div className="h-1.5 bg-[#2c6382] rounded-full" style={{ width: `${Math.min(100, totalAut(v) > 0 ? (totalRet(v) / totalAut(v)) * 100 : 0)}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-[#6a8494]">{valesFiltrados.length} vale{valesFiltrados.length !== 1 ? 's' : ''} encontrado{valesFiltrados.length !== 1 ? 's' : ''}</p>
    </div>
  );
}
