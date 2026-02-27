'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { EstadoSistema } from '@/lib/types';

const TendenciaChart = dynamic(() => import('@/components/TendenciaChart'), { ssr: false });

interface Metricas {
  resumen: { totalCierres: number; cuadran: number; descuadres: number; faltanteTotal: number; sobranteTotal: number };
  porPunto: Array<{ punto: string; cierres: number; faltante: number; sobrante: number }>;
  porCajero: Array<{ responsable: string; cierres: number; faltante: number; promedioDif: number }>;
  tendencia: Array<{ fecha: string; diferencia: number }>;
}

export default function DashboardPage() {
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [periodo, setPeriodo] = useState(7);
  const [texto, setTexto] = useState('');
  const [ingestResult, setIngestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEstado = useCallback(async () => {
    const res = await fetch('/api/estado');
    if (res.ok) setEstado(await res.json());
  }, []);

  const fetchMetricas = useCallback(async (dias: number) => {
    const res = await fetch(`/api/metricas?dias=${dias}`);
    if (res.ok) setMetricas(await res.json());
  }, []);

  useEffect(() => {
    fetchEstado();
    fetchMetricas(periodo);
  }, [fetchEstado, fetchMetricas, periodo]);

  const fmt = (n: number) => Math.abs(n).toLocaleString('es-CO');

  async function handleIngest() {
    if (!texto.trim()) return;
    setLoading(true);
    setIngestResult(null);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const data = await res.json();

      if (data.success) {
        setIngestResult({
          success: true,
          message: `${data.cierres_procesados} cierre(s) procesados. ${data.resumen}`,
        });
        setTexto('');
        fetchEstado();
        fetchMetricas(periodo);
      } else {
        setIngestResult({
          success: false,
          message: data.error || 'Error procesando',
        });
      }
    } catch {
      setIngestResult({ success: false, message: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Estado del sistema */}
      <div className="grid grid-cols-3 gap-3">
        <StatusCard
          label="Esperando Sobre"
          count={estado?.esperandoSobre ?? '-'}
          href="/sobres"
          color="warning"
        />
        <StatusCard
          label="Pendientes IA"
          count={estado?.pendientesIA ?? '-'}
          href="/cierres?estado=IA_PENDIENTE"
          color="accent"
        />
        <StatusCard
          label="Alertas"
          count={estado?.alertasActivas ?? '-'}
          href="/alertas"
          color="danger"
        />
      </div>

      {/* Métricas del período */}
      {metricas && (
        <>
          {/* Selector de período */}
          <div className="flex gap-2">
            {[7, 30].map((d) => (
              <button
                key={d}
                onClick={() => setPeriodo(d)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  periodo === d ? 'bg-accent text-white' : 'bg-card border border-card-border text-muted hover:bg-gray-50'
                }`}
              >
                {d} dias
              </button>
            ))}
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-card-border rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-foreground">{metricas.resumen.totalCierres}</div>
              <div className="text-xs text-muted">Total cierres</div>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-success">{metricas.resumen.cuadran}</div>
              <div className="text-xs text-muted">Cuadran</div>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-danger">{metricas.resumen.descuadres}</div>
              <div className="text-xs text-muted">Descuadres</div>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold ${metricas.resumen.faltanteTotal > 0 ? 'text-danger' : 'text-success'}`}>
                ${fmt(metricas.resumen.faltanteTotal)}
              </div>
              <div className="text-xs text-muted">Faltante total</div>
            </div>
          </div>

          {/* Gráfica de tendencia */}
          {metricas.tendencia.length > 1 && (
            <div className="bg-card border border-card-border rounded-xl p-4">
              <h2 className="font-semibold text-foreground mb-3">Tendencia diaria</h2>
              <TendenciaChart data={metricas.tendencia} />
            </div>
          )}

          {/* Por punto */}
          {metricas.porPunto.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-4">
              <h2 className="font-semibold text-foreground mb-3">Por restaurante</h2>
              <div className="space-y-2">
                {metricas.porPunto.map((p) => (
                  <div key={p.punto} className="flex justify-between items-center text-sm">
                    <div>
                      <div className="font-medium text-foreground">{p.punto}</div>
                      <div className="text-xs text-muted">{p.cierres} cierres</div>
                    </div>
                    <div className="text-right">
                      {p.faltante > 0 && <div className="text-danger text-xs">-${fmt(p.faltante)}</div>}
                      {p.sobrante > 0 && <div className="text-warning text-xs">+${fmt(p.sobrante)}</div>}
                      {p.faltante === 0 && p.sobrante === 0 && <div className="text-success text-xs">OK</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Por cajero */}
          {metricas.porCajero.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-4">
              <h2 className="font-semibold text-foreground mb-3">Por cajero</h2>
              <div className="space-y-2">
                {metricas.porCajero.map((c) => (
                  <div key={c.responsable} className="flex justify-between items-center text-sm">
                    <div>
                      <div className="font-medium text-foreground">{c.responsable}</div>
                      <div className="text-xs text-muted">{c.cierres} cierres</div>
                    </div>
                    <div className="text-right">
                      {c.faltante > 0 && <div className="text-danger text-xs">-${fmt(c.faltante)}</div>}
                      <div className="text-xs text-muted">Prom: ${fmt(c.promedioDif)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Ingesta WhatsApp */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <h2 className="font-semibold text-foreground mb-2">Pegar cierre WhatsApp</h2>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pega aquí el mensaje de WhatsApp del cierre de caja..."
          rows={6}
          className="w-full px-3 py-2 border border-card-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-white resize-none text-sm"
        />
        <button
          onClick={handleIngest}
          disabled={loading || !texto.trim()}
          className="mt-2 w-full py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Procesando...' : 'Procesar cierre'}
        </button>

        {ingestResult && (
          <div
            className={`mt-3 text-sm rounded-lg px-3 py-2 ${
              ingestResult.success
                ? 'bg-success-light text-success'
                : 'bg-danger-light text-danger'
            }`}
          >
            {ingestResult.message}
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 gap-3">
        <QuickAction href="/cierres" label="Ver cierres" />
        <QuickAction href="/sobres" label="Contar sobres" />
        <QuickAction href="/alertas" label="Ver alertas" />
        <QuickAction href="/cierres" label="Todos los cierres" />
      </div>
    </div>
  );
}

function StatusCard({
  label,
  count,
  href,
  color,
}: {
  label: string;
  count: number | string;
  href: string;
  color: 'warning' | 'accent' | 'danger';
}) {
  const bg = color === 'warning' ? 'bg-warning-light' : color === 'danger' ? 'bg-danger-light' : 'bg-accent-light';
  const text = color === 'warning' ? 'text-warning' : color === 'danger' ? 'text-danger' : 'text-accent';

  return (
    <Link href={href} className={`${bg} rounded-xl p-3 text-center block`}>
      <div className={`text-2xl font-bold ${text}`}>{count}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </Link>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center bg-card border border-card-border rounded-lg px-3 py-3 hover:bg-gray-50 transition-colors"
    >
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
