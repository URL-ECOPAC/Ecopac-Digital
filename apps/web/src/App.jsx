import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { MODULOS, nombreCompletoDe, obtenerDonacion } from "@ecopac/shared";
import { SesionProvider, useSesionCompartida } from "./contexto/SesionProvider";
import MainLayout from "./components/MainLayout";
import RutaProtegida from "./components/RutaProtegida";
import LoginPage from "./pages/LoginPage";
import RestablecerContrasenaPage from "./pages/RestablecerContrasenaPage";
import NuevaContrasenaPage from "./pages/NuevaContrasenaPage";
import HomePage from "./pages/HomePage";
import PacientesPage from "./pages/PacientesPage";
import FichaPacientePage from "./pages/FichaPacientePage";
import PacientesCronicosPage from "./pages/PacientesCronicosPage";
import DonacionesPage from "./pages/DonacionesPage";
import DonantesPage from "./pages/DonantesPage";
import RegistroDonacionPage from "./pages/RegistroDonacionPage";
import HistorialDonacionesPage from "./pages/HistorialDonacionesPage";
import ConstanciaDonacionPage from "./pages/ConstanciaDonacionPage";
import InventarioPage from "./pages/InventarioPage";
import PresupuestosPage from "./pages/PresupuestosPage";
import ProyectosPage from "./pages/ProyectosPage";
import ProyectosSocialesPage from "./pages/ProyectosSocialesPage";
import SeguimientoProyectoPage from "./pages/SeguimientoProyectoPage";
import ReportesPage from "./pages/ReportesPage";
import JornadasPage from "./pages/JornadasPage";
import DetalleJornadaPage from "./pages/DetalleJornadaPage";
import VoluntariosPage from "./pages/VoluntariosPage";
import PerfilPage from "./pages/PerfilPage";
import NotFoundPage from "./pages/NotFoundPage";
import DashboardMetricasPage from "./pages/DashboardMetricasPage";

const rolesDe = (ruta) => MODULOS.find((m) => m.ruta === ruta)?.roles ?? [];

// Las pantallas de donaciones y proyectos reciben el rol por prop en vez de leerlo ellas
// mismas. Este envoltorio se lo saca a la sesion compartida para no repetir el mismo
// useSesionCompartida() en cada una. No decide nada: quien autoriza es RutaProtegida con los
// roles de MODULOS, y quien protege de verdad es RLS.
function conRolDeSesion(Pagina) {
  function PaginaConRol(props) {
    const { perfil } = useSesionCompartida();
    return <Pagina usuarioRol={perfil?.rol} {...props} />;
  }
  PaginaConRol.displayName = `conRolDeSesion(${Pagina.name})`;
  return PaginaConRol;
}

const DonantesConSesion = conRolDeSesion(DonantesPage);
const RegistroDonacionConSesion = conRolDeSesion(RegistroDonacionPage);
const HistorialDonacionesConSesion = conRolDeSesion(HistorialDonacionesPage);
const ProyectosSocialesConSesion = conRolDeSesion(ProyectosSocialesPage);

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

// Mismo caso que la constancia: useSeguimientoProyecto recibe el proyecto, sus hitos y su
// bitacora ya resueltos. Las lecturas existen en packages/shared/proyectos (obtenerProyecto,
// listarHitos, listarSeguimiento, listarJornadasDelProyecto) pero ningun hook las llama
// todavia, asi que aqui solo se resuelve el :id y la vuelta al listado.
function SeguimientoProyectoEnrutado() {
  const { perfil } = useSesionCompartida();
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const proyectoInicial = String(state?.proyecto?.id) === id ? state.proyecto : null;
  return (
    <SeguimientoProyectoPage
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
        <Routes>
          {/* Rutas publicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/restablecer-contrasena" element={<RestablecerContrasenaPage />} />
          <Route path="/nueva-contrasena" element={<NuevaContrasenaPage />} />

          {/* Rutas autenticadas */}
          <Route element={<RutaProtegida />}>
            <Route element={<MainLayout />}>
              <Route element={<RutaProtegida roles={rolesDe("/")} />}>
                <Route path="/" element={<HomePage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/pacientes")} />}>
                <Route path="/pacientes" element={<PacientesPage />} />
                <Route path="/pacientes/cronicos" element={<PacientesCronicosPage />} />
                <Route path="/pacientes/:id" element={<FichaPacientePage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/donaciones")} />}>
                <Route path="/donaciones" element={<DonacionesPage />} />
                <Route path="/donaciones/registro" element={<RegistroDonacionConSesion />} />
                <Route path="/donaciones/historial" element={<HistorialDonacionesConSesion />} />
                <Route path="/donaciones/:id/constancia" element={<ConstanciaDonacionEnrutada />} />
                <Route path="/donantes" element={<DonantesConSesion />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/inventario")} />}>
                <Route path="/inventario" element={<InventarioPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/presupuestos")} />}>
                <Route path="/presupuestos" element={<PresupuestosPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/proyectos")} />}>
                <Route path="/proyectos" element={<ProyectosPage />} />
                <Route path="/proyectos/sociales" element={<ProyectosSocialesConSesion />} />
                <Route
                  path="/proyectos/:id/seguimiento"
                  element={<SeguimientoProyectoEnrutado />}
                />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/reportes")} />}>
                <Route path="/reportes" element={<ReportesPage />} />
              </Route>
              <Route path="/reportes/dashboard" element={<DashboardMetricasPage />} />
              <Route element={<RutaProtegida roles={rolesDe("/jornadas")} />}>
                <Route path="/jornadas" element={<JornadasPage />} />
                <Route path="/jornadas/:id" element={<DetalleJornadaPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/voluntarios")} />}>
                {/* Listado y ficha fusionados en una sola pantalla de tarjetas expandibles
                  (arreglo de diseno de 2026-08-30): ya no hay una ruta /voluntarios/:id propia.
                  Ver eme.md para el estado anterior (dos rutas separadas) si hay que revertir. */}
                <Route path="/voluntarios" element={<VoluntariosPage />} />
              </Route>

              <Route path="/perfil" element={<PerfilPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </SesionProvider>
    </BrowserRouter>
  );
}
