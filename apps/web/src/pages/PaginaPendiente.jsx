// Marcador de las pantallas que todavia no se implementan.
// Cada pagina cita la issue que la construye, para que el esqueleto no se confunda
// con trabajo terminado.
export default function PaginaPendiente({ titulo, issues }) {
  return (
    <section>
      <h2 className="h5 mb-2">{titulo}</h2>
      <p className="text-body-secondary mb-0">
        Pantalla pendiente de implementar. Se construye en {issues}.
      </p>
    </section>
  );
}
