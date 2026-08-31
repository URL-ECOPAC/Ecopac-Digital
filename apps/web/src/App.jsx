import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MODULOS } from "@ecopac/shared";
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
import InventarioPage from "./pages/InventarioPage";
import PresupuestosPage from "./pages/PresupuestosPage";
import ProyectosPage from "./pages/ProyectosPage";
import ReportesPage from "./pages/ReportesPage";
import JornadasPage from "./pages/JornadasPage";
import DetalleJornadaPage from "./pages/DetalleJornadaPage";
import VoluntariosPage from "./pages/VoluntariosPage";
import FichaUsuarioPage from "./pages/FichaUsuarioPage";
import PerfilPage from "./pages/PerfilPage";
import NotFoundPage from "./pages/NotFoundPage";

const rolesDe = (ruta) => MODULOS.find((m) => m.ruta === ruta)?.roles ?? [];

function DonantesConSesion() {
  const { perfil } = useSesionCompartida();
  return <DonantesPage usuarioRol={perfil?.rol} />;
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
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/reportes")} />}>
                <Route path="/reportes" element={<ReportesPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/jornadas")} />}>
                <Route path="/jornadas" element={<JornadasPage />} />
                <Route path="/jornadas/:id" element={<DetalleJornadaPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/voluntarios")} />}>
                <Route path="/voluntarios" element={<VoluntariosPage />} />
                <Route path="/voluntarios/:id" element={<FichaUsuarioPage />} />
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
