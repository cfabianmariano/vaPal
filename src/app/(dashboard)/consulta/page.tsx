'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import Link from 'next/link';

type Vale = {
  id: string;
  numero: string;
  estado: string;
  fecha_creacion: string;
  fecha_cierre: string | null;
  notas: string | null;
  transportista: { nombre: string } | null;
  lineas: {
    cantidad_autorizada: number;
    cantidad_retirada: number;
    cliente: { nombre: string } | null;
  }[];
};

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'sin_asignar', label: 'Sin asignar' },
  { value: 'asignado', label: 'Asignado' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'completo', label: 'Completo' },
  { value: 'cerrado', label: 'Cerrado' },
];

const chipColor: Record<string, string> = {
  sin_asignar: 'bg-gray-200 text-gray-600',
  asignado: 'bg-blue-100 text-blue-700',
  en_curso: 'bg-amber-100 text-amber-700',
  parcial: 'bg-orange-100 text-orange-700',
  completo: 'bg-green-100 text-green-700',
  cerrado: 'bg-gray-300 text-gray-600',
};

export default function ConsultaPage() {
  const supabase = createClient();
  const [vales, setVales] = useState<Vale[]>([]);
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => {
    cargarVales();
  }, []);

  async function cargarVales() {
    setLoading(true);
    const { data, error } = await supabase
      .from('vales')
      .select(`
        id, numero, estado, fecha_creacion, fecha_cierre, notas,
        transportista:transportistas(nombre),
        lineas:vale_lineas(
          cantidad_autorizada, cantidad_retirada,
          cliente:clientes(nombre)
        )
      `)
      .order('fecha_creacion', { ascending: false });

    if (!error && data) setVales(data as unknown as Vale[]);
    setLoading(false);
  }

  const valesFiltrados = vales.filter((v) => {
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const matchNumero = v.numero.toLowerCase().includes(q);
      const matchTransp = v.transportista?.nombre?.toLowerCase().includes(q);
      const matchCliente = v.lineas.some((l) => l.cliente?.nombre?.toLowerCase().includes(q));
      if (!matchNumero && !matchTransp && !matchCliente) return false;
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
      <h1 className="text-2xl font-semibold text-[#1E2A38] mb-6">Consulta de vales</h1>

      {/* Filtros */}
      <div className="bg-[#CDD5DA] rounded-lg p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-[#4E5C68] mb-1 block">Buscar</label>
          <input
            type="text"
            placeholder="Nº vale, transportista o cliente"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-[#8C99A1] text-sm focus:outline-none focus:border-[#2E4A63]"
          />
        </div>
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-[#4E5C68] mb-1 block">Estado</label>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-[#8C99A1] text-sm focus:outline-none focus:border-[#2E4A63]"
          >
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-[#4E5C68] mb-1 block">Desde</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-[#8C99A1] text-sm focus:outline-none focus:border-[#2E4A63]" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-[#4E5C68] mb-1 block">Hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-[#8C99A1] text-sm focus:outline-none focus:border-[#2E4A63]" />
        </div>
      </div>

      {/* Resultados */}
      {loading ? (
        <p className="text-[#4E5C68]">Cargando...</p>
      ) : valesFiltrados.length === 0 ? (
        <p className="text-[#4E5C68]">No se encontraron vales con esos filtros.</p>
      ) : (
        <>
          {/* Tabla desktop */}
          <div className="hidden md:block bg-[#CDD5DA] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#8C99A1]">
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#4E5C68]">Nº Vale</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#4E5C68]">Transportista</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#4E5C68]">Clientes</th>
                  <th className="text-right px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#4E5C68]">Aut.</th>
                  <th className="text-right px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#4E5C68]">Ret.</th>
                  <th className="text-center px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#4E5C68]">Estado</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#4E5C68]">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {valesFiltrados.map((v) => (
                  <tr key={v.id} className="border-b border-[#B4BEC4] hover:bg-[#B4BEC4] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/consulta/vale/${v.id}`} className="font-mono text-[#2E4A63] hover:underline font-medium">
                        {v.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#1E2A38]">{v.transportista?.nombre || '—'}</td>
                    <td className="px-4 py-3 text-[#4E5C68]">{v.lineas.map((l) => l.cliente?.nombre).filter(Boolean).join(', ')}</td>
                    <td className="px-4 py-3 text-right font-mono">{totalAut(v)}</td>
                    <td className="px-4 py-3 text-right font-mono">{totalRet(v)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono font-semibold uppercase ${chipColor[v.estado] || ''}`}>
                        {v.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#4E5C68]">
                      {new Date(v.fecha_creacion).toLocaleDateString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas mobile */}
          <div className="md:hidden space-y-3">
            {valesFiltrados.map((v) => (
              <Link key={v.id} href={`/consulta/vale/${v.id}`} className="block bg-[#CDD5DA] rounded-lg p-4 active:bg-[#B4BEC4] transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-[#2E4A63] font-semibold">{v.numero}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold uppercase ${chipColor[v.estado] || ''}`}>
                    {v.estado.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-sm text-[#1E2A38] mb-1">
                  {v.transportista?.nombre || 'Sin transportista'}
                </div>
                <div className="text-xs text-[#4E5C68] mb-2">
                  {v.lineas.map((l) => l.cliente?.nombre).filter(Boolean).join(', ')}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#4E5C68]">
                    <span className="font-mono font-medium text-[#1E2A38]">{totalRet(v)}</span> / {totalAut(v)} pallets
                  </span>
                  <span className="font-mono text-[#4E5C68]">
                    {new Date(v.fecha_creacion).toLocaleDateString('es-AR')}
                  </span>
                </div>
                {/* Barra de progreso */}
                <div className="w-full h-1.5 bg-[#B4BEC4] rounded-full mt-2">
                  <div className="h-1.5 bg-[#2E4A63] rounded-full" style={{ width: `${Math.min(100, totalAut(v) > 0 ? (totalRet(v) / totalAut(v)) * 100 : 0)}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-[#4E5C68]">
        {valesFiltrados.length} vale{valesFiltrados.length !== 1 ? 's' : ''} encontrado{valesFiltrados.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
