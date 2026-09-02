import { useState } from "react";
import { puedeAprobarGasto, puedeRegistrarGasto, useEjecucionPresupuestal } from "@ecopac/shared";

import { PageHeader, ScreenContainer, Tabs } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import PanelEjecucionPresupuestal from "./PanelEjecucionPresupuestal";
import TablaGastos from "./TablaGastos";
import BandejaAprobacionGastos from "./BandejaAprobacionGastos";

// Pantalla de presupuestos (issues #301-#304): una sola ruta (/presupuestos, ya declarada en
// navegacion.js y App.jsx) con pestañas de nivel superior, en vez de rutas propias por issue --
// evita declarar rutas que navegacion.js no tiene, mismo criterio de alcance del PLAN.md, seccion
// 3. Los datos y el estado de filtro/estado salen de useEjecucionPresupuestal(); cada pestaña
// solo dibuja su parte.
//
// "Aprobaciones" (issue #304) solo aparece para quien puedeAprobarGasto(rol) (permisos.js): es
// UX, no seguridad -quien de verdad decide es la politica de UPDATE de gastos (00052)-, pero
// evita ofrecer una pestaña que el servidor va a rechazar entera.
const TAB_RESUMEN = "resumen";
const TAB_GASTOS = "gastos";
const TAB_APROBACIONES = "aprobaciones";

export default function PresupuestosPage() {
  const { perfil, rol } = useSesionCompartida();
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

  const [tabActiva, setTabActiva] = useState(TAB_RESUMEN);

  const puedeAprobar = puedeAprobarGasto(rol);
  const puedeCrear = puedeRegistrarGasto(rol);

  const tabs = [
    { id: TAB_RESUMEN, label: "Resumen" },
    { id: TAB_GASTOS, label: "Gastos" },
    ...(puedeAprobar ? [{ id: TAB_APROBACIONES, label: "Aprobaciones" }] : []),
  ];

  return (
    <ScreenContainer>
      <PageHeader title="Presupuestos" />

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
      </Tabs>
    </ScreenContainer>
  );
}
