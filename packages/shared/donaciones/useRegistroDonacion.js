import { useState } from "react";

import { puedeRegistrarDonaciones, puedeVerDonaciones } from "./permisos.js";

export function useRegistroDonacion({ _client, usuarioRol, onGuardarExito }) {
  const puedeEscribir = puedeRegistrarDonaciones(usuarioRol);
  const tieneAccesoLectura = puedeVerDonaciones(usuarioRol);

  const [tipoDonacion, setTipoDonacion] = useState("economica");
  const [donanteId, setDonanteId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);

  const [detalles, setDetalles] = useState([
    { id: Date.now(), concepto: "", cantidad: 1, monto: 0, medicamentoId: "" },
  ]);

  const [modalNuevoDonante, setModalNuevoDonante] = useState(false);
  const [ofrecerIngresoInventario, setOfrecerIngresoInventario] = useState(false);
  const [resumenRegistro, setResumenRegistro] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const agregarRenglon = () => {
    setDetalles((prev) => [
      ...prev,
      { id: Date.now(), concepto: "", cantidad: 1, monto: 0, medicamentoId: "" },
    ]);
  };

  const quitarRenglon = (id) => {
    if (detalles.length === 1) return;
    setDetalles((prev) => prev.filter((item) => item.id !== id));
  };

  const actualizarRenglon = (id, campo, valor) => {
    setDetalles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [campo]: valor } : item))
    );
  };

  const manejarCambioTipo = (nuevoTipo) => {
    setTipoDonacion(nuevoTipo);
    setDetalles([{ id: Date.now(), concepto: "", cantidad: 1, monto: 0, medicamentoId: "" }]);
  };

  const guardarDonacion = async () => {
    if (!puedeEscribir) return;
    setGuardando(true);

    const payload = {
      donante_id: donanteId,
      proyecto_id: proyectoId,
      tipo: tipoDonacion,
      fecha,
      detalles,
    };

    setResumenRegistro(payload);

    if (tipoDonacion === "medicamentos") {
      setOfrecerIngresoInventario(true);
    }

    setGuardando(false);
    if (onGuardarExito) onGuardarExito(payload);
  };

  return {
    permisos: { tieneAccesoLectura, puedeEscribir },
    tipoDonacion,
    setTipoDonacion: manejarCambioTipo,
    donanteId,
    setDonanteId,
    proyectoId,
    setProyectoId,
    fecha,
    setFecha,
    detalles,
    agregarRenglon,
    quitarRenglon,
    actualizarRenglon,
    modalNuevoDonante,
    setModalNuevoDonante,
    ofrecerIngresoInventario,
    setOfrecerIngresoInventario,
    resumenRegistro,
    guardando,
    guardarDonacion,
  };
}