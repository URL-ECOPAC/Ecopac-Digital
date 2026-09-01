export default function ModalMedicamento({
  isOpen,
  onClose,
  modoEdicion,
  formData,
  setFormData,
  onSubmit,
  principiosActivos = [],
  onCrearPrincipioActivo,
  advertenciaDuplicado,
  cargando,
}) {
  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(4px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "540px",
          padding: "32px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          position: "relative",
          margin: "16px",
          boxSizing: "border-box",
        }}
      >
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          type="button"
          disabled={cargando}
          style={{
            position: "absolute",
            top: "24px",
            right: "24px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: "20px",
            color: "#94a3b8",
          }}
        >
          ✕
        </button>

        {/* Título */}
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "800",
            color: "#0f172a",
            margin: "0 0 4px 0",
          }}
        >
          {modoEdicion ? "Editar Medicamento" : "Nuevo Medicamento"}
        </h2>
        <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 20px 0" }}>
          Define los datos generales y especificaciones técnicas
        </p>

        {/* Advertencia Duplicado */}
        {advertenciaDuplicado && (
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              color: "#991b1b",
              fontSize: "12px",
              marginBottom: "16px",
            }}
          >
            ⚠️ <strong>Medicamento duplicado:</strong> Ya existe un registro con el mismo nombre,
            concentración, presentación y marca.
          </div>
        )}

        {/* Formulario */}
        <form
          onSubmit={handleFormSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {/* Nombre Comercial */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: "800",
                color: "#475569",
                marginBottom: "6px",
                textTransform: "uppercase",
              }}
            >
              NOMBRE COMERCIAL *
            </label>
            <input
              type="text"
              name="nombre"
              required
              placeholder="Ej. Dolo Neurobion, Amoxicilina"
              value={formData.nombre || ""}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Principio Activo */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <label
                style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  color: "#475569",
                  textTransform: "uppercase",
                }}
              >
                PRINCIPIO ACTIVO *
              </label>
              {!modoEdicion && (
                <button
                  type="button"
                  onClick={onCrearPrincipioActivo}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#059669",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  + Crear Nuevo
                </button>
              )}
            </div>
            <select
              name="principioActivoId"
              required={!modoEdicion}
              value={String(formData.principioActivoId || "")}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                backgroundColor: "#ffffff",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              <option value="">Selecciona principio activo...</option>
              {Array.isArray(principiosActivos) &&
                principiosActivos.map((pa) => (
                  <option key={pa.id} value={String(pa.id)}>
                    {pa.nombre}
                  </option>
                ))}
            </select>
          </div>

          {/* Concentración y Presentación */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: "800",
                  color: "#475569",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                CONCENTRACIÓN *
              </label>
              <input
                type="text"
                name="concentracion"
                required
                placeholder="Ej. 500mg"
                value={formData.concentracion || ""}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: "800",
                  color: "#475569",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                PRESENTACIÓN *
              </label>
              <select
                name="presentacion"
                required
                value={formData.presentacion || ""}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  backgroundColor: "#ffffff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                <option value="">Selecciona...</option>
                <option value="Cápsula">Cápsula</option>
                <option value="Tableta">Tableta</option>
                <option value="Jarabe">Jarabe</option>
                <option value="Ampolla">Ampolla</option>
                <option value="Crema">Crema</option>
                <option value="Gotas">Gotas</option>
              </select>
            </div>
          </div>

          {/* Marca y Forma Farmacéutica */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: "800",
                  color: "#475569",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                MARCA / LABORATORIO *
              </label>
              <input
                type="text"
                name="marca"
                required
                placeholder="Ej. Bayer"
                value={formData.marca || ""}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: "800",
                  color: "#475569",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                FORMA FARMACÉUTICA
              </label>
              <input
                type="text"
                name="formaFarmaceutica"
                placeholder="Ej. Sólido oral"
                value={formData.formaFarmaceutica || ""}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Botones de Acción */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "12px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={cargando}
              style={{
                padding: "10px 24px",
                borderRadius: "9999px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#475569",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              style={{
                padding: "10px 28px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: "#059669", // Mismo verde uniforme
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "700",
                cursor: cargando ? "not-allowed" : "pointer",
                opacity: cargando ? 0.7 : 1,
              }}
            >
              {cargando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
