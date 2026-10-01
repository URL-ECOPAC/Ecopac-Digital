import { useState } from "react";
import { Alert } from "react-bootstrap";

import { formatearMoneda, useGastosDeJornada } from "@ecopac/shared";

import { DataList, PrimaryButton, StatCard } from "../components";
import ModalGasto from "./ModalGasto";

// Pestana Gastos del detalle de una jornada: sus gastos y como van contra su presupuesto. Se
// registran aqui mismo, con la jornada ya puesta, y pasan por la aprobacion igual que en
// Presupuestos.
// `soloConsulta`: la jornada esta finalizada y ya no admite gastos (00159); la lista se sigue
// pudiendo abrir.
export default function GastosDeJornada({ jornadaId, rol, usuarioId, soloConsulta = false }) {
  const {
    puedeRegistrar,
    estadoInicial,
    columnas,
    catalogos,
    gastos,
    resumen,
    cargando,
    error,
    recargar,
  } = useGastosDeJornada({ jornadaId, rol });

  const [registrando, setRegistrando] = useState(false);
  const [gastoAbierto, setGastoAbierto] = useState(null);

  return (
    <div className="d-flex flex-column gap-3">
      {resumen && (
        <div className="ec-kpis">
          <StatCard
            label="Presupuesto"
            value={formatearMoneda(resumen.asignado)}
            accent="var(--accent-presupuestos)"
          />
          <StatCard
            label="Gastado"
            value={formatearMoneda(resumen.aprobado)}
            caption="Gastos aprobados"
            accent="var(--color-success)"
          />
          <StatCard
            label="Por aprobar"
            value={formatearMoneda(resumen.pendiente)}
            caption="Ya cuentan contra el presupuesto"
            accent="var(--color-warning)"
          />
          <StatCard
            label="Disponible"
            value={formatearMoneda(resumen.disponible)}
            caption="Para gastos nuevos"
            accent={resumen.disponible > 0 ? "var(--color-primary)" : "var(--color-danger)"}
          />
        </div>
      )}

      {error && (
        <Alert variant="danger" className="mb-0 py-2 px-3 small">
          No se pudieron cargar los gastos: {error.mensaje}
        </Alert>
      )}

      {puedeRegistrar && (
        <div className="d-flex justify-content-end">
          <PrimaryButton
            title="Registrar gasto"
            onClick={() => setRegistrando(true)}
            disabled={soloConsulta}
          />
        </div>
      )}

      <DataList
        columnas={columnas}
        datos={gastos}
        cargando={cargando}
        catalogos={catalogos}
        vacio="Esta jornada todavía no tiene gastos registrados."
        onRowPress={setGastoAbierto}
      />

      {registrando && (
        <ModalGasto
          usuarioId={usuarioId}
          rol={rol}
          estadoInicial={estadoInicial}
          jornadaId={jornadaId}
          onClose={() => setRegistrando(false)}
          onGuardado={() => {
            setRegistrando(false);
            recargar();
          }}
        />
      )}
      {gastoAbierto && (
        <ModalGasto
          key={gastoAbierto.id}
          gasto={gastoAbierto}
          usuarioId={usuarioId}
          rol={rol}
          onClose={() => setGastoAbierto(null)}
          onGuardado={() => {
            setGastoAbierto(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}
