import { useReportePacientes } from "../../../../packages/shared/reportes/useReportePacientes.js";

// Tarjeta de métrica con el mismo estilo del panel
const Tarjeta = ({ etiqueta, valor, color = "#1f2937" }) => (
  <div
    style={{
      backgroundColor: "#fff",
      borderRadius: "12px",
      padding: "20px",
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    }}
  >
    <p
      style={{
        fontSize: "12px",
        color: "#64748b",
        margin: "0 0 8px",
        textTransform: "uppercase",
        fontWeight: 500,
      }}
    >
      {etiqueta}
    </p>
    <p
      style={{
        fontSize: "32px",
        fontWeight: "700",
        color,
        margin: 0,
        lineHeight: "1.2",
      }}
    >
      {valor}
    </p>
  </div>
);

// Tarjeta de distribución (sexo / edad)
const TarjetaDistribucion = ({ titulo, items }) => (
  <div
    style={{
      backgroundColor: "#fff",
      borderRadius: "12px",
      padding: "20px",
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    }}
  >
    <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 16px", color: "#1f2937" }}>
      {titulo}
    </h3>
    {items.map((item, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 0",
          borderBottom: i < items.length - 1 ? "1px solid #f1f5f9" : "none",
        }}
      >
        <span style={{ fontSize: "14px", color: "#475569" }}>{item.etiqueta}</span>
        <span style={{ fontSize: "14px", fontWeight: "600", color: item.color || "#1f2937" }}>
          {item.valor}
        </span>
      </div>
    ))}
  </div>
);

export default function ReportePacientesPage() {
  const {
    cargando,
    error,
    totales,
    porComunidad,
    porJornada,
    obtenerDatosCSV,
    fechaInicio,
    setFechaInicio,
    fechaFin,
    setFechaFin,
    comunidadId,
    setComunidadId,
    jornadaId,
    setJornadaId,
    listaComunidades,
    listaJornadas,
    valoresEspeciales: { TODAS },
  } = useReportePacientes();

  // 📥 Exportar CSV
  const descargarCSV = () => {
    const datos = obtenerDatosCSV();
    if (!datos) return;
    const contenido = [
      datos.encabezados.join(","),
      ...datos.filas.map((fila) => fila.join(",")),
    ].join("\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-pacientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (cargando)
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
        Cargando reporte...
      </div>
    );
  if (error) return <div style={{ padding: "40px", color: "#dc2626" }}>❌ {error}</div>;

  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* 📌 Cabecera */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#1f2937" }}>
            Reporte de Pacientes Atendidos
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0" }}>
            Por jornada, comunidad y fecha
          </p>
        </div>
        <button
          onClick={descargarCSV}
          style={{
            padding: "10px 20px",
            backgroundColor: "#10b981",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Exportar CSV
        </button>
      </div>

      {/* 🔍 Filtros */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "#64748b",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Fecha inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "#64748b",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Fecha fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "#64748b",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Comunidad
            </label>
            <select
              value={comunidadId}
              onChange={(e) => setComunidadId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
              }}
            >
              <option value={TODAS}>Todas las comunidades</option>
              {listaComunidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "#64748b",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Jornada
            </label>
            <select
              value={jornadaId}
              onChange={(e) => setJornadaId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
              }}
            >
              <option value={TODAS}>Todas las jornadas</option>
              {listaJornadas.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 📊 Tarjetas de totales */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <Tarjeta etiqueta="Total Pacientes" valor={totales.totalPacientes || 0} color="#10b981" />
        <Tarjeta etiqueta="Pacientes Nuevos" valor={totales.nuevos} color="#3b82f6" />
        <Tarjeta etiqueta="Pacientes Recurrentes" valor={totales.recurrentes} color="#f59e0b" />
        <Tarjeta etiqueta="Comunidades Atendidas" valor={porComunidad.length} color="#ec4899" />
      </div>

      {/* 📈 Distribuciones */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginBottom: "24px",
        }}
      >
        <TarjetaDistribucion
          titulo="Distribución por Sexo"
          items={[
            { etiqueta: "Masculino", valor: totales.porSexo?.masculino ?? "N/D", color: "#3b82f6" },
            { etiqueta: "Femenino", valor: totales.porSexo?.femenino ?? "N/D", color: "#ec4899" },
            { etiqueta: "Otro", valor: totales.porSexo?.otro ?? "N/D", color: "#6b7280" },
          ]}
        />
        <TarjetaDistribucion
          titulo="Distribución por Edad"
          items={[
            { etiqueta: "0 a 11 años", valor: totales.porEdad?.["0-11"] ?? "N/D" },
            { etiqueta: "12 a 17 años", valor: totales.porEdad?.["12-17"] ?? "N/D" },
            { etiqueta: "18 a 30 años", valor: totales.porEdad?.["18-30"] ?? "N/D" },
            { etiqueta: "31 a 59 años", valor: totales.porEdad?.["31-59"] ?? "N/D" },
            { etiqueta: "60 años o más", valor: totales.porEdad?.["60+"] ?? "N/D" },
          ]}
        />
      </div>

      {/* 📋 Tablas de agrupación */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 16px", color: "#1f2937" }}>
            Atenciones por Comunidad
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th
                  style={{ textAlign: "left", padding: "8px", fontSize: "13px", color: "#64748b" }}
                >
                  Comunidad
                </th>
                <th
                  style={{ textAlign: "right", padding: "8px", fontSize: "13px", color: "#64748b" }}
                >
                  Pacientes
                </th>
              </tr>
            </thead>
            <tbody>
              {porComunidad.map((c, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px", fontSize: "14px" }}>{c.nombre}</td>
                  <td
                    style={{
                      padding: "8px",
                      textAlign: "right",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {c.cantidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 16px", color: "#1f2937" }}>
            Atenciones por Jornada
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th
                  style={{ textAlign: "left", padding: "8px", fontSize: "13px", color: "#64748b" }}
                >
                  Jornada
                </th>
                <th
                  style={{ textAlign: "right", padding: "8px", fontSize: "13px", color: "#64748b" }}
                >
                  Pacientes
                </th>
              </tr>
            </thead>
            <tbody>
              {porJornada.map((j, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px", fontSize: "14px" }}>{j.nombre}</td>
                  <td
                    style={{
                      padding: "8px",
                      textAlign: "right",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {j.cantidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
