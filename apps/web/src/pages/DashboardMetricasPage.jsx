import { exportarFilasACSV, useDashboardMetricas } from "@ecopac/shared";

import { useSesionCompartida } from "../contexto/SesionProvider";

// 📊 Tarjeta de métrica alineada a Figma
const TarjetaMetrica = ({ etiqueta, valor, meta, color }) => {
  const progreso = meta
    ? Math.min((Number(valor) / Number(meta.replace(/[^0-9]/g, ""))) * 100, 100)
    : 0;
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        padding: "20px",
        border: "1px solid #f1f5f9",
      }}
    >
      <p
        style={{
          fontSize: "12px",
          color: "#64748b",
          margin: "0 0 8px 0",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {etiqueta}
      </p>
      <p style={{ fontSize: "36px", fontWeight: "700", color: color, margin: "0 0 12px 0" }}>
        {valor}
      </p>
      {meta && (
        <>
          <div
            style={{
              height: "6px",
              backgroundColor: "#e2e8f0",
              borderRadius: "3px",
              overflow: "hidden",
              marginBottom: "6px",
            }}
          >
            <div
              style={{
                height: "100%",
                backgroundColor: color,
                borderRadius: "3px",
                width: `${progreso}%`,
              }}
            />
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "right" }}>meta: {meta}</div>
        </>
      )}
    </div>
  );
};

export default function DashboardMetricasPage() {
  const { rol } = useSesionCompartida();
  const {
    tieneAcceso,
    cargando,
    error,
    indicadores,
    seriePrincipal,
    serieComparacion,
    calcularVariacion,
    rangosDisponibles,
    rangoSeleccionado,
    setRangoSeleccionado,
    agrupamientosDisponibles,
    agruparPor,
    setAgruparPor,
    comunidadId,
    setComunidadId,
    modoComparacion,
    setModoComparacion,
    comunidadCompararId,
    setComunidadCompararId,
    listaComunidades,
    valoresEspeciales: { TODAS, NINGUNA },
  } = useDashboardMetricas({ rol });

  // ✅ Función de exportación CSV — AHORA EN EL COMPONENTE
  const exportarCSV = () => {
    if (!seriePrincipal || seriePrincipal.length === 0) return;

    // El CSV lo arma exportarFilasACSV (reportes/csv.js, issue #207) y no un join(",") a mano:
    // aquel escapa comillas y separadores, pone BOM UTF-8 y usa CRLF. Armarlo aqui rompia con
    // cualquier etiqueta que llevara una coma -- un nombre de comunidad, por ejemplo.
    const columnas = [
      { id: "etiqueta", label: agruparPor },
      { id: "valor", label: "Valor principal" },
      { id: "comparado", label: "Valor comparado" },
      { id: "variacion", label: "Variacion %" },
    ];

    const filas = seriePrincipal.map((fila, i) => {
      const comp = serieComparacion?.[i];
      const varPc = comp ? calcularVariacion(fila.valor, comp.valor) : null;
      return {
        etiqueta: fila.etiqueta,
        valor: fila.valor,
        comparado: comp?.valor ?? "-",
        variacion: varPc !== null ? `${varPc >= 0 ? "+" : ""}${varPc.toFixed(1)}%` : "-",
      };
    });

    const blob = new Blob([exportarFilasACSV(filas, columnas)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `panel-impacto-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // La guarda de rol la decide puedeVerIndicadoresDeImpacto(), en reportes/permisos.js: quien
  // protege de verdad es el WHERE de vista_reporte_impacto (00054).
  if (!tieneAcceso)
    return (
      <div style={{ padding: "40px", color: "var(--color-danger)" }}>
        Solo administracion y los roles consultivos consultan los indicadores de impacto.
      </div>
    );

  if (cargando)
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
        Cargando métricas...
      </div>
    );

  // `error` es el objeto normalizado del monorepo, no una cadena: se lee su campo `mensaje`.
  if (error)
    return (
      <div style={{ padding: "40px", color: "var(--color-danger)" }}>
        Error al cargar: {error.mensaje}
      </div>
    );

  // 📊 Datos de gráfica
  const valorMaximo = Math.max(...seriePrincipal.map((i) => i.valor), 1);

  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* 📌 Título */}
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          onClick={exportarCSV}
          style={{
            padding: "10px 16px",
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

      {/* 🔍 FILTROS */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          padding: "20px",
          marginBottom: "24px",
          border: "1px solid #f1f5f9",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "13px", fontWeight: "600", color: "#334155", margin: "0 0 8px 0" }}>
            Rango de fechas
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {rangosDisponibles.map((r) => (
              <button
                key={r.valor}
                onClick={() => setRangoSeleccionado(r.valor)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: rangoSeleccionado === r.valor ? "#10b981" : "#f1f5f9",
                  color: rangoSeleccionado === r.valor ? "#fff" : "#475569",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                {r.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
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
              Agrupar por
            </label>
            <select
              value={agruparPor}
              onChange={(e) => setAgruparPor(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              {agrupamientosDisponibles.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.etiqueta}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ Select con valores REALES desde el hook */}
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
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
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

          {/* ✅ Select de comparación con valores REALES */}
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
              Comparar
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={modoComparacion}
                onChange={(e) => setModoComparacion(e.target.checked)}
              />
              <select
                value={comunidadCompararId}
                onChange={(e) => setComunidadCompararId(e.target.value)}
                disabled={!modoComparacion}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <option value={NINGUNA}>— Ninguna —</option>
                {listaComunidades.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 Tarjetas de métricas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <TarjetaMetrica
          etiqueta="Pacientes Atendidos"
          valor={indicadores?.pacientesAtendidos || 0}
          meta="3000"
          color="#10b981"
        />
        <TarjetaMetrica
          etiqueta="Comunidades Beneficiadas"
          valor={indicadores?.comunidadesBeneficiadas || 0}
          meta="50"
          color="#3b82f6"
        />
        <TarjetaMetrica
          etiqueta="Tratamientos Entregados"
          valor={indicadores?.tratamientosEntregados || 0}
          meta="1500"
          color="#f59e0b"
        />
        <TarjetaMetrica
          etiqueta="Medicamentos Utilizados"
          valor={indicadores?.medicamentosUtilizados || 0}
          meta="5000"
          color="#ec4899"
        />
      </div>

      {/* 📈 Gráfica de evolución */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: serieComparacion.length > 0 ? "1fr 1fr" : "1fr",
          gap: "24px",
        }}
      >
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid #f1f5f9",
          }}
        >
          <h3
            style={{ fontSize: "16px", fontWeight: "600", color: "#1e293b", margin: "0 0 20px 0" }}
          >
            Pacientes atendidos por {agruparPor}
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              height: "180px",
              gap: "4px",
              padding: "0 4px",
            }}
          >
            {seriePrincipal.map((item, i) => {
              const alto = valorMaximo > 0 ? Math.max((item.valor / valorMaximo) * 100, 8) : 4;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "flex-end", height: "100%", gap: "3px" }}
                  >
                    <div
                      style={{
                        width: serieComparacion.length ? "45%" : "80%",
                        backgroundColor: "#10b981",
                        borderRadius: "4px 4px 0 0",
                        height: `${alto}%`,
                      }}
                      title={`Valor: ${item.valor}`}
                    />
                    {serieComparacion[i] && (
                      <div
                        style={{
                          width: "45%",
                          backgroundColor: "#3b82f6",
                          borderRadius: "4px 4px 0 0",
                          height: `${Math.max((serieComparacion[i].valor / valorMaximo) * 100, 4)}%`,
                        }}
                        title={`Comparación: ${serieComparacion[i].valor}`}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#64748b",
                      marginTop: "6px",
                      textAlign: "center",
                    }}
                  >
                    {item.etiqueta}
                  </span>
                </div>
              );
            })}
          </div>
          {serieComparacion.length > 0 && (
            <div
              style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "12px" }}
            >
              <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "500" }}>
                ■ Selección actual
              </span>
              <span style={{ fontSize: "12px", color: "#3b82f6", fontWeight: "500" }}>
                ■ Comparación
              </span>
            </div>
          )}
        </div>

        {/* 📋 Panel de variación porcentual */}
        {serieComparacion.length > 0 && (
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              padding: "20px",
              border: "1px solid #f1f5f9",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "#1e293b",
                margin: "0 0 20px 0",
              }}
            >
              Variación porcentual
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {seriePrincipal.map((item, i) => {
                const comp = serieComparacion[i];
                if (!comp) return null;
                const varPc = calcularVariacion(item.valor, comp.valor);
                if (varPc === null) return null;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      backgroundColor: varPc >= 0 ? "#f0fdf4" : "#fef2f2",
                      borderRadius: "10px",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: "500" }}>{item.etiqueta}</span>
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: "700",
                        color: varPc >= 0 ? "#059669" : "#dc2626",
                      }}
                    >
                      {varPc >= 0 ? "↑" : "↓"} {Math.abs(varPc).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
