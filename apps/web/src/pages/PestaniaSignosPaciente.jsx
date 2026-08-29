import {
  estaFueraDeRango,
  formatearFechaCorta,
  ultimaMedicion,
  useEvolucionSignos,
} from '@ecopac/shared';

import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';

const ANCHO = 560;
const ALTO = 180;
const MARGEN = { arriba: 12, derecha: 12, abajo: 28, izquierda: 44 };
const COLORES_DE_LINEA = ['var(--color-primary)', 'var(--color-info)'];

function escala(serie) {
  const min = serie.min ?? 0;
  const max = serie.max ?? 1;
  const holgura = (max - min) * 0.1 || 1;
  const piso = min - holgura;
  const techo = max + holgura;

  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const total = Math.max(serie.mediciones - 1, 1);

  return {
    piso,
    techo,
    x: (indice) => MARGEN.izquierda + (anchoUtil * indice) / total,
    y: (valor) => MARGEN.arriba + altoUtil * (1 - (valor - piso) / (techo - piso)),
  };
}

function Grafica({ serie }) {
  const { piso, techo, x, y } = escala(serie);
  const fechas = serie.lineas[0]?.puntos ?? [];

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      style={{ width: '100%', height: 'auto' }}
      role="img"
      aria-label={`Evolucion de ${serie.label}`}
    >
      {serie.lineas.map((linea) =>
        linea.normal ? (
          <rect
            key={`banda-${linea.id}`}
            x={MARGEN.izquierda}
            y={y(linea.normal.max)}
            width={ANCHO - MARGEN.izquierda - MARGEN.derecha}
            height={Math.max(y(linea.normal.min) - y(linea.normal.max), 1)}
            fill="var(--color-success)"
            opacity="0.12"
          />
        ) : null,
      )}

      <line
        x1={MARGEN.izquierda}
        y1={ALTO - MARGEN.abajo}
        x2={ANCHO - MARGEN.derecha}
        y2={ALTO - MARGEN.abajo}
        stroke="var(--color-border)"
      />
      <line
        x1={MARGEN.izquierda}
        y1={MARGEN.arriba}
        x2={MARGEN.izquierda}
        y2={ALTO - MARGEN.abajo}
        stroke="var(--color-border)"
      />

      <text x="4" y={MARGEN.arriba + 4} fontSize="11" fill="var(--color-text-muted)">
        {Math.round(techo)}
      </text>
      <text x="4" y={ALTO - MARGEN.abajo} fontSize="11" fill="var(--color-text-muted)">
        {Math.round(piso)}
      </text>

      {fechas.length > 0 && (
        <>
          <text x={MARGEN.izquierda} y={ALTO - 8} fontSize="11" fill="var(--color-text-muted)">
            {formatearFechaCorta(fechas[0].fecha)}
          </text>
          {fechas.length > 1 && (
            <text
              x={ANCHO - MARGEN.derecha}
              y={ALTO - 8}
              fontSize="11"
              textAnchor="end"
              fill="var(--color-text-muted)"
            >
              {formatearFechaCorta(fechas[fechas.length - 1].fecha)}
            </text>
          )}
        </>
      )}

      {serie.lineas.map((linea, indice) => {
        const color = COLORES_DE_LINEA[indice % COLORES_DE_LINEA.length];
        const trazo = linea.puntos.map((punto, i) => `${x(i)},${y(punto.valor)}`).join(' ');

        return (
          <g key={linea.id}>
            {linea.puntos.length > 1 && (
              <polyline points={trazo} fill="none" stroke={color} strokeWidth="2" />
            )}
            {linea.puntos.map((punto, i) => (
              <circle
                key={`${linea.id}-${i}`}
                cx={x(i)}
                cy={y(punto.valor)}
                r="4"
                fill={
                  estaFueraDeRango(punto.valor, linea.normal) ? 'var(--color-danger)' : color
                }
              >
                <title>{`${linea.label}: ${punto.valor} ${serie.sufijo} · ${formatearFechaCorta(punto.fecha)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function Leyenda({ serie }) {
  return (
    <div className="d-flex flex-wrap gap-3 small text-body-secondary">
      {serie.lineas.map((linea, indice) => (
        <span key={linea.id} className="d-inline-flex align-items-center gap-1">
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: COLORES_DE_LINEA[indice % COLORES_DE_LINEA.length],
              display: 'inline-block',
            }}
          />
          {linea.label}
          {linea.normal && ` (normal ${linea.normal.min}-${linea.normal.max})`}
        </span>
      ))}
    </div>
  );
}

function Serie({ serie }) {
  if (serie.mediciones === 0) {
    return (
      <Card title={serie.label} style={{ marginBottom: '1rem' }}>
        <p className="text-body-secondary mb-0">Sin mediciones registradas.</p>
      </Card>
    );
  }

  if (serie.mediciones === 1) {
    const unica = ultimaMedicion(serie);

    return (
      <Card title={serie.label} style={{ marginBottom: '1rem' }}>
        <p className="mb-1">
          {serie.lineas
            .filter((linea) => linea.puntos.length > 0)
            .map((linea) => `${linea.label}: ${linea.puntos[0].valor} ${serie.sufijo}`)
            .join(' · ')}
        </p>
        <p className="text-body-secondary small mb-0">
          Una sola medicion ({formatearFechaCorta(unica.fecha)}): todavia no hay evolucion que
          graficar.
        </p>
      </Card>
    );
  }

  return (
    <Card title={serie.label} style={{ marginBottom: '1rem' }}>
      <Grafica serie={serie} />
      <Leyenda serie={serie} />
    </Card>
  );
}

export default function PestaniaSignosPaciente({ pacienteId, rol }) {
  const { series, hayMediciones, cargando, error, recargar } = useEvolucionSignos(pacienteId, {
    rol,
  });

  if (cargando) return <LoadingState />;
  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;

  if (!hayMediciones) {
    return <EmptyState message="Este paciente todavia no tiene signos vitales registrados." />;
  }

  return (
    <div>
      {series.map((serie) => (
        <Serie key={serie.id} serie={serie} />
      ))}
    </div>
  );
}
