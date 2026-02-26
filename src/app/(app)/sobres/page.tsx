'use client';

import { useState, useEffect } from 'react';

interface SobrePendiente {
  id: string;
  fecha: string;
  punto: string;
  responsable: string | null;
  id_cierre: number | null;
  efectivo_declarado: number;
  sobrante_faltante_monto: number;
  sobrante_faltante_tipo: string;
  nivel_riesgo: string;
}

export default function SobresPage() {
  const [pendientes, setPendientes] = useState<SobrePendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [formId, setFormId] = useState<string | null>(null);
  const [contado, setContado] = useState('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function fetchPendientes() {
    const res = await fetch('/api/sobres');
    if (res.ok) {
      const { data } = await res.json();
      setPendientes(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchPendientes();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formId || !contado) return;
    setSubmitting(true);
    setResult(null);

    const res = await fetch('/api/sobres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cierre_id: formId,
        efectivo_contado: parseInt(contado.replace(/[,.\s]/g, '')),
        notas: notas || undefined,
      }),
    });
    const data = await res.json();

    if (data.success) {
      setResult({ success: true, message: `Sobre registrado: ${data.sobre_estado}. Diferencia: $${data.diferencia?.toLocaleString('es-CO')}` });
      setFormId(null);
      setContado('');
      setNotas('');
      fetchPendientes();
    } else {
      setResult({ success: false, message: data.error || 'Error' });
    }
    setSubmitting(false);
  }

  const fmt = (n: number) => n.toLocaleString('es-CO');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Conteo de sobres</h1>

      {result && (
        <div className={`text-sm rounded-lg px-3 py-2 ${result.success ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
          {result.message}
        </div>
      )}

      {loading ? (
        <p className="text-muted text-center py-8">Cargando...</p>
      ) : pendientes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-muted">No hay sobres pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendientes.map((s) => (
            <div key={s.id} className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{s.punto}</div>
                  <div className="text-sm text-muted">{s.fecha} &middot; {s.responsable}</div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  s.nivel_riesgo === 'ALTO' ? 'bg-danger-light text-danger' : 'bg-warning-light text-warning'
                }`}>
                  {s.nivel_riesgo}
                </span>
              </div>

              <div className="text-sm mb-3">
                <span className="text-muted">Declarado: </span>
                <span className="font-medium">${fmt(s.efectivo_declarado)}</span>
                <span className="text-muted ml-3">{s.sobrante_faltante_tipo}: </span>
                <span className={s.sobrante_faltante_monto < 0 ? 'text-danger font-medium' : 'text-warning font-medium'}>
                  ${fmt(Math.abs(s.sobrante_faltante_monto))}
                </span>
              </div>

              {formId === s.id ? (
                <form onSubmit={handleSubmit} className="space-y-2 border-t border-card-border pt-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Efectivo contado en sobre</label>
                    <input
                      type="number"
                      value={contado}
                      onChange={(e) => setContado(e.target.value)}
                      placeholder="Ej: 350000"
                      required
                      className="w-full px-3 py-2 border border-card-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Notas (opcional)</label>
                    <input
                      type="text"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Observaciones..."
                      className="w-full px-3 py-2 border border-card-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-white text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-2 bg-accent text-white font-medium rounded-lg text-sm disabled:opacity-50"
                    >
                      {submitting ? 'Guardando...' : 'Registrar conteo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFormId(null); setContado(''); setNotas(''); }}
                      className="px-4 py-2 border border-card-border rounded-lg text-sm text-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setFormId(s.id)}
                  className="w-full py-2 bg-accent text-white font-medium rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Contar sobre
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
