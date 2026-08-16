import PaginaPendiente from './PaginaPendiente';

// Ruta publica: queda fuera del layout autenticado, asi que trae su propio contenedor.
export default function LoginPage() {
  return (
    <main className="p-4">
      <PaginaPendiente titulo="Inicio de sesion" issues="#100" />
    </main>
  );
}
