'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import type { Cierre, GastoDetalle } from '@/lib/types';

export default function CierreDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/cierres/${id}`);
      if (res.ok) {
        const { data } = await res.json();
        setCierre(data);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <p className="text-muted text-center py-8">Cargando...</p>;
  if (!cierre) return <p className="text-muted text-center py-8">Cierre no encontrado</p>;

  const fmt = (n: number) => n.toLocaleString('es-CO');

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
          <Row
            label="Diferencia Efectivo"
            value={`$${fmt(cierre.efectivo_diferencia)}`}
            highlight={cierre.efectivo_diferencia !== 0}
          />
          <Row label="Tarjetas Sistema" value={`$${fmt(cierre.tarjetas_otros_sistema)}`} />
          <Row label="Tarjetas Declarado" value={`$${fmt(cierre.tarjetas_otros_declarado)}`} />
          <Row
            label="Diferencia Tarjetas"
            value={`$${fmt(cierre.tarjetas_otros_diferencia)}`}
            highlight={cierre.tarjetas_otros_diferencia !== 0}
          />
          <Divider />
          <Row
            label={cierre.sobrante_faltante_tipo || ''}
            value={`$${fmt(Math.abs(cierre.sobrante_faltante_monto))}`}
            bold
            highlight
          />
        </Section>
      )}

      {/* Sobre */}
      <Section title="Sobre">
        {cierre.efectivo_contado_sobre != null ? (
          <>
            <Row label="Contado en sobre" value={`$${fmt(cierre.efectivo_contado_sobre)}`} />
            <Row
              label="Diferencia vs declarado"
              value={`$${fmt(cierre.sobre_diferencia || 0)}`}
              highlight={(cierre.sobre_diferencia || 0) !== 0}
            />
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

      {/* Auditoría IA */}
      <Section title="Auditoría IA">
        <Row label="Estado" value={cierre.estado_auditoria_ia.replace(/_/g, ' ')} />
        <Row label="Resultado" value={cierre.resultado_auditoria_ia || '-'} />
        <Row label="Acción" value={cierre.accion_recomendada || '-'} />
        {cierre.explicacion_auditoria_ia && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">
            {cierre.explicacion_auditoria_ia}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <h2 className="font-semibold text-foreground mb-2">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  negative,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-muted">{label}</span>
      <span
        className={
          highlight
            ? 'text-danger font-medium'
            : negative
              ? 'text-muted'
              : 'text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-card-border my-1" />;
}

function RiesgoBadge({ nivel }: { nivel: string | null }) {
  const styles = {
    OK: 'bg-success-light text-success',
    BAJO: 'bg-warning-light text-warning',
    MEDIO: 'bg-warning-light text-amber-700',
    ALTO: 'bg-danger-light text-danger',
  }[nivel || 'OK'] || 'bg-gray-100 text-muted';

  return (
    <span className={`text-sm font-medium px-3 py-1 rounded-full ${styles}`}>
      {nivel || 'N/A'}
    </span>
  );
}
