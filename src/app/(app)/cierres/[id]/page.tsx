'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import type { Cierre, GastoDetalle } from '@/lib/types';
import { Section, Row, Divider, RiesgoBadge } from '@/components/cierre/ui';
import { IAReport } from '@/components/cierre/IAReport';

export default function CierreDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [loading, setLoading] = useState(true);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);
  const [obsTexto, setObsTexto] = useState('');
  const [obsSaving, setObsSaving] = useState(false);
  const [obsSaved, setObsSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/cierres/${id}`);
      if (res.ok) {
        const { data } = await res.json();
        setCierre(data);
        setObsTexto(data?.observaciones_admin || '');
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function triggerIA() {
    if (!cierre) return;
    setIaLoading(true);
    setIaError(null);
    try {
      const res = await fetch('/api/ia/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cierre_id: cierre.id }),
      });
      const data = await res.json();
      if (data.success) {
        const res2 = await fetch(`/api/cierres/${id}`);
        if (res2.ok) {
          const { data: updated } = await res2.json();
          setCierre(updated);
        }
      } else {
        setIaError(data.details ? `${data.error}: ${data.details}` : (data.error || 'Error en análisis'));
      }
    } catch {
      setIaError('Error de conexión');
    } finally {
      setIaLoading(false);
    }
  }

  async function saveObservaciones() {
    if (!cierre || !obsTexto.trim()) return;
    setObsSaving(true);
    setObsSaved(false);
    try {
      const res = await fetch(`/api/cierres/${id}/observaciones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observaciones: obsTexto.trim() }),
      });
      if (res.ok) {
        setObsSaved(true);
        setCierre({ ...cierre, observaciones_admin: obsTexto.trim() });
        setTimeout(() => setObsSaved(false), 3000);
      }
    } catch {
      // silently fail
    } finally {
      setObsSaving(false);
    }
  }

  if (loading) return <p className="text-muted text-center py-8">Cargando...</p>;
  if (!cierre) return <p className="text-muted text-center py-8">Cierre no encontrado</p>;

  const fmt = (n: number) => n.toLocaleString('es-CO');
  const estadoIA = cierre.estado_auditoria_ia;
  const puedeAnalizarIA = ['IA_PENDIENTE', 'IA_ERROR', 'IA_COMPLETADO'].includes(estadoIA);
  const esperandoSobre = estadoIA === 'ESPERANDO_SOBRE';

  return (
    <div className="space-y-4">
      <Link href="/cierres" className="text-accent text-sm">&larr; Volver a cierres</Link>

      {/* Header */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold">{cierre.punto}</h1>
            <p className="text-sm text-muted">{cierre.fecha} &middot; ID {cierre.id_cierre}</p>
            <p className="text-sm text-muted">{cierre.responsable} &middot; Caja: {cierre.caja}</p>
          </div>
          <RiesgoBadge nivel={cierre.nivel_riesgo} />
        </div>
      </div>

      {/* Cuadre de caja */}
      <Section title="Cuadre de caja">
        <Row label="Efectivo Inicial" value={fmt(cierre.efectivo_inicial)} />
        <Row label="Ventas en Efectivo" value={fmt(cierre.ventas_efectivo)} />
        <Row label="Gastos en Efectivo" value={fmt(cierre.gastos_efectivo)} negative />
        <Row label="Traslados de Caja" value={fmt(cierre.traslados_caja)} />
        <Row label="Abonos en Efectivo" value={fmt(cierre.abonos_efectivo)} />
        <Divider />
        <Row label="EFECTIVO" value={fmt(cierre.efectivo_total)} bold />
        <Row label="Propinas" value={fmt(cierre.propinas)} />
        <Row label="Domicilios" value={fmt(cierre.domicilios)} />
        <Row label="TOTAL EFECTIVO" value={fmt(cierre.total_efectivo_sistema)} bold />
      </Section>

      {/* Ventas */}
      <Section title="Datos de ventas">
        <Row label="Ingreso de Ventas" value={fmt(cierre.ingreso_ventas)} />
        <Row label="Descuentos" value={fmt(cierre.descuentos)} negative />
        <Row label="Créditos" value={fmt(cierre.creditos)} />
        <Row label="TOTAL INGRESOS" value={fmt(cierre.total_ingresos)} bold />
        <Row label="Total Gastos" value={fmt(cierre.total_gastos)} negative />
      </Section>

      {/* Formas de pago */}
      {cierre.formas_pago && Object.keys(cierre.formas_pago).length > 0 && (
        <Section title="Formas de pago">
          {Object.entries(cierre.formas_pago).map(([forma, monto]) => (
            <Row key={forma} label={forma} value={`$${fmt(monto as number)}`} />
          ))}
        </Section>
      )}

      {/* Gastos detalle */}
      {cierre.gastos_detalle && cierre.gastos_detalle.length > 0 && (
        <Section title="Gastos detalle">
          {(cierre.gastos_detalle as GastoDetalle[]).map((g, i) => (
            <Row key={i} label={`${g.categoria} (${g.cantidad})`} value={`$${fmt(g.monto)}`} negative />
          ))}
        </Section>
      )}

      {/* Dinero declarado */}
      {cierre.sobrante_faltante_tipo !== 'SIN_DECLARADO' && (
        <Section title="Dinero declarado">
          <Row label="Efectivo Sistema" value={`$${fmt(cierre.efectivo_sistema)}`} />
          <Row label="Efectivo Declarado" value={`$${fmt(cierre.efectivo_declarado)}`} />
          <Row label="Diferencia Efectivo" value={`$${fmt(cierre.efectivo_diferencia)}`} highlight={cierre.efectivo_diferencia !== 0} />
          <Row label="Tarjetas Sistema" value={`$${fmt(cierre.tarjetas_otros_sistema)}`} />
          <Row label="Tarjetas Declarado" value={`$${fmt(cierre.tarjetas_otros_declarado)}`} />
          <Row label="Diferencia Tarjetas" value={`$${fmt(cierre.tarjetas_otros_diferencia)}`} highlight={cierre.tarjetas_otros_diferencia !== 0} />
          <Divider />
          <Row label={cierre.sobrante_faltante_tipo || ''} value={`$${fmt(Math.abs(cierre.sobrante_faltante_monto))}`} bold highlight />
        </Section>
      )}

      {/* Sobre */}
      <Section title="Sobre">
        {cierre.efectivo_contado_sobre != null ? (
          <>
            <Row label="Declarado" value={`$${fmt(cierre.efectivo_declarado)}`} />
            <Row label="Base dejada (apertura)" value={`$${fmt(cierre.apertura_valor)}`} />
            <Row label="Sobre esperado" value={`$${fmt(cierre.efectivo_declarado - cierre.apertura_valor)}`} bold />
            <Divider />
            <Row label="Sobre contado" value={`$${fmt(cierre.efectivo_contado_sobre)}`} bold />
            <Row label="Diferencia" value={`$${fmt(cierre.sobre_diferencia || 0)}`} highlight={(cierre.sobre_diferencia || 0) !== 0} />
            <Row label="Estado" value={cierre.sobre_estado || '-'} />
            {cierre.sobre_notas && <Row label="Notas" value={cierre.sobre_notas} />}
          </>
        ) : (
          <p className="text-sm text-muted py-1">Pendiente de conteo</p>
        )}
      </Section>

      {/* Apertura */}
      {cierre.apertura_usuario && (
        <Section title="Apertura siguiente">
          <Row label="Usuario" value={cierre.apertura_usuario} />
          <Row label="Valor" value={`$${fmt(cierre.apertura_valor)}`} />
        </Section>
      )}

      {/* Observaciones Admin */}
      <Section title="Observaciones">
        <textarea
          value={obsTexto}
          onChange={(e) => { setObsTexto(e.target.value); setObsSaved(false); }}
          placeholder="Escribe observaciones sobre este cierre... (se guardan como aprendizaje para la IA)"
          rows={3}
          className="w-full px-3 py-2 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={saveObservaciones}
            disabled={obsSaving || !obsTexto.trim()}
            className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {obsSaving ? 'Guardando...' : 'Guardar'}
          </button>
          {obsSaved && <span className="text-sm text-success">Guardado</span>}
        </div>
      </Section>

      {/* Auditoría IA */}
      <Section title="Auditoría IA">
        <Row label="Estado" value={estadoIA.replace(/_/g, ' ')} />

        {esperandoSobre && (
          <div className="mt-2 p-3 bg-warning-light rounded-lg">
            <p className="text-sm text-amber-800 font-medium">Primero cuenta el sobre para habilitar el análisis IA</p>
            <Link href="/sobres" className="text-sm text-accent font-medium mt-1 inline-block">
              Ir a contar sobre &rarr;
            </Link>
          </div>
        )}

        {puedeAnalizarIA && !iaLoading && (
          <button
            onClick={triggerIA}
            className="mt-2 w-full py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {estadoIA === 'IA_COMPLETADO' ? 'Re-analizar con IA' : 'Analizar con IA'}
          </button>
        )}

        {iaLoading && (
          <div className="mt-2 p-3 bg-accent-light rounded-lg text-center">
            <p className="text-sm text-accent font-medium">Analizando con IA... puede tardar hasta 1 minuto</p>
          </div>
        )}

        {iaError && (
          <div className="mt-2 p-3 bg-danger-light rounded-lg">
            <p className="text-sm text-danger">{iaError}</p>
          </div>
        )}
      </Section>

      {/* Reporte IA visual */}
      {cierre.explicacion_auditoria_ia && (
        <IAReport explicacion={cierre.explicacion_auditoria_ia} />
      )}
    </div>
  );
}
