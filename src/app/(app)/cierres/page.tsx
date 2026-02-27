'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Cierre } from '@/lib/types';

export default function CierresPage() {
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/cierres?limit=50');
      if (res.ok) {
        const { data } = await res.json();
        setCierres(data || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filtro
    ? cierres.filter(
        (c) =>
          c.punto.toLowerCase().includes(filtro.toLowerCase()) ||
          c.fecha.includes(filtro) ||
          c.responsable?.toLowerCase().includes(filtro.toLowerCase()),
      )
    : cierres;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Cierres de caja</h1>

      <input
        type="text"
        placeholder="Buscar por punto, fecha o responsable..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full px-3 py-2 border border-card-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-white text-sm"
      />

      {loading ? (
        <p className="text-muted text-center py-8">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted text-center py-8">No hay cierres</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <CierreCard key={c.id} cierre={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CierreCard({ cierre }: { cierre: Cierre }) {
  const riesgoBadges: Record<string, string> = {
    OK: 'bg-success-light text-success',
    BAJO: 'bg-warning-light text-warning',
    MEDIO: 'bg-warning-light text-amber-700',
    ALTO: 'bg-danger-light text-danger',
  };
  const riesgoBadge = riesgoBadges[cierre.nivel_riesgo || 'OK'] || 'bg-gray-100 text-muted';

  const estadoBadges: Record<string, string> = {
    PENDIENTE: 'bg-gray-100 text-muted',
    ESPERANDO_SOBRE: 'bg-warning-light text-warning',
    IA_PENDIENTE: 'bg-accent-light text-accent',
    IA_COMPLETADO: 'bg-success-light text-success',
    IA_ERROR: 'bg-danger-light text-danger',
  };
  const estadoBadge = estadoBadges[cierre.estado_auditoria_ia] || 'bg-gray-100 text-muted';

  const sfMonto = cierre.sobrante_faltante_monto || 0;
  const sfTipo = cierre.sobrante_faltante_tipo || '';

  return (
    <Link
      href={`/cierres/${cierre.id}`}
      className="block bg-card border border-card-border rounded-xl p-4 hover:border-accent/30 transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-semibold text-foreground">{cierre.punto}</div>
          <div className="text-sm text-muted">{cierre.fecha} &middot; {cierre.responsable}</div>
          <div className="text-xs text-muted">
            {cierre.id_cierre != null && <>#{cierre.id_cierre}</>}
            {(cierre.hora_inicio || cierre.hora_fin) && (
              <> &middot; {cierre.hora_inicio || '?'} - {cierre.hora_fin || '?'}</>
            )}
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${riesgoBadge}`}>
          {cierre.nivel_riesgo || 'N/A'}
        </span>
      </div>

      <div className="flex justify-between items-end">
        <div className="text-sm">
          {sfTipo !== 'SIN_DECLARADO' && sfTipo !== 'OK' && sfMonto !== 0 ? (
            <span className={sfMonto < 0 ? 'text-danger' : 'text-warning'}>
              {sfTipo} ${Math.abs(sfMonto).toLocaleString('es-CO')}
            </span>
          ) : sfTipo === 'OK' ? (
            <span className="text-success">Cuadra</span>
          ) : (
            <span className="text-muted">Sin declarado</span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${estadoBadge}`}>
          {cierre.estado_auditoria_ia.replace(/_/g, ' ')}
        </span>
      </div>
    </Link>
  );
}
