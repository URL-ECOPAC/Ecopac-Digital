export default function BotonExportarPDF({ onClick, generando }) {
  return (
    <button
      onClick={onClick}
      disabled={generando}
      style={{
        padding: "10px 20px",
        borderRadius: "6px", // Más alineado con tu diseño
        border: "none",
        backgroundColor: generando ? "#94a3b8" : "#059669",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: 600,
        cursor: generando ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        transition: "background-color 0.2s ease", // Suaviza el cambio
      }}
    >
      {generando ? (
        <>
          <span style={{ width: "16px", height: "16px" }} />
          Generando PDF...
        </>
      ) : (
        <>Exportar PDF</>
      )}
    </button>
  );
}
