import type { IAAnalysisJSON } from '@/lib/types';

export function IAReport({ explicacion }: { explicacion: string }) {
  const fmt = (n: number) => n.toLocaleString('es-CO');

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
