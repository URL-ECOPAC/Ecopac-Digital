export default function BotonExportarPDF({ onClick, generando }) {
  return (
    <button
      onClick={onClick}
      disabled={generando}
      style={{
        padding: "10px 20px",
        borderRadius: "8px",
        border: "none",
        backgroundColor: generando ? "#94a3b8" : "#059669",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: 600,
        cursor: generando ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {generando ? (
        <>
          <span></span> Generando PDF...
        </>
      ) : (
        <>
          <span></span> Exportar PDF
        </>
      )}
    </button>
  );
}