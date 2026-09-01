import { useState } from "react";

export function ModalAltaLote({
  abierto,
  onClose,
  onGuardar,
  medicamentos = [],
  proveedores = [],
  bodegas = [],
  errorValidacion,
}) {
  const [formData, setFormData] = useState({
    medicamento_id: "",
    numero_lote: "",
    origen: "compra",
    proveedor_id: "",
    fecha_ingreso: new Date().toISOString().split("T")[0],
    fecha_vencimiento: "",
    cantidad: "",
    bodega_id: "",
  });

  if (!abierto) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onGuardar({
      ...formData,
      cantidad: Number(formData.cantidad),
    });
  };

  const estilosInput = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    fontSize: "13px",
    color: "#1e293b",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#f8fafc",
    transition: "border-color 0.2s",
  };

  const estilosLabel = {
    display: "block",
    fontSize: "12px",
    fontWeight: "700",
    color: "#475569",
    marginBottom: "6px",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "560px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#1e293b", margin: 0 }}>
              Registrar Lote de Medicamento
            </h2>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "2px 0 0 0" }}>
              Ingresa los datos para la trazabilidad y control de vence
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: "20px",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          {errorValidacion && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                borderRadius: "10px",
                fontSize: "12px",
                marginBottom: "16px",
              }}
            >
              {errorValidacion}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* Medicamento */}
            <div style={{ gridColumn: "span 2" }}>
              <label style={estilosLabel}>Medicamento *</label>
              <select
                name="medicamento_id"
                value={formData.medicamento_id}
                onChange={handleChange}
                required
                style={estilosInput}
              >
                <option value="">Seleccione medicamento...</option>
                {medicamentos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {m.concentracion ? `(${m.concentracion})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Número de Lote */}
            <div>
              <label style={estilosLabel}>Número Lote *</label>
              <input
                type="text"
                name="numero_lote"
                placeholder="Ej. LOT-2026-A"
                value={formData.numero_lote}
                onChange={handleChange}
                required
                style={estilosInput}
              />
            </div>

            {/* Origen */}
            <div>
              <label style={estilosLabel}>Origen *</label>
              <select
                name="origen"
                value={formData.origen}
                onChange={handleChange}
                required
                style={estilosInput}
              >
                <option value="compra">Compra</option>
                <option value="donacion">Donación</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>

            {/* Proveedor */}
            <div>
              <label style={estilosLabel}>Proveedor *</label>
              <select
                name="proveedor_id"
                value={formData.proveedor_id}
                onChange={handleChange}
                required
                style={estilosInput}
              >
                <option value="">Seleccione proveedor...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Bodega Destino */}
            <div>
              <label style={estilosLabel}>Bodega Destino *</label>
              <select
                name="bodega_id"
                value={formData.bodega_id}
                onChange={handleChange}
                required
                style={estilosInput}
              >
                <option value="">Seleccione bodega...</option>
                {bodegas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha Ingreso */}
            <div>
              <label style={estilosLabel}>Fecha Ingreso *</label>
              <input
                type="date"
                name="fecha_ingreso"
                value={formData.fecha_ingreso}
                onChange={handleChange}
                required
                style={estilosInput}
              />
            </div>

            {/* Fecha Vencimiento */}
            <div>
              <label style={estilosLabel}>Fecha Vencimiento *</label>
              <input
                type="date"
                name="fecha_vencimiento"
                value={formData.fecha_vencimiento}
                onChange={handleChange}
                required
                style={estilosInput}
              />
            </div>

            {/* Cantidad */}
            <div style={{ gridColumn: "span 2" }}>
              <label style={estilosLabel}>Cantidad Unidades *</label>
              <input
                type="number"
                min="1"
                name="cantidad"
                placeholder="0"
                value={formData.cantidad}
                onChange={handleChange}
                required
                style={estilosInput}
              />
            </div>
          </div>

          {/* Botones de Acción */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                borderRadius: "9999px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#64748b",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: "10px 24px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
              }}
            >
              Guardar Lote
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
