'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { EstadoSistema } from '@/lib/types';

export default function DashboardPage() {
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [texto, setTexto] = useState('');
  const [ingestResult, setIngestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEstado = useCallback(async () => {
    const res = await fetch('/api/estado');
    if (res.ok) setEstado(await res.json());
  }, []);

  useEffect(() => {
    fetchEstado();
  }, [fetchEstado]);

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
      <div className="space-y-2">
        <h2 className="font-semibold text-foreground">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction href="/cierres" label="Ver cierres" icon="📋" />
          <QuickAction href="/sobres" label="Contar sobres" icon="💼" />
          <QuickAction href="/alertas" label="Ver alertas" icon="🔔" />
          <QuickAction href="/cierres?fecha=hoy" label="Cierres de hoy" icon="📅" />
        </div>
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

function QuickAction({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 bg-card border border-card-border rounded-lg px-3 py-3 hover:bg-gray-50 transition-colors"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
