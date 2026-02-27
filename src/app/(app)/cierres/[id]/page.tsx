'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import type { Cierre, GastoDetalle, IAAnalysisJSON } from '@/lib/types';

export default function CierreDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [loading, setLoading] = useState(true);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);

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
        // Recargar cierre con nuevos datos
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
        <Row label="Estado" value={estadoIA.replace(/_/g, ' ')} />

        {/* Botón para disparar IA */}
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

// =====================================================================
// IA REPORT — Vista visual del análisis
// =====================================================================

function IAReport({ explicacion }: { explicacion: string }) {
  const fmt = (n: number) => n.toLocaleString('es-CO');

  // Intentar parsear JSON
  let ia: IAAnalysisJSON | null = null;
  try {
    const match = explicacion.match(/\{[\s\S]*\}/);
    if (match) ia = JSON.parse(match[0]);
  } catch {
    // Fallback a texto plano
  }

  if (!ia) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-4">
        <h2 className="font-semibold text-foreground mb-2">Reporte IA</h2>
        <div className="text-sm whitespace-pre-wrap text-muted">{explicacion}</div>
      </div>
    );
  }

  const vStyles = {
    CUADRA: { bg: 'bg-success-light', text: 'text-success', label: 'CUADRA' },
    DESCUADRE_MENOR: { bg: 'bg-warning-light', text: 'text-amber-700', label: 'DESCUADRE MENOR' },
    DESCUADRE_MAYOR: { bg: 'bg-danger-light', text: 'text-danger', label: 'DESCUADRE MAYOR' },
  }[ia.veredicto] || { bg: 'bg-gray-100', text: 'text-muted', label: ia.veredicto };

  return (
    <div className="space-y-3">
      {/* Veredicto + Resumen */}
      <div className={`${vStyles.bg} rounded-xl p-4 text-center`}>
        <div className={`text-lg font-bold ${vStyles.text}`}>{vStyles.label}</div>
        <p className="text-sm text-foreground mt-1">{ia.resumen}</p>
      </div>

      {/* Efectivo */}
      {ia.efectivo && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <h3 className="font-semibold text-foreground mb-2">Efectivo</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-muted text-xs">Sistema</div>
              <div className="font-semibold">${fmt(ia.efectivo.sistema)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-muted text-xs">Declarado</div>
              <div className="font-semibold">${fmt(ia.efectivo.declarado)}</div>
            </div>
            {ia.efectivo.sobre != null && (
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-muted text-xs">Sobre</div>
                <div className="font-semibold">${fmt(ia.efectivo.sobre)}</div>
              </div>
            )}
            <div className={`rounded-lg p-2 text-center ${ia.efectivo.diferencia !== 0 ? 'bg-danger-light' : 'bg-success-light'}`}>
              <div className="text-muted text-xs">Diferencia</div>
              <div className={`font-semibold ${ia.efectivo.diferencia !== 0 ? 'text-danger' : 'text-success'}`}>
                ${fmt(ia.efectivo.diferencia)}
              </div>
            </div>
          </div>
          {ia.efectivo.explicacion && (
            <p className="text-xs text-muted mt-2">{ia.efectivo.explicacion}</p>
          )}
        </div>
      )}

      {/* Gastos verificados */}
      {ia.gastos && ia.gastos.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <h3 className="font-semibold text-foreground mb-2">
            Gastos ({ia.gastos.filter(g => g.verificado).length}/{ia.gastos.length} verificados)
          </h3>
          <div className="space-y-1.5">
            {ia.gastos.map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${g.verificado ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
                  {g.verificado ? '\u2713' : '\u2717'}
                </span>
                <span className="flex-1 text-foreground truncate">{g.concepto}</span>
                <span className="font-medium text-foreground">${fmt(g.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transferencias */}
      {ia.transferencias && ia.transferencias.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <h3 className="font-semibold text-foreground mb-2">Transferencias</h3>
          <div className="space-y-1.5">
            {ia.transferencias.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${t.verificado ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
                  {t.verificado ? '\u2713' : '\u2717'}
                </span>
                <span className="flex-1 text-foreground">{t.tipo}</span>
                <span className="font-medium text-foreground">${fmt(t.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verificación matemática */}
      {ia.verificacion_matematica && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <h3 className="font-semibold text-foreground mb-2">Verificacion matematica</h3>
          <div className="space-y-1.5 text-sm">
            <FormulaRow label="Efectivo" value={ia.verificacion_matematica.formula_efectivo} />
            <FormulaRow label="Declarado" value={ia.verificacion_matematica.formula_declarado} />
            <FormulaRow label="Turnos" value={ia.verificacion_matematica.cadena_turnos} />
          </div>
        </div>
      )}

      {/* Anomalías */}
      {ia.anomalias && ia.anomalias.length > 0 && (
        <div className="bg-danger-light border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-danger mb-2">Anomalias</h3>
          <ul className="space-y-1">
            {ia.anomalias.map((a, i) => (
              <li key={i} className="text-sm text-red-800 flex gap-2">
                <span className="flex-shrink-0">!</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Documentos no legibles */}
      {ia.documentos_no_legibles && ia.documentos_no_legibles.length > 0 && (
        <div className="bg-warning-light border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 mb-1 text-sm">Documentos no legibles</h3>
          <p className="text-sm text-amber-700">{ia.documentos_no_legibles.join(', ')}</p>
        </div>
      )}

      {/* Acción recomendada */}
      {ia.accion && (
        <div className="bg-accent-light border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-accent mb-1 text-sm">Accion recomendada</h3>
          <p className="text-sm text-blue-800">{ia.accion}</p>
        </div>
      )}
    </div>
  );
}

function FormulaRow({ label, value }: { label: string; value: string }) {
  const isOk = value.startsWith('OK');
  const isNA = value.startsWith('N/A');
  return (
    <div className="flex items-start gap-2">
      <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isOk ? 'bg-success-light text-success' : isNA ? 'bg-gray-100 text-muted' : 'bg-danger-light text-danger'}`}>
        {isOk ? '\u2713' : isNA ? '-' : '\u2717'}
      </span>
      <div>
        <span className="font-medium text-foreground">{label}: </span>
        <span className="text-muted">{value}</span>
      </div>
    </div>
  );
}
