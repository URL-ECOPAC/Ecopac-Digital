import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { nombreCompletoDe, obtenerDonacion, rolesDelModulo } from "@ecopac/shared";
import { labels } from "@ecopac/ui-tokens";
import { SesionProvider, useSesionCompartida } from "./contexto/SesionProvider";
import MainLayout from "./components/MainLayout";
import RutaProtegida from "./components/RutaProtegida";
import LoadingState from "./components/LoadingState";
import LoginPage from "./pages/LoginPage";

// El bundle se corta por ruta (issue #708).
//
// QUE PASABA. Las veinticinco paginas entraban por `import` estatico, asi que la web se servia en un
// solo archivo de JavaScript -1.225,72 kB, gzip 335,47 kB, medido sobre 24f98cb- y abrir el login
// descargaba la aplicacion entera: el modulo de presupuestos, los cuatro reportes y el catalogo de
// colaboradores incluidos, para alguien que a lo mejor solo puede ver pacientes. Las jornadas se
// ejecutan en comunidades rurales sobre datos moviles, y ahi eso se paga en segundos de espera.
//
// POR QUE ESTE CORTE Y NO OTRO. Cada grupo de rutas ya esta dentro de su
// `<RutaProtegida roles={rolesDelModulo("...")} />` (issue #820), asi que el corte cae justo donde
// cae el permiso: una ruta que un rol no puede montar es un chunk que su navegador no pide. No hace
// falta agrupar a mano.
//
// LoginPage NO va aqui, a proposito: es la primera pantalla de quien llega sin sesion, y hacerla
// dinamica anade un viaje de red justo en el peor momento. Las otras dos publicas si, porque a
// restablecer la contrasena se llega desde el login, ya con la aplicacion cargada.
const RestablecerContrasenaPage = lazy(() => import("./pages/RestablecerContrasenaPage"));
const NuevaContrasenaPage = lazy(() => import("./pages/NuevaContrasenaPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const PacientesPage = lazy(() => import("./pages/PacientesPage"));
const FichaPacientePage = lazy(() => import("./pages/FichaPacientePage"));
const PacientesCronicosPage = lazy(() => import("./pages/PacientesCronicosPage"));
const CatalogoDiagnosticosPage = lazy(() => import("./pages/CatalogoDiagnosticosPage"));
const CatalogoComunidadesPage = lazy(() => import("./pages/CatalogoComunidadesPage"));
const PosiblesDuplicadosPage = lazy(() => import("./pages/PosiblesDuplicadosPage"));
const DonacionesPage = lazy(() => import("./pages/DonacionesPage"));
const DonantesPage = lazy(() => import("./pages/DonantesPage"));
const RegistroDonacionPage = lazy(() => import("./pages/RegistroDonacionPage"));
const HistorialDonacionesPage = lazy(() => import("./pages/HistorialDonacionesPage"));
const ConstanciaDonacionPage = lazy(() => import("./pages/ConstanciaDonacionPage"));
const InventarioPage = lazy(() => import("./pages/InventarioPage"));
const PresupuestosPage = lazy(() => import("./pages/PresupuestosPage"));
const ProyectosSocialesPage = lazy(() => import("./pages/ProyectosSocialesPage"));
const SeguimientoProyectoPage = lazy(() => import("./pages/SeguimientoProyectoPage"));
const ReportesPage = lazy(() => import("./pages/ReportesPage"));
const JornadasPage = lazy(() => import("./pages/JornadasPage"));
const DetalleJornadaPage = lazy(() => import("./pages/DetalleJornadaPage"));
const ColaboradoresPage = lazy(() => import("./pages/ColaboradoresPage"));
const PerfilPage = lazy(() => import("./pages/PerfilPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ReporteJornada = lazy(() => import("./pages/ReporteJornada"));

// Los roles de cada grupo de rutas salen de rolesDelModulo() de @ecopac/shared (issue #820). Este
// archivo tenia su propia copia, `rolesDe(ruta)`, que resolvia por `m.ruta`; la app movil tenia una
// tercera, que resolvia solo por `m.id`. Tres definiciones de la misma decision de permisos, dos de
// ellas dentro de una app, que es lo que prohibe AGENTS.md. El argumento pasa a ser el id del
// modulo -"pacientes", "inicio"- en vez de su ruta: es la misma entrada de MODULOS, nombrada por
// donde nace y no por donde se dibuja.

// Las pantallas de donaciones y proyectos reciben el rol por prop en vez de leerlo ellas
// mismas. Este envoltorio se lo saca a la sesion compartida para no repetir el mismo
// useSesionCompartida() en cada una. No decide nada: quien autoriza es RutaProtegida con los
// roles de MODULOS, y quien protege de verdad es RLS.
// `nombre` se pasa a mano desde la #708: lo que devuelve lazy() es un objeto, no una funcion, asi
// que `Pagina.name` es undefined y el displayName quedaba en "conRolDeSesion(undefined)".
function conRolDeSesion(Pagina, nombre) {
  function PaginaConRol(props) {
    const { perfil } = useSesionCompartida();
    return <Pagina usuarioRol={perfil?.rol} {...props} />;
  }
  PaginaConRol.displayName = `conRolDeSesion(${nombre})`;
  return PaginaConRol;
}

const DonantesConSesion = conRolDeSesion(DonantesPage, "DonantesPage");
const RegistroDonacionConSesion = conRolDeSesion(RegistroDonacionPage, "RegistroDonacionPage");
const HistorialDonacionesConSesion = conRolDeSesion(
  HistorialDonacionesPage,
  "HistorialDonacionesPage",
);
const ProyectosSocialesConSesion = conRolDeSesion(ProyectosSocialesPage, "ProyectosSocialesPage");

// La constancia se identifica por la donacion en la URL y ConstanciaDonacionPage recibe la
// donacion entera por prop. Si se llega desde el historial, la fila viene en el state de
// navegacion y no hace falta volver a consultar; si se entra escribiendo la direccion o se
// recarga la pagina, la resuelve obtenerDonacion(id).
function ConstanciaDonacionEnrutada() {
  const { perfil } = useSesionCompartida();
  const { id } = useParams();
  const { state } = useLocation();
  // El :id de la URL siempre es string; el de la fila puede venir como numero desde la base.
  const desdeElHistorial = String(state?.donacion?.id) === id ? state.donacion : null;

  const [donacion, setDonacion] = useState(desdeElHistorial);

  useEffect(() => {
    if (desdeElHistorial || !id || !perfil?.rol) return undefined;

    let vigente = true;
    obtenerDonacion(id, { rolUsuario: perfil.rol }).then(({ datos }) => {
      if (vigente) setDonacion(datos);
    });
    return () => {
      vigente = false;
    };
  }, [id, perfil?.rol, desdeElHistorial]);

  return <ConstanciaDonacionPage usuarioRol={perfil?.rol} donacion={donacion} />;
}

// useSeguimientoProyecto ahora resuelve el :id el mismo (issue #756): antes solo recibia lo que
// location.state trajera del listado (el proyecto, sin hitos ni bitacora), asi que entrar por un
// enlace directo o refrescar la pagina dejaba la ficha vacia. proyectoInicial se conserva como
// adelanto: pinta el encabezado antes de que termine la primera consulta.
function SeguimientoProyectoEnrutado() {
  const { perfil } = useSesionCompartida();
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const proyectoInicial = String(state?.proyecto?.id) === id ? state.proyecto : null;
  return (
    <SeguimientoProyectoPage
      proyectoId={id}
      proyectoInicial={proyectoInicial}
      usuarioActual={nombreCompletoDe(perfil ?? {}) || "Usuario"}
      onVolver={() => navigate("/proyectos")}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SesionProvider>
        {/* El respaldo de las rutas publicas, que no pasan por MainLayout. Las autenticadas tienen
            el suyo alrededor del <Outlet /> del layout, para que al cambiar de modulo no se
            desmonten el sidebar ni la cabecera (issue #708). */}
        <Suspense fallback={<LoadingState message={labels.cargandoPantalla} />}>
          <Routes>
            {/* Rutas publicas */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/restablecer-contrasena" element={<RestablecerContrasenaPage />} />
            <Route path="/nueva-contrasena" element={<NuevaContrasenaPage />} />

            {/* Rutas autenticadas */}
            <Route element={<RutaProtegida />}>
              <Route element={<MainLayout />}>
                <Route element={<RutaProtegida roles={rolesDelModulo("inicio")} />}>
                  <Route path="/" element={<HomePage />} />
                </Route>
                <Route element={<RutaProtegida roles={rolesDelModulo("pacientes")} />}>
                  <Route path="/pacientes" element={<PacientesPage />} />
                  <Route path="/pacientes/cronicos" element={<PacientesCronicosPage />} />
                  <Route path="/pacientes/diagnosticos" element={<CatalogoDiagnosticosPage />} />
                  <Route path="/pacientes/comunidades" element={<CatalogoComunidadesPage />} />
                  <Route path="/pacientes/duplicados" element={<PosiblesDuplicadosPage />} />
                  <Route path="/pacientes/:id" element={<FichaPacientePage />} />
                </Route>
                <Route element={<RutaProtegida roles={rolesDelModulo("donaciones")} />}>
                  <Route path="/donaciones" element={<DonacionesPage />} />
                  <Route path="/donaciones/registro" element={<RegistroDonacionConSesion />} />
                  <Route path="/donaciones/historial" element={<HistorialDonacionesConSesion />} />
                  <Route
                    path="/donaciones/:id/constancia"
                    element={<ConstanciaDonacionEnrutada />}
                  />
                  <Route path="/donantes" element={<DonantesConSesion />} />
                </Route>
                <Route element={<RutaProtegida roles={rolesDelModulo("inventario")} />}>
                  <Route path="/inventario" element={<InventarioPage />} />
                </Route>
                <Route element={<RutaProtegida roles={rolesDelModulo("presupuestos")} />}>
                  <Route path="/presupuestos" element={<PresupuestosPage />} />
                </Route>
                <Route element={<RutaProtegida roles={rolesDelModulo("proyectos")} />}>
                  {/* Habia dos pantallas de proyectos y el sidebar enlazaba la de mentira: una
                  maqueta de 368 lineas con datos escritos a mano y un vocabulario de estados
                  que no existe en el enum estado_proyecto. Se elimino, y /proyectos monta
                  ahora la que si consulta la base (issue #710). */}
                  <Route path="/proyectos" element={<ProyectosSocialesConSesion />} />
                  {/* La ruta vieja sigue viva como redireccion: era la unica forma de llegar a la
                  pantalla buena, asi que puede estar guardada en marcadores. */}
                  <Route
                    path="/proyectos/sociales"
                    element={<Navigate replace to="/proyectos" />}
                  />
                  <Route
                    path="/proyectos/:id/seguimiento"
                    element={<SeguimientoProyectoEnrutado />}
                  />
                </Route>
                <Route element={<RutaProtegida roles={rolesDelModulo("reportes")} />}>
                  {/* Las pestanas del hub son rutas: todas montan ReportesPage, que elige la
                  pestana por la direccion. Antes "pacientes atendidos" montaba su reporte suelto,
                  sin las pestanas, y desde ahi no habia forma de volver a las demas. */}
                  <Route path="/reportes" element={<ReportesPage />} />
                  <Route path="/reportes/dashboard" element={<ReportesPage />} />
                  <Route path="/reportes/medicamentos-por-vencer" element={<ReportesPage />} />
                  <Route path="/reportes/pacientes-atendidos" element={<ReportesPage />} />
                  <Route path="/reportes/inventario-actual" element={<ReportesPage />} />
                  <Route path="/reportes/jornada/:id" element={<ReporteJornada />} />
                </Route>
                <Route element={<RutaProtegida roles={rolesDelModulo("jornadas")} />}>
                  <Route path="/jornadas" element={<JornadasPage />} />
                  <Route path="/jornadas/:id" element={<DetalleJornadaPage />} />
                </Route>
                <Route element={<RutaProtegida roles={rolesDelModulo("colaboradores")} />}>
                  {/* Listado y ficha fusionados en una sola pantalla de tarjetas expandibles
                  (arreglo de diseno de 2026-08-30): ya no hay una ruta /colaboradores/:id propia.
                  Ver eme.md para el estado anterior (dos rutas separadas) si hay que revertir. */}
                  <Route path="/colaboradores" element={<ColaboradoresPage />} />
                </Route>

                {/* Fuera de cualquier grupo de rolesDelModulo() a proposito: el perfil propio no es un
                  modulo con roles permitidos, cualquier rol autenticado tiene el suyo. */}
                <Route path="/perfil" element={<PerfilPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </SesionProvider>
    </BrowserRouter>
  );
}
