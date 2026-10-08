// Prueba del detalle de una cita y del calendario (issue #927). Datos inventados.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { mesesDelAnio, semanasDelMes } from "@ecopac/shared";

import { AgendaDelDia, CalendarioAnio, CalendarioMes } from "./CalendarioCitas";
import ModalDetalleCita from "./ModalDetalleCita";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const CITA = {
  id: "cita-1",
  pacienteId: "p",
  estado: "creada",
  iniciaEn: "2026-10-03T10:30:00-06:00",
  terminaEn: "2026-10-03T11:00:00-06:00",
  paciente: "Ana Prueba",
  jornada: "Jornada Prueba",
  clinica: "Clínica Norte",
  area: "Odontología",
  profesional: null,
  notas: null,
  motivoCancelacion: null,
  consultaId: null,
};

const TODAS = { atender: true, cancelar: true, regresar: false, editar: true };

describe("ModalDetalleCita", () => {
  it("muestra el estado, los datos en hora de Guatemala y las acciones permitidas", () => {
    render(<ModalDetalleCita cita={CITA} acciones={TODAS} onClose={vi.fn()} />);
    expect(screen.getByText("Creado")).toBeInTheDocument();
    expect(screen.getByText("03/10/2026 10:30 - 11:00")).toBeInTheDocument();
    expect(screen.getByText("Sin asignar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Atender/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Regresar a creada/ })).not.toBeInTheDocument();
  });

  it("sin permisos no dibuja Atender ni Cancelar", () => {
    render(
      <ModalDetalleCita
        cita={{ ...CITA, estado: "atendida" }}
        acciones={{ atender: false, cancelar: false, regresar: false, editar: true }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Atendido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Atender/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancelar cita/ })).not.toBeInTheDocument();
  });

  it("cancelar pide el motivo y lo entrega", () => {
    const onCancelar = vi.fn();
    render(
      <ModalDetalleCita cita={CITA} acciones={TODAS} onClose={vi.fn()} onCancelar={onCancelar} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancelar cita/ }));
    fireEvent.change(screen.getByLabelText(/Motivo de la cancelación/), {
      target: { value: "Pidio otra fecha" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cancelar la cita/ }));
    expect(onCancelar).toHaveBeenCalledWith("Pidio otra fecha");
  });

  it("Atender avisa a quien lo monta", () => {
    const onAtender = vi.fn();
    render(
      <ModalDetalleCita cita={CITA} acciones={TODAS} onClose={vi.fn()} onAtender={onAtender} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Atender/ }));
    expect(onAtender).toHaveBeenCalled();
  });
});

describe("CalendarioCitas", () => {
  it("el mes dibuja las citas del dia y abre el dia o la cita", () => {
    const onAbrirCita = vi.fn();
    const onAbrirDia = vi.fn();
    render(
      <CalendarioMes
        semanas={semanasDelMes("2026-10-01", [CITA], "2026-10-03")}
        onAbrirCita={onAbrirCita}
        onAbrirDia={onAbrirDia}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /10:30 · Ana Prueba/ }));
    expect(onAbrirCita).toHaveBeenCalledWith(CITA);
    fireEvent.click(screen.getByRole("button", { name: "Ver el 3, 1 cita" }));
    expect(onAbrirDia).toHaveBeenCalledWith("2026-10-03");
  });

  it("el dia dice las salas libres y deja agendar en un horario vacio", () => {
    const onAgendarEn = vi.fn();
    render(
      <AgendaDelDia
        horarios={[
          { hora: "10:00", citas: [], salasLibres: 0 },
          { hora: "10:30", citas: [CITA], salasLibres: 1 },
        ]}
        clinica={{ nombre: "Clínica Norte" }}
        puedeAgendar
        onAbrirCita={vi.fn()}
        onAgendarEn={onAgendarEn}
      />,
    );
    expect(screen.getByText("0 salas libres")).toHaveClass("cit-salas--llena");
    expect(screen.getByText("1 sala libre")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agendar a las 10:00" }));
    expect(onAgendarEn).toHaveBeenCalledWith("10:00");
  });
});

describe("CalendarioAnio", () => {
  it("marca los dias con citas, abre el dia o el mes", () => {
    const onAbrirMes = vi.fn();
    const onAbrirDia = vi.fn();
    render(
      <CalendarioAnio
        meses={mesesDelAnio("2026-10-03", [CITA], "2026-10-03")}
        onAbrirMes={onAbrirMes}
        onAbrirDia={onAbrirDia}
      />,
    );
    const dia = screen.getByRole("button", { name: "3 de Octubre, 1 cita" });
    expect(dia).toHaveClass("cit-mini-dia--con-citas");
    fireEvent.click(dia);
    expect(onAbrirDia).toHaveBeenCalledWith("2026-10-03");
    expect(screen.getByRole("button", { name: "4 de Octubre" })).not.toHaveClass(
      "cit-mini-dia--con-citas",
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver Octubre, 1 cita" }));
    expect(onAbrirMes).toHaveBeenCalledWith("2026-10-01");
  });
});
