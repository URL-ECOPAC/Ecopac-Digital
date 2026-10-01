import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  puedeAprobarGasto,
  puedeRegistrarGasto,
  esAdministrador,
  permisosDeOrigenDePresupuesto,
  useEjecucionPresupuestal,
} from "@ecopac/shared";
import { PageHeader, ScreenContainer, Tabs } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import PanelEjecucionPresupuestal from "./PanelEjecucionPresupuestal";
import TablaGastos from "./TablaGastos";
import BandejaAprobacionGastos from "./BandejaAprobacionGastos";
import MovimientosPresupuesto from "./MovimientosPresupuesto";
import CajaDePresupuesto from "./CajaDePresupuesto";

const TAB_RESUMEN = "resumen";
const TAB_GASTOS = "gastos";
const TAB_APROBACIONES = "aprobaciones";
const TAB_MOVIMIENTOS = "movimientos";
const TAB_CAJA = "caja";

function pestanaDeEnlace(pedida, puedeAprobar, esAdmin, veCaja) {
  if (pedida === TAB_GASTOS) return TAB_GASTOS;
  if (pedida === TAB_CAJA && veCaja) return TAB_CAJA;
  if (pedida === TAB_APROBACIONES && puedeAprobar) return TAB_APROBACIONES;
  if (pedida === TAB_MOVIMIENTOS && esAdmin) return TAB_MOVIMIENTOS;
  return TAB_RESUMEN;
}

export default function PresupuestosPage() {
  const { perfil, rol } = useSesionCompartida();
  const esAdmin = esAdministrador(rol);

  const {
    kpis,
    proyectos,
    gastos,
    catalogos,
    filtroEstado,
    cambiarFiltroEstado,
    cargando,
    error,
    recargar,
  } = useEjecucionPresupuestal(rol);

  const puedeAprobar = puedeAprobarGasto(rol);
  const puedeCrear = puedeRegistrarGasto(rol);
  // La caja (00168) la ve quien ve los aportes de las jornadas.
  const veCaja = permisosDeOrigenDePresupuesto(rol).puedeVer;

  const [parametros] = useSearchParams();
  const pestanaPedida = parametros.get("tab");

  const [tabActiva, setTabActiva] = useState(() =>
    pestanaDeEnlace(pestanaPedida, puedeAprobar, esAdmin, veCaja),
  );

  useEffect(() => {
    if (pestanaPedida) {
      setTabActiva(pestanaDeEnlace(pestanaPedida, puedeAprobar, esAdmin, veCaja));
    }
  }, [pestanaPedida, puedeAprobar, esAdmin, veCaja]);

  const tabs = [
    { id: TAB_RESUMEN, label: "Resumen" },
    { id: TAB_GASTOS, label: "Gastos" },
    ...(puedeAprobar ? [{ id: TAB_APROBACIONES, label: "Aprobaciones" }] : []),
    ...(esAdmin ? [{ id: TAB_MOVIMIENTOS, label: "Movimientos" }] : []),
    ...(veCaja ? [{ id: TAB_CAJA, label: "Caja" }] : []),
  ];

  return (
    <ScreenContainer>
      <PageHeader
        title="Presupuestos"
        subtitle="Administración financiera por jornada y proyecto"
        accent="var(--accent-presupuestos)"
      />
      <Tabs tabs={tabs} activo={tabActiva} onChange={setTabActiva}>
        {tabActiva === TAB_RESUMEN && (
          <PanelEjecucionPresupuestal
            kpis={kpis}
            proyectos={proyectos}
            cargando={cargando}
            error={error}
            onReintentar={recargar}
          />
        )}

        {tabActiva === TAB_GASTOS && (
          <TablaGastos
            gastos={gastos}
            catalogos={catalogos}
            filtroEstado={filtroEstado}
            cambiarFiltroEstado={cambiarFiltroEstado}
            cargando={cargando}
            error={error}
            recargar={recargar}
            puedeCrear={puedeCrear}
            usuarioId={perfil?.id}
            rol={rol}
          />
        )}

        {tabActiva === TAB_APROBACIONES && puedeAprobar && (
          <BandejaAprobacionGastos usuarioId={perfil?.id} />
        )}

        {tabActiva === TAB_MOVIMIENTOS && esAdmin && <MovimientosPresupuesto />}

        {tabActiva === TAB_CAJA && veCaja && <CajaDePresupuesto rol={rol} />}
      </Tabs>
    </ScreenContainer>
  );
}
