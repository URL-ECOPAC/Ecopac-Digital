// Pruebas de la agenda del dia en el telefono (issue #927). Datos inventados. Los horarios salen de
// horariosDelDia() de @ecopac/shared, el mismo que usa la web: no se inventa su forma aqui.

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { horariosDelDia } from "@ecopac/shared";

import AgendaDelDia from "../AgendaDelDia";
import ModalDetalleCita from "../ModalDetalleCita";

const CITA = {
  id: "cita-1",
  pacienteId: "p",
  estado: "creada",
  iniciaEn: "2026-10-03T10:30:00-06:00",
  terminaEn: "2026-10-03T11:00:00-06:00",
  paciente: "Ana Prueba",
  jornada: "Jornada Prueba",
  clinica: "Clínica Norte",
  clinicaId: "c1",
  area: "Odontología",
  profesional: null,
  notas: null,
  motivoCancelacion: null,
};

describe("AgendaDelDia", () => {
  it("sin clinica filtrada solo dibuja los horarios con citas", () => {
    const onAbrirCita = jest.fn();
    render(
      <AgendaDelDia
        horarios={horariosDelDia("2026-10-03", [CITA])}
        clinica={null}
        onAbrirCita={onAbrirCita}
      />,
    );
    expect(screen.getByText("10:30")).toBeTruthy();
    expect(screen.queryByText("09:00")).toBeNull();
    expect(screen.getByText("Creado")).toBeTruthy();
    expect(screen.getByText(/Sin profesional/)).toBeTruthy();
    fireEvent.press(screen.getByText("Ana Prueba"));
    expect(onAbrirCita).toHaveBeenCalledWith(CITA);
  });

  it("con clinica filtrada dibuja todos los horarios con sus salas libres", () => {
    render(
      <AgendaDelDia
        horarios={horariosDelDia("2026-10-03", [CITA], { salas: 1, citasDeLaClinica: [CITA] })}
        clinica={{ nombre: "Clínica Norte" }}
        onAbrirCita={jest.fn()}
      />,
    );
    expect(screen.getByText("09:00")).toBeTruthy();
    expect(screen.getAllByText("1 sala libre").length).toBeGreaterThan(0);
    expect(screen.getByText("0 salas libres")).toBeTruthy();
  });

  it("sin citas lo dice", () => {
    render(
      <AgendaDelDia
        horarios={horariosDelDia("2026-10-03", [])}
        clinica={null}
        onAbrirCita={jest.fn()}
      />,
    );
    expect(screen.getByText("No hay citas este día con estos filtros.")).toBeTruthy();
  });
});

describe("ModalDetalleCita (movil)", () => {
  const TODAS = { atender: true, cancelar: true, regresar: false, editar: true };

  it("muestra los datos y Atender avisa a quien lo monta", () => {
    const onAtender = jest.fn();
    render(
      <ModalDetalleCita cita={CITA} acciones={TODAS} onClose={jest.fn()} onAtender={onAtender} />,
    );
    expect(screen.getByText("03/10/2026 10:30 - 11:00")).toBeTruthy();
    expect(screen.getByText("Sin asignar")).toBeTruthy();
    expect(screen.queryByText("Regresar a creada")).toBeNull();
    fireEvent.press(screen.getByText("Atender"));
    expect(onAtender).toHaveBeenCalled();
  });

  it("cancelar pide el motivo y lo entrega", () => {
    const onCancelar = jest.fn();
    render(
      <ModalDetalleCita cita={CITA} acciones={TODAS} onClose={jest.fn()} onCancelar={onCancelar} />,
    );
    fireEvent.press(screen.getByText("Cancelar cita"));
    fireEvent.changeText(
      screen.getByPlaceholderText("Ej. El paciente pidió otra fecha"),
      "Pidio otra fecha",
    );
    fireEvent.press(screen.getByText("Cancelar la cita"));
    expect(onCancelar).toHaveBeenCalledWith("Pidio otra fecha");
  });

  it("sin permisos no ofrece Atender ni Cancelar", () => {
    render(
      <ModalDetalleCita
        cita={{ ...CITA, estado: "atendida" }}
        acciones={{ atender: false, cancelar: false, regresar: false, editar: true }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText("Atender")).toBeNull();
    expect(screen.queryByText("Cancelar cita")).toBeNull();
  });
});
