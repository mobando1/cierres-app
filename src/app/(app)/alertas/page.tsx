'use client';

import { useState, useEffect } from 'react';
import type { Alerta } from '@/lib/types';

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'PENDIENTE' | 'REVISADA' | 'RESUELTA'>('PENDIENTE');

  async function fetchAlertas() {
    const res = await fetch(`/api/alertas?estado=${tab}`);
    if (res.ok) {
      const { data } = await res.json();
      setAlertas(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    fetchAlertas();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function marcar(id: string, estado: string) {
    await fetch('/api/alertas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado }),
    });
    fetchAlertas();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Alertas</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(['PENDIENTE', 'REVISADA', 'RESUELTA'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t ? 'bg-white text-foreground shadow-sm' : 'text-muted'
            }`}
          >
            {t === 'PENDIENTE' ? 'Pendientes' : t === 'REVISADA' ? 'Revisadas' : 'Resueltas'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted text-center py-8">Cargando...</p>
      ) : alertas.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-2">{tab === 'PENDIENTE' ? '✅' : '📭'}</div>
          <p className="text-muted">
            {tab === 'PENDIENTE' ? 'No hay alertas pendientes' : 'No hay alertas'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map((a) => (
            <AlertaCard
              key={a.id}
              alerta={a}
              onMarcar={marcar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertaCard({
  alerta,
  onMarcar,
}: {
  alerta: Alerta;
  onMarcar: (id: string, estado: string) => void;
}) {
  const riesgoColors: Record<string, string> = {
    BAJO: 'bg-warning-light text-warning',
    MEDIO: 'bg-warning-light text-amber-700',
    ALTO: 'bg-danger-light text-danger',
  };
  const riesgoColor = riesgoColors[alerta.nivel_riesgo] || 'bg-gray-100 text-muted';

  const fmt = (n: number) => n.toLocaleString('es-CO');

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-semibold">{alerta.punto}</div>
          <div className="text-sm text-muted">{alerta.responsable} &middot; {alerta.tipo_alerta}</div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${riesgoColor}`}>
          {alerta.nivel_riesgo}
        </span>
      </div>

      {alerta.diferencia_total != null && (
        <div className="text-sm mb-2">
          <span className="text-muted">Diferencia: </span>
          <span className={alerta.diferencia_total < 0 ? 'text-danger font-medium' : 'text-warning font-medium'}>
            ${fmt(Math.abs(alerta.diferencia_total))}
          </span>
        </div>
      )}

      {alerta.accion_recomendada && (
        <p className="text-sm text-muted mb-3">{alerta.accion_recomendada}</p>
      )}

      {alerta.estado === 'PENDIENTE' && (
        <div className="flex gap-2">
          <button
            onClick={() => onMarcar(alerta.id, 'REVISADA')}
            className="flex-1 py-1.5 text-sm border border-card-border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Marcar revisada
          </button>
          <button
            onClick={() => onMarcar(alerta.id, 'RESUELTA')}
            className="flex-1 py-1.5 text-sm bg-success text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Resolver
          </button>
        </div>
      )}

      {alerta.estado === 'REVISADA' && (
        <button
          onClick={() => onMarcar(alerta.id, 'RESUELTA')}
          className="w-full py-1.5 text-sm bg-success text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Marcar resuelta
        </button>
      )}
    </div>
  );
}
